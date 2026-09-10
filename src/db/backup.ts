import JSZip from 'jszip';
import {repository} from './repository';
import {type Asset,type Book,type StoredAsset,uid,validateBook} from '../domain/model';

const BACKUP_FORMAT='flipbook-backup';
const LIBRARY_BACKUP_FORMAT='flipbook-library-backup';
const LEGACY_BACKUP_FORMAT=['flip','in-backup'].join('');
type BackupManifest={format:string;version:1;exportedAt:number;book:Book};
type LibraryManifest={format:typeof LIBRARY_BACKUP_FORMAT;version:1;exportedAt:number;entries:string[]};

function safeName(name:string){return (name.trim()||'flipbook').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80);}
function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function requireAssetFile(zip:JSZip,path:string,type:string){const entry=zip.file(path);if(!entry)throw new Error(`备份文件缺少素材数据：${path}`);const bytes=await entry.async('uint8array');return new Blob([bytes],{type});}
function bookAssets(book:Book):Asset[]{
  const seen=new Set<string>();
  return [...book.assets,...(book.textureAssets??[])].filter(asset=>!seen.has(asset.id)&&seen.add(asset.id));
}

async function buildBookBackup(book:Book){
  const zip=new JSZip();
  const manifest:BackupManifest={format:BACKUP_FORMAT,version:1,exportedAt:Date.now(),book:structuredClone(book)};
  zip.file('manifest.json',JSON.stringify(manifest,null,2));
  for(const metadata of bookAssets(book)){
    const stored=await repository.getAsset(metadata.id);
    if(!stored)throw new Error(`素材或纹理“${metadata.name}”的本地图片文件缺失，无法完成完整备份。`);
    const base=`assets/${metadata.id}`;
    zip.file(`${base}/original`,stored.original);
    zip.file(`${base}/preview`,stored.preview);
    zip.file(`${base}/thumbnail`,stored.thumbnail);
  }
  return await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
}

export async function exportBookBackup(bookId:string){
  const book=await repository.get(bookId);
  const blob=await buildBookBackup(book);
  const stamp=new Date().toISOString().slice(0,10);
  downloadBlob(blob,`${safeName(book.title)}-${stamp}.flipbook-backup`);
}

export async function exportLibraryBackup(){
  const books=await repository.list();
  if(!books.length)throw new Error('当前还没有可备份的画册。');
  const zip=new JSZip(),entries:string[]=[];
  for(let index=0;index<books.length;index++){
    const book=books[index];
    const name=`books/${String(index+1).padStart(3,'0')}-${safeName(book.title)}.flipbook-backup`;
    entries.push(name);
    zip.file(name,await buildBookBackup(book));
  }
  const manifest:LibraryManifest={format:LIBRARY_BACKUP_FORMAT,version:1,exportedAt:Date.now(),entries};
  zip.file('library.json',JSON.stringify(manifest,null,2));
  const blob=await zip.generateAsync({type:'blob',compression:'STORE'});
  const stamp=new Date().toISOString().slice(0,10);
  downloadBlob(blob,`flipbook-library-${stamp}.flipbook-library-backup`);
}

export async function importBookBackup(file:File){
  const zip=await JSZip.loadAsync(file);
  const manifestEntry=zip.file('manifest.json');
  if(!manifestEntry)throw new Error('这不是有效的 FLIPBOOK 作品备份。');
  let manifest:BackupManifest;
  try{manifest=JSON.parse(await manifestEntry.async('string')) as BackupManifest;}catch{throw new Error('备份文件的作品信息无法读取。');}
  if(![BACKUP_FORMAT,LEGACY_BACKUP_FORMAT].includes(manifest.format)||manifest.version!==1)throw new Error('不支持这个版本的 FLIPBOOK 备份。');
  validateBook(manifest.book);
  const existing=await repository.list();
  const book=structuredClone(manifest.book);
  if(existing.some(item=>item.id===book.id)){book.id=uid();book.title=`${book.title}（恢复副本）`;book.createdAt=Date.now();}
  book.updatedAt=Date.now();
  const storedAssets:StoredAsset[]=[];
  for(const metadata of bookAssets(book)){
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

export async function importLibraryBackup(file:File){
  const zip=await JSZip.loadAsync(file);
  const manifestEntry=zip.file('library.json');
  if(!manifestEntry)throw new Error('这不是有效的 FLIPBOOK 全部作品备份。');
  let manifest:LibraryManifest;
  try{manifest=JSON.parse(await manifestEntry.async('string')) as LibraryManifest;}catch{throw new Error('全部作品备份信息无法读取。');}
  if(manifest.format!==LIBRARY_BACKUP_FORMAT||manifest.version!==1||!Array.isArray(manifest.entries))throw new Error('不支持这个版本的全部作品备份。');
  const restored:Book[]=[];
  for(const path of manifest.entries){
    const entry=zip.file(path);
    if(!entry)throw new Error(`全部作品备份缺少：${path}`);
    const bytes=await entry.async('uint8array');
    restored.push(await importBookBackup(new File([bytes],path.split('/').at(-1)??'book.flipbook-backup',{type:'application/zip'})));
  }
  return restored;
}
