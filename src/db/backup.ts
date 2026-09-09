import JSZip from 'jszip';
import {repository} from './repository';
import {type Book,type StoredAsset,uid,validateBook} from '../domain/model';

const BACKUP_FORMAT='flipbook-backup';
const LEGACY_BACKUP_FORMAT=['flip','in-backup'].join('');
type BackupManifest={
  format:string;
  version:1;
  exportedAt:number;
  book:Book;
};

function safeName(name:string){
  return (name.trim()||'flipbook').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80);
}

function downloadBlob(blob:Blob,name:string){
  const url=URL.createObjectURL(blob);
  const link=document.createElement('a');
  link.href=url;
  link.download=name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function requireAssetFile(zip:JSZip,path:string,type:string){
  const entry=zip.file(path);
  if(!entry)throw new Error(`备份文件缺少素材数据：${path}`);
  const bytes=await entry.async('uint8array');
  return new Blob([bytes],{type});
}

export async function exportBookBackup(bookId:string){
  const book=await repository.get(bookId);
  const zip=new JSZip();
  const manifest:BackupManifest={format:BACKUP_FORMAT,version:1,exportedAt:Date.now(),book:structuredClone(book)};
  zip.file('manifest.json',JSON.stringify(manifest,null,2));

  for(const metadata of book.assets){
    const stored=await repository.getAsset(metadata.id);
    if(!stored)throw new Error(`素材“${metadata.name}”的本地图片文件缺失，无法完成完整备份。`);
    const base=`assets/${metadata.id}`;
    zip.file(`${base}/original`,stored.original);
    zip.file(`${base}/preview`,stored.preview);
    zip.file(`${base}/thumbnail`,stored.thumbnail);
  }

  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  const stamp=new Date().toISOString().slice(0,10);
  downloadBlob(blob,`${safeName(book.title)}-${stamp}.flipbook-backup`);
}

export async function importBookBackup(file:File){
  const zip=await JSZip.loadAsync(file);
  const manifestEntry=zip.file('manifest.json');
  if(!manifestEntry)throw new Error('这不是有效的 FLIPBOOK 作品备份。');

  let manifest:BackupManifest;
  try{manifest=JSON.parse(await manifestEntry.async('string')) as BackupManifest;}
  catch{throw new Error('备份文件的作品信息无法读取。');}

  if(![BACKUP_FORMAT,LEGACY_BACKUP_FORMAT].includes(manifest.format)||manifest.version!==1)throw new Error('不支持这个版本的 FLIPBOOK 备份。');
  validateBook(manifest.book);

  const existing=await repository.list();
  const book=structuredClone(manifest.book);
  if(existing.some(item=>item.id===book.id)){
    book.id=uid();
    book.title=`${book.title}（恢复副本）`;
    book.createdAt=Date.now();
  }
  book.updatedAt=Date.now();

  const storedAssets:StoredAsset[]=[];
  for(const metadata of book.assets){
    const base=`assets/${metadata.id}`;
    const original=await requireAssetFile(zip,`${base}/original`,metadata.mimeType||'application/octet-stream');
    const preview=await requireAssetFile(zip,`${base}/preview`,'image/webp');
    const thumbnail=await requireAssetFile(zip,`${base}/thumbnail`,'image/webp');
    storedAssets.push({...metadata,original,preview,thumbnail});
  }

  await repository.create(book,storedAssets);
  await repository.markInitialized();
  return book;
}
