import JSZip from 'jszip';
import {repository} from './repository';
import {createZipSink,StreamZipWriter} from './streamZip';
import {type Asset,type Book,type StoredAsset,uid,validateBook} from '../domain/model';

const BACKUP_FORMAT='flipbook-backup';
const LIBRARY_BACKUP_FORMAT='flipbook-library-backup';
const LEGACY_BACKUP_FORMAT=['flip','in-backup'].join('');
type BackupManifest={format:string;version:1;exportedAt:number;book:Book};
type LibraryManifest={format:typeof LIBRARY_BACKUP_FORMAT;version:1|2;exportedAt:number;entries:string[]};
export type BackupProgress=(percent:number)=>void;

function safeName(name:string){return (name.trim()||'flipbook').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80);}
function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function requireAssetFile(zip:JSZip,path:string,type:string){const entry=zip.file(path);if(!entry)throw new Error(`备份文件缺少素材数据：${path}`);const bytes=await entry.async('uint8array');return new Blob([bytes],{type});}
function bookAssets(book:Book):Asset[]{
  const seen=new Set<string>();
  return [...book.assets,...(book.textureAssets??[])].filter(asset=>!seen.has(asset.id)&&seen.add(asset.id));
}
function reportProgress(onProgress:BackupProgress|undefined,percent:number){onProgress?.(Math.max(0,Math.min(100,percent)));}
function backupPath(prefix:string,path:string){const root=prefix.replace(/\/+$/,'');return root?`${root}/${path}`:path;}
function isAbortError(cause:unknown){return cause instanceof DOMException&&cause.name==='AbortError';}

async function writeBookEntries(writer:StreamZipWriter,book:Book,prefix='',onProgress?:BackupProgress){
  const manifest:BackupManifest={format:BACKUP_FORMAT,version:1,exportedAt:Date.now(),book:structuredClone(book)};
  await writer.addText(backupPath(prefix,'manifest.json'),JSON.stringify(manifest,null,2));
  const assets=bookAssets(book);
  if(!assets.length){reportProgress(onProgress,100);return;}

  for(let index=0;index<assets.length;index++){
    const metadata=assets[index];
    const stored=await repository.getAsset(metadata.id);
    if(!stored)throw new Error(`素材或纹理“${metadata.name}”的本地图片文件缺失，无法完成完整备份。`);
    const base=backupPath(prefix,`assets/${metadata.id}`);
    const parts=[
      {name:`${base}/original`,blob:stored.original},
      {name:`${base}/preview`,blob:stored.preview},
      {name:`${base}/thumbnail`,blob:stored.thumbnail},
    ];
    const assetBytes=Math.max(1,parts.reduce((sum,part)=>sum+part.blob.size,0));
    let completedBytes=0;
    for(const part of parts){
      const before=completedBytes;
      await writer.addBlob(part.name,part.blob,(written,total)=>{
        const current=before+(total?Math.min(written,total):0);
        reportProgress(onProgress,100*(index+current/assetBytes)/assets.length);
      });
      completedBytes+=part.blob.size;
    }
    reportProgress(onProgress,100*(index+1)/assets.length);
  }
}

export async function exportBookBackup(bookId:string,onProgress?:BackupProgress,suggestedTitle='flipbook'){
  reportProgress(onProgress,0);
  const stamp=new Date().toISOString().slice(0,10);
  const filename=`${safeName(suggestedTitle)}-${stamp}.flipbook-backup`;
  let sink;
  try{sink=await createZipSink(filename,'.flipbook-backup');}
  catch(cause){if(isAbortError(cause))return false;throw cause;}
  const writer=new StreamZipWriter(sink);
  try{
    const book=await repository.get(bookId);
    await writeBookEntries(writer,book,'',percent=>reportProgress(onProgress,percent*.99));
    const blob=await writer.finish();
    if(blob)downloadBlob(blob,`${safeName(book.title)}-${stamp}.flipbook-backup`);
    reportProgress(onProgress,100);
    return true;
  }catch(cause){
    await writer.abort(cause).catch(()=>undefined);
    throw cause;
  }
}

export async function exportLibraryBackup(onProgress?:BackupProgress){
  reportProgress(onProgress,0);
  const stamp=new Date().toISOString().slice(0,10);
  const filename=`flipbook-library-${stamp}.flipbook-library-backup`;
  let sink;
  try{sink=await createZipSink(filename,'.flipbook-library-backup');}
  catch(cause){if(isAbortError(cause))return false;throw cause;}
  const writer=new StreamZipWriter(sink);
  try{
    const books=await repository.list();
    if(!books.length)throw new Error('当前还没有可备份的画册。');
    const entries=books.map((book,index)=>`books/${String(index+1).padStart(3,'0')}-${safeName(book.title)}`);
    const manifest:LibraryManifest={format:LIBRARY_BACKUP_FORMAT,version:2,exportedAt:Date.now(),entries};
    await writer.addText('library.json',JSON.stringify(manifest,null,2));

    const weights=books.map(book=>Math.max(1,bookAssets(book).length));
    const totalWeight=weights.reduce((sum,weight)=>sum+weight,0);
    let completedWeight=0;
    for(let index=0;index<books.length;index++){
      const weight=weights[index];
      await writeBookEntries(writer,books[index],entries[index],percent=>{
        reportProgress(onProgress,99*(completedWeight+weight*percent/100)/totalWeight);
      });
      completedWeight+=weight;
      reportProgress(onProgress,99*completedWeight/totalWeight);
    }
    const blob=await writer.finish();
    if(blob)downloadBlob(blob,filename);
    reportProgress(onProgress,100);
    return true;
  }catch(cause){
    await writer.abort(cause).catch(()=>undefined);
    throw cause;
  }
}

async function restoreBookFromZip(zip:JSZip,prefix=''){
  const manifestPath=backupPath(prefix,'manifest.json');
  const manifestEntry=zip.file(manifestPath);
  if(!manifestEntry)throw new Error(`备份文件缺少作品信息：${manifestPath}`);
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
    const base=backupPath(prefix,`assets/${metadata.id}`);
    const original=await requireAssetFile(zip,`${base}/original`,metadata.mimeType||'application/octet-stream');
    const preview=await requireAssetFile(zip,`${base}/preview`,'image/webp');
    const thumbnail=await requireAssetFile(zip,`${base}/thumbnail`,'image/webp');
    storedAssets.push({...metadata,original,preview,thumbnail});
  }
  await repository.create(book,storedAssets);
  await repository.markInitialized();
  return book;
}

export async function importBookBackup(file:File){
  const zip=await JSZip.loadAsync(file);
  return await restoreBookFromZip(zip);
}

export async function importLibraryBackup(file:File){
  const zip=await JSZip.loadAsync(file);
  const manifestEntry=zip.file('library.json');
  if(!manifestEntry)throw new Error('这不是有效的 FLIPBOOK 全部作品备份。');
  let manifest:LibraryManifest;
  try{manifest=JSON.parse(await manifestEntry.async('string')) as LibraryManifest;}catch{throw new Error('全部作品备份信息无法读取。');}
  if(manifest.format!==LIBRARY_BACKUP_FORMAT||![1,2].includes(manifest.version)||!Array.isArray(manifest.entries))throw new Error('不支持这个版本的全部作品备份。');
  const restored:Book[]=[];
  if(manifest.version===2){
    for(const prefix of manifest.entries)restored.push(await restoreBookFromZip(zip,prefix));
    return restored;
  }
  for(const path of manifest.entries){
    const entry=zip.file(path);
    if(!entry)throw new Error(`全部作品备份缺少：${path}`);
    const bytes=await entry.async('uint8array');
    restored.push(await importBookBackup(new File([bytes],path.split('/').at(-1)??'book.flipbook-backup',{type:'application/zip'})));
  }
  return restored;
}
