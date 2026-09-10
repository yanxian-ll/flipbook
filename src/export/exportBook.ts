import type {Book} from '../domain/model';
import {H} from '../domain/model';
import {drawComposition,compositionGeometry,defaultComposition,type CompositionOptions} from './composition';
import {renderPage} from '../editor/renderer';

export type ExportFormat='collage'|'mp4'|'pdf'|'share';
export type ExportOptions=CompositionOptions;
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
async function renderCompositions(book:Book,indices:number[],scale:number,onProgress:(n:number)=>void,options:ExportOptions){
  const count=compositionGeometry(options).count,output:Blob[]=[];
  for(let offset=0;offset<indices.length;offset+=count){
    const images:ImageBitmap[]=[];
    try{
      for(const index of indices.slice(offset,offset+count))images.push(await createImageBitmap(await renderPage(book.pages[index],{scale:Math.min(scale,2),quality:'original',mimeType:'image/jpeg'})));
      const canvas=document.createElement('canvas');
      drawComposition(canvas,images,options,Math.round(H*scale));
      output.push(await canvasBlob(canvas,'image/jpeg'));
    }finally{images.forEach(image=>image.close());}
    onProgress(Math.min(1,(offset+count)/indices.length));
  }
  return output;
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
async function exportMp4(book:Book,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions){
  const mimeType=mp4MimeType();
  if(!mimeType)throw new Error('当前浏览器暂不支持直接编码 MP4，请使用最新版 Safari、Chrome 或 Edge。');
  if(typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('当前浏览器暂不支持视频导出。');
  const scale=clamp(.65+quality*.15,.8,1.1);
  const blobs=await renderCompositions(book,indices,scale,n=>onProgress(n*.42),options);
  const images=await Promise.all(blobs.map(blob=>createImageBitmap(blob)));
  if(!images.length)throw new Error('没有可导出的页面。');
  const canvas=document.createElement('canvas');
  const targetWidth=Math.min(1080,images[0].width);
  canvas.width=Math.max(2,Math.floor(targetWidth/2)*2);
  canvas.height=Math.max(2,Math.floor((canvas.width*images[0].height/images[0].width)/2)*2);
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

async function loadPageFlipBundle(){
  const cdn='https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js';
  try{
    const response=await fetch(cdn);
    if(!response.ok)throw new Error('page-flip bundle unavailable');
    return {source:(await response.text()).replace(/<\/script/gi,'<\\/script'),cdn};
  }catch{
    return {source:'',cdn};
  }
}
async function exportSharePage(book:Book,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions){
  const scale=clamp(quality,1,1.6);
  const blobs=await renderJpegs(book,indices,scale,n=>onProgress(n*.68),1);
  const pages:string[]=[];
  for(let i=0;i<blobs.length;i++){pages.push(await blobToDataUrl(blobs[i]));onProgress(.68+(i+1)/blobs.length*.18);}
  const title=escapeHtml(book.title);
  const payload=JSON.stringify(pages).replace(/</g,'\\u003c');
  const labels=JSON.stringify(indices.map(index=>index===0?'封面':'第 '+index+' 页')).replace(/</g,'\\u003c');
  const showCover=indices[0]===0;
  const pageFlipBundle=await loadPageFlipBundle();
  onProgress(.92);
  const libraryScript=pageFlipBundle.source
    ?'<script>'+pageFlipBundle.source+'</'+'script>'
    :'<script src="'+pageFlipBundle.cdn+'"></'+'script>';
  const bodyClass='book-rendering';
  const html=[
    '<!doctype html>',
    '<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>'+title+'</title>',
    '<style>',
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,"Microsoft YaHei",sans-serif;background:#e9e8e4;color:#1b1b1b}body{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:100dvh;overflow:hidden}.top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;font-weight:700;background:#ffffffd9;backdrop-filter:blur(14px);z-index:5}.stage{position:relative;display:flex;align-items:center;justify-content:center;min-height:0;padding:26px 18px;overflow:hidden}.book-host{width:min(1200px,96vw);height:min(80dvh,848px);display:flex;align-items:center;justify-content:center}.share-page{position:relative;width:100%;height:100%;overflow:hidden;background:#fff}.share-page>img{display:block;width:100%;height:100%;object-fit:fill;user-select:none;-webkit-user-drag:none}.share-page.stf__item{position:absolute}.nav{display:flex;align-items:center;justify-content:center;gap:18px;padding:14px 20px 22px;z-index:5}.nav button{width:44px;height:44px;border:0;border-radius:50%;background:#fff;font-size:22px;box-shadow:0 4px 14px #0001;cursor:pointer;color:#222}.nav button:disabled{opacity:.3;cursor:default}.count{min-width:150px;text-align:center;color:#666;font-size:12px}.hint{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);font-size:10px;color:#777;white-space:nowrap;pointer-events:none}.single-static{width:min(600px,84vw)!important;height:auto!important;filter:drop-shadow(0 18px 22px #0003)}.single-static .share-page{display:block!important;position:relative!important;aspect-ratio:1200/1696}.book-rendering .stf__parent{filter:drop-shadow(0 15px 18px #00000028) drop-shadow(0 28px 30px #00000016)}.book-rendering .share-page{box-shadow:inset 0 0 0 1px #00000010}.book-rendering .share-page.--simple::after{content:"";position:absolute;inset:0;z-index:15;pointer-events:none;border:1px solid #00000012}.book-rendering .share-page[data-cover=true].--simple::after{display:none}.book-rendering .share-page.--simple.--left::after{background:linear-gradient(90deg,#00000008,transparent 3%,transparent 89%,#00000008 95%,#00000028 99%,#00000055)}.book-rendering .share-page.--simple.--right::after{background:linear-gradient(90deg,#00000040,#ffffff33 .6%,#00000015 2%,transparent 8%,transparent 97%,#00000008)}.load-error{position:absolute;inset:0;display:grid;place-items:center;padding:28px;text-align:center;color:#777;font-size:12px}.load-error[hidden]{display:none}@media(max-width:640px){.top{padding:13px 16px}.stage{padding:14px 6px}.book-host{width:98vw;height:72dvh}.nav{padding-bottom:max(16px,env(safe-area-inset-bottom))}.count{min-width:112px}.hint{display:none}}',
    '</style></head><body class="'+bodyClass+'"><div class="top"><span>'+title+'</span><span>FLIPBOOK</span></div><main class="stage" id="stage"><div class="book-host"><div id="book"></div></div><div id="load-error" class="load-error" hidden>翻页组件加载失败，请联网后重新打开这个文件。</div><span class="hint">拖动书角或滚轮翻页</span></main><div class="nav"><button id="prev" aria-label="上一页">‹</button><span id="count" class="count"></span><button id="next" aria-label="下一页">›</button></div>',
    libraryScript,
    '<script>const pages='+payload+',labels='+labels+',showCover='+String(showCover)+';const root=document.getElementById("book"),count=document.getElementById("count"),prev=document.getElementById("prev"),next=document.getElementById("next"),stage=document.getElementById("stage"),loadError=document.getElementById("load-error");function makeLeaf(src,label,density,cover,staticMode){const leaf=document.createElement("div");leaf.className="share-page";leaf.dataset.density=density;if(cover)leaf.dataset.cover="true";if(staticMode){leaf.style.position="relative";leaf.style.width="min(600px,48vw)";leaf.style.height="auto";leaf.style.aspectRatio="1200/1696";leaf.style.display="block";}const img=document.createElement("img");img.src=src;img.alt=label;leaf.appendChild(img);return leaf;}root.replaceChildren(...pages.map((src,i)=>makeLeaf(src,labels[i],showCover&&i===0?"hard":"soft",showCover&&i===0,false)));if(pages.length<=1){root.classList.add("single-static");count.textContent=labels[0]||"1 / 1";prev.disabled=true;next.disabled=true;}else if(!window.St||!window.St.PageFlip){loadError.hidden=false;let staticIndex=0;function renderStatic(){const coverOnly=showCover&&staticIndex===0,visible=coverOnly?[0]:[staticIndex,staticIndex+1].filter(i=>i<pages.length);root.classList.remove("single-static");root.style.display="flex";root.style.alignItems="center";root.style.justifyContent="center";root.style.width="min(1200px,96vw)";root.style.height="min(80dvh,848px)";root.replaceChildren(...visible.map(i=>makeLeaf(pages[i],labels[i],"soft",false,true)));count.textContent=coverOnly?(labels[0]||"封面"):(labels[staticIndex]||"")+(visible.length>1?"  ·  "+labels[staticIndex+1]:"");prev.disabled=staticIndex<=0;next.disabled=coverOnly?pages.length<=1:staticIndex+2>=pages.length;}function staticNext(){if(next.disabled)return;staticIndex=staticIndex===0&&showCover?1:Math.min(pages.length-1,staticIndex+2);renderStatic();}function staticPrev(){if(prev.disabled)return;staticIndex=staticIndex<=1&&showCover?0:Math.max(showCover?1:0,staticIndex-2);renderStatic();}prev.onclick=staticPrev;next.onclick=staticNext;addEventListener("keydown",e=>{if(e.key==="ArrowRight")staticNext();if(e.key==="ArrowLeft")staticPrev();});renderStatic();}else{const pageFlip=new St.PageFlip(root,{width:600,height:848,size:"stretch",minWidth:240,maxWidth:600,minHeight:339,maxHeight:848,drawShadow:true,flippingTime:620,usePortrait:true,startZIndex:0,autoSize:true,maxShadowOpacity:.28,showCover:showCover,mobileScrollSupport:true,clickEventForward:true,useMouseEvents:true,swipeDistance:28,showPageCorners:true,disableFlipByClick:false});pageFlip.loadFromHTML(document.querySelectorAll(".share-page"));function currentIndex(value){const n=Number(value);return Number.isFinite(n)?n:(pageFlip.getCurrentPageIndex?Number(pageFlip.getCurrentPageIndex()):0)||0;}function update(value){const index=currentIndex(value),coverOnly=showCover&&index===0,second=!coverOnly&&index+1<pages.length;count.textContent=coverOnly?(labels[0]||"封面"):(labels[index]||"")+(second?"  ·  "+labels[index+1]:"");prev.disabled=index<=0;next.disabled=coverOnly?pages.length<=1:index+2>=pages.length;}function flipPrevSafely(){const rect=pageFlip.getBoundsRect&&pageFlip.getBoundsRect(),controller=pageFlip.getFlipController&&pageFlip.getFlipController();if(controller&&controller.flip&&rect&&Number.isFinite(rect.left)){controller.flip({x:rect.left+10,y:1});return;}pageFlip.flipPrev("top");}function goNext(){if(!next.disabled)pageFlip.flipNext("top");}function goPrev(){if(!prev.disabled)flipPrevSafely();}pageFlip.on("flip",e=>update(e.data));pageFlip.on("init",e=>update(e.data&&e.data.page));pageFlip.on("update",e=>update(e.data&&e.data.page));prev.onclick=goPrev;next.onclick=goNext;addEventListener("keydown",e=>{if(e.key==="ArrowRight")goNext();if(e.key==="ArrowLeft")goPrev();});let wheelSum=0,wheelLocked=false,wheelTimer=0;stage.addEventListener("wheel",e=>{if(Math.abs(e.deltaY)<2)return;e.preventDefault();if(wheelLocked)return;wheelSum+=e.deltaY;if(Math.abs(wheelSum)<28)return;const forward=wheelSum>0;wheelSum=0;wheelLocked=true;forward?goNext():goPrev();clearTimeout(wheelTimer);wheelTimer=setTimeout(()=>wheelLocked=false,360);},{passive:false});update(0);}</'+'script></body></html>'
  ].join('');
  onProgress(1);
  return new Blob([html],{type:'text/html;charset=utf-8'});
}

export async function exportBook(book:Book,format:ExportFormat,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions={}):Promise<ExportArtifact>{
  const valid=[...new Set(indices)].filter(index=>index>=0&&index<book.pages.length).sort((a,b)=>a-b);
  if(!valid.length)throw new Error('请至少选择一页。');
  options={...defaultComposition,...options,pagesPerCollage:options.pagesPerCollage??(format==='collage'?4:1)};
  if(format==='share')options={...options,bookStyle:true};
  onProgress(0);
  if(format==='pdf'){
    const blobs=await renderCompositions(book,valid,quality,n=>onProgress(n*.82),options);
    const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.create();
    for(let i=0;i<blobs.length;i++){const image=await pdf.embedJpg(await blobs[i].arrayBuffer());const page=pdf.addPage([image.width/quality*.6,image.height/quality*.6]);page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});onProgress(.82+(i+1)/blobs.length*.16);}
    onProgress(1);return {blob:new Blob([new Uint8Array(await pdf.save())],{type:'application/pdf'}),extension:'pdf',suffix:'-book'};
  }
  if(format==='collage'){
    const blobs=await renderCompositions(book,valid,quality,n=>onProgress(n*.94),options);
    if(blobs.length===1){onProgress(1);return {blob:blobs[0],extension:'jpg',suffix:'-composition'};}
    const zip=await zipJpegs(blobs,blobs.map((_,i)=>i),'composition');onProgress(1);return {blob:zip,extension:'zip',suffix:'-compositions'};
  }
  if(format==='mp4')return {blob:await exportMp4(book,valid,quality,onProgress,options),extension:'mp4',suffix:'-live'};
  return {blob:await exportSharePage(book,valid,quality,onProgress,options),extension:'html',suffix:'-share'};
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
