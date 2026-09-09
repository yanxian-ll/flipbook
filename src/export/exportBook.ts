import type {Book} from '../domain/model';
import {H,W} from '../domain/model';
import {renderPage} from '../editor/renderer';

export type ExportFormat='collage'|'mp4'|'jpg'|'pdf'|'share';
export interface ExportOptions{pagesPerCollage?:number}
export interface ExportArtifact{blob:Blob;extension:'jpg'|'zip'|'pdf'|'mp4'|'html';suffix:string}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
function wait(ms:number){return new Promise<void>(resolve=>window.setTimeout(resolve,ms));}
function nextFrame(){return new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
function canvasBlob(canvas:HTMLCanvasElement,type:string,quality=.95){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('导出图片失败。')),type,quality));}
async function blobToDataUrl(blob:Blob){return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error??new Error('读取导出文件失败。'));reader.readAsDataURL(blob);});}
async function renderJpegs(book:Book,indices:number[],scale:number,onProgress:(n:number)=>void,progressEnd=.78){
  const blobs:Blob[]=[];
  for(let i=0;i<indices.length;i++){
    const page=book.pages[indices[i]];
    if(!page)continue;
    blobs.push(await renderPage(page,{scale,quality:'original',mimeType:'image/jpeg'}));
    onProgress((i+1)/indices.length*progressEnd);
  }
  return blobs;
}
async function zipJpegs(blobs:Blob[],indices:number[],prefix='page'){
  const {default:JSZip}=await import('jszip');
  const zip=new JSZip();
  blobs.forEach((blob,i)=>zip.file(`${prefix}-${String(indices[i]+1).padStart(3,'0')}.jpg`,blob));
  return await zip.generateAsync({type:'blob'});
}
async function makeCollage(blobs:Blob[]){
  const images=await Promise.all(blobs.map(blob=>createImageBitmap(blob)));
  try{
    if(!images.length)throw new Error('没有可导出的页面。');
    const columns=images.length===1?1:2,rows=Math.ceil(images.length/columns);
    const pageWidth=images[0].width,pageHeight=images[0].height;
    const gap=Math.max(16,Math.round(pageWidth*.018));
    const canvas=document.createElement('canvas');
    canvas.width=columns*pageWidth+(columns-1)*gap;
    canvas.height=rows*pageHeight+(rows-1)*gap;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('当前浏览器无法创建导出画布。');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    images.forEach((image,i)=>{
      const row=Math.floor(i/columns),col=i%columns;
      const singleLast=columns===2&&i===images.length-1&&images.length%2===1;
      const x=singleLast?(canvas.width-pageWidth)/2:col*(pageWidth+gap);
      ctx.drawImage(image,x,row*(pageHeight+gap),pageWidth,pageHeight);
    });
    return await canvasBlob(canvas,'image/jpeg',.95);
  }finally{images.forEach(image=>image.close());}
}
function mp4MimeType(){
  if(typeof MediaRecorder==='undefined')return '';
  const candidates=['video/mp4;codecs=avc1.42E01E','video/mp4;codecs=avc1','video/mp4'];
  return candidates.find(type=>MediaRecorder.isTypeSupported(type))??'';
}
function drawVideoPage(ctx:CanvasRenderingContext2D,image:ImageBitmap,width:number,height:number,x=0,alpha=1,scale=1){
  const drawWidth=width*scale,drawHeight=height*scale;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(x+(width-drawWidth)/2,(height-drawHeight)/2);
  ctx.drawImage(image,0,0,drawWidth,drawHeight);
  ctx.restore();
}
async function exportMp4(book:Book,indices:number[],quality:number,onProgress:(n:number)=>void){
  const mimeType=mp4MimeType();
  if(!mimeType)throw new Error('当前浏览器暂不支持直接编码 MP4，请使用最新版 Safari、Chrome 或 Edge。');
  if(typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('当前浏览器暂不支持视频导出。');
  const scale=clamp(.65+quality*.15,.8,1.1);
  const blobs=await renderJpegs(book,indices,scale,n=>onProgress(n*.42),1);
  const images=await Promise.all(blobs.map(blob=>createImageBitmap(blob)));
  if(!images.length)throw new Error('没有可导出的页面。');
  const canvas=document.createElement('canvas');
  const targetWidth=Math.min(1080,images[0].width);
  canvas.width=Math.max(2,Math.floor(targetWidth/2)*2);
  canvas.height=Math.max(2,Math.floor((canvas.width*H/W)/2)*2);
  const ctx=canvas.getContext('2d');
  if(!ctx){images.forEach(image=>image.close());throw new Error('当前浏览器无法创建视频画布。');}
  const stream=canvas.captureStream(30);
  const chunks:Blob[]=[];
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:8_000_000});
  const completed=new Promise<Blob>((resolve,reject)=>{
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onerror=()=>reject(new Error('MP4 编码失败。'));
    recorder.onstop=()=>resolve(new Blob(chunks,{type:mimeType}));
  });
  const holdMs=420,transitionMs=320,totalMs=images.length*holdMs+Math.max(0,images.length-1)*transitionMs+320;
  let elapsedMs=0;
  const report=()=>onProgress(.42+Math.min(1,elapsedMs/totalMs)*.56);
  const paint=(current:ImageBitmap,next?:ImageBitmap,progress=0)=>{
    ctx.fillStyle='#f3f2ef';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(!next){drawVideoPage(ctx,current,canvas.width,canvas.height,0,1,1);return;}
    const eased=1-Math.pow(1-progress,3);
    drawVideoPage(ctx,current,canvas.width,canvas.height,-eased*canvas.width*.18,1-eased*.35,1-eased*.025);
    drawVideoPage(ctx,next,canvas.width,canvas.height,(1-eased)*canvas.width*.92,eased,.975+eased*.025);
    ctx.fillStyle=`rgba(0,0,0,${.12*Math.sin(progress*Math.PI)})`;
    ctx.fillRect(canvas.width*(.49-.04*eased),0,Math.max(2,canvas.width*.025),canvas.height);
  };
  async function animate(duration:number,draw:(t:number)=>void){
    const start=performance.now();
    for(;;){
      const t=Math.min(1,(performance.now()-start)/duration);
      draw(t);report();
      if(t>=1)break;
      await nextFrame();
    }
    elapsedMs+=duration;report();
  }
  try{
    paint(images[0]);
    recorder.start(250);
    await wait(120);
    for(let i=0;i<images.length;i++){
      await animate(holdMs,()=>paint(images[i]));
      if(i<images.length-1)await animate(transitionMs,t=>paint(images[i],images[i+1],t));
    }
    await animate(200,()=>paint(images[images.length-1]));
    await wait(80);
    recorder.stop();
    const blob=await completed;
    onProgress(1);
    return blob;
  }finally{
    stream.getTracks().forEach(track=>track.stop());
    images.forEach(image=>image.close());
    if(recorder.state!=='inactive')recorder.stop();
  }
}
const HTML_ENTITIES:Record<string,string>={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>HTML_ENTITIES[char]??char);}
async function exportSharePage(book:Book,indices:number[],quality:number,onProgress:(n:number)=>void){
  const scale=clamp(quality,1,1.6);
  const blobs=await renderJpegs(book,indices,scale,n=>onProgress(n*.75),1);
  const pages:string[]=[];
  for(let i=0;i<blobs.length;i++){pages.push(await blobToDataUrl(blobs[i]));onProgress(.75+(i+1)/blobs.length*.2);}
  const title=escapeHtml(book.title);
  const payload=JSON.stringify(pages).replace(/</g,'\\u003c');
  const html=`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title}</title>
<style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,"Microsoft YaHei",sans-serif;background:#e9e8e4;color:#1b1b1b}body{display:grid;grid-template-rows:auto 1fr auto;min-height:100dvh}.top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;font-weight:700;background:#ffffffd9;backdrop-filter:blur(14px)}.stage{display:flex;align-items:center;justify-content:center;min-height:0;padding:28px 18px;overflow:hidden}.book{display:flex;align-items:center;justify-content:center;max-width:min(1080px,94vw);max-height:78dvh;filter:drop-shadow(0 18px 24px #0003);perspective:1800px}.page{display:block;max-height:78dvh;max-width:46vw;width:auto;height:auto;background:#fff;transition:transform .28s ease,opacity .28s ease}.page:first-child{transform-origin:right center}.page:last-child{transform-origin:left center}.book.cover .page{max-width:min(520px,82vw)}.nav{display:flex;align-items:center;justify-content:center;gap:18px;padding:16px 20px 24px}.nav button{width:44px;height:44px;border:0;border-radius:50%;background:#fff;font-size:22px;box-shadow:0 4px 14px #0001;cursor:pointer}.nav button:disabled{opacity:.3}.count{min-width:86px;text-align:center;color:#666;font-size:12px}@media(max-width:640px){.stage{padding:16px 8px}.book{max-width:98vw}.page{max-width:48vw;max-height:72dvh}.book.cover .page{max-width:82vw}.top{padding:13px 16px}}
</style></head><body><div class="top"><span>${title}</span><span>FLIPBOOK</span></div><main class="stage"><div id="book" class="book"></div></main><div class="nav"><button id="prev" aria-label="上一页">‹</button><span id="count" class="count"></span><button id="next" aria-label="下一页">›</button></div>
<script>const pages=${payload};let index=0;const book=document.getElementById('book'),count=document.getElementById('count'),prev=document.getElementById('prev'),next=document.getElementById('next');function render(){const cover=index===0;const visible=cover?[0]:[index,index+1].filter(i=>i<pages.length);book.className='book'+(cover?' cover':'');book.innerHTML=visible.map(i=>'<img class="page" src="'+pages[i]+'" alt="第 '+(i+1)+' 页">').join('');count.textContent=cover?'封面':(index+1)+'–'+Math.min(index+2,pages.length)+' / '+pages.length;prev.disabled=index===0;next.disabled=cover?pages.length<=1:index+2>=pages.length;}function goNext(){if(index===0)index=1;else index=Math.min(pages.length-1,index+2);render()}function goPrev(){if(index<=1)index=0;else index=Math.max(1,index-2);render()}prev.onclick=goPrev;next.onclick=goNext;addEventListener('keydown',e=>{if(e.key==='ArrowRight')goNext();if(e.key==='ArrowLeft')goPrev()});let start=0;book.addEventListener('touchstart',e=>start=e.touches[0].clientX,{passive:true});book.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-start;if(Math.abs(d)>40)(d<0?goNext:goPrev)()},{passive:true});render();</script></body></html>`;
  onProgress(1);
  return new Blob([html],{type:'text/html;charset=utf-8'});
}

export async function exportBook(book:Book,format:ExportFormat,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions={}):Promise<ExportArtifact>{
  const valid=[...new Set(indices)].filter(index=>index>=0&&index<book.pages.length).sort((a,b)=>a-b);
  if(!valid.length)throw new Error('请至少选择一页。');
  onProgress(0);
  if(format==='pdf'){
    const blobs=await renderJpegs(book,valid,quality,onProgress,.82);
    const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.create();
    for(let i=0;i<blobs.length;i++){const image=await pdf.embedJpg(await blobs[i].arrayBuffer());const page=pdf.addPage([book.format.width*.6,book.format.height*.6]);page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});onProgress(.82+(i+1)/blobs.length*.16);}
    onProgress(1);return {blob:new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'}),extension:'pdf',suffix:'-book'};
  }
  if(format==='jpg'){
    const blobs=await renderJpegs(book,valid,quality,onProgress,.88);
    if(blobs.length===1){onProgress(1);return {blob:blobs[0],extension:'jpg',suffix:`-page-${String(valid[0]+1).padStart(3,'0')}`};}
    const zip=await zipJpegs(blobs,valid);onProgress(1);return {blob:zip,extension:'zip',suffix:'-pages'};
  }
  if(format==='collage'){
    const inner=valid.filter(index=>index>0);
    if(!inner.length)throw new Error('多跨页拼图只导出内页，请至少选择一张内页。');
    const perImage=clamp(Math.round(options.pagesPerCollage??4),2,8);
    const rows=Math.ceil(Math.min(perImage,inner.length)/2);
    const safeScale=clamp(Math.min(quality,12000/(W*2),12000/(H*Math.max(1,rows))),.5,quality);
    const blobs=await renderJpegs(book,inner,safeScale,n=>onProgress(n*.72),1);
    const collages:Blob[]=[];
    for(let offset=0;offset<blobs.length;offset+=perImage){collages.push(await makeCollage(blobs.slice(offset,offset+perImage)));onProgress(.72+Math.min(1,(offset+perImage)/blobs.length)*.24);}
    if(collages.length===1){onProgress(1);return {blob:collages[0],extension:'jpg',suffix:'-collage'};}
    const {default:JSZip}=await import('jszip');const zip=new JSZip();collages.forEach((blob,i)=>zip.file(`collage-${String(i+1).padStart(3,'0')}.jpg`,blob));const result=await zip.generateAsync({type:'blob'});onProgress(1);return {blob:result,extension:'zip',suffix:'-collages'};
  }
  if(format==='mp4')return {blob:await exportMp4(book,valid,quality,onProgress),extension:'mp4',suffix:'-live'};
  return {blob:await exportSharePage(book,valid,quality,onProgress),extension:'html',suffix:'-share'};
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
