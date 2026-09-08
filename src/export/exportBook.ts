import type {Book} from '../domain/model';
import {renderPage} from '../editor/renderer';
export type ExportFormat='pdf'|'jpg'|'zip';
export async function exportBook(book:Book,format:ExportFormat,indices:number[],quality:number,onProgress:(n:number)=>void):Promise<Blob>{
  if(!indices.length)throw new Error('请至少选择一页。');
  const blobs:Blob[]=[];
  for(let i=0;i<indices.length;i++){blobs.push(await renderPage(book.pages[indices[i]],{scale:quality,quality:'original',mimeType:'image/jpeg'}));onProgress((i+1)/indices.length*.85);}
  if(format==='pdf'){const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.create();for(const blob of blobs){const image=await pdf.embedJpg(await blob.arrayBuffer());const page=pdf.addPage([book.format.width*.6,book.format.height*.6]);page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});}onProgress(1);return new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'});}
  if(format==='jpg'&&blobs.length===1){onProgress(1);return blobs[0];}
  const {default:JSZip}=await import('jszip');const zip=new JSZip();blobs.forEach((blob,i)=>zip.file(`page-${String(indices[i]+1).padStart(3,'0')}.jpg`,blob));const result=await zip.generateAsync({type:'blob'});onProgress(1);return result;
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
