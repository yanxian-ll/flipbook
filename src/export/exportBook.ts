import type {Book} from '../domain/model';
import {H,backCoverFor,backCoverPage} from '../domain/model';
import {presentationPage} from '../domain/coverPresentation';
import {repository} from '../db/repository';
import {drawComposition,compositionGeometry,defaultComposition,type CompositionOptions} from './composition';
import {renderPage} from '../editor/renderer';
import {flipbookMotion,readerLeafPlan,shareViewerSizeForScale} from '../flipbook/spec';
import {buildShareHtmlDocument} from './shareHtml';
import {loadEmbeddedPageFlipBundle} from './pageFlipBundle';

export type ExportFormat='collage'|'mp4'|'pdf'|'share';
export type ExportOptions=CompositionOptions&{compressionQuality?:number};
export interface ExportArtifact{blob:Blob;extension:'jpg'|'zip'|'pdf'|'mp4'|'html';suffix:string}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
function wait(ms:number){return new Promise<void>(resolve=>window.setTimeout(resolve,ms));}
function nextFrame(){return new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));}
function canvasBlob(canvas:HTMLCanvasElement,type:string,quality=.95){return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('导出图片失败。')),type,quality));}
async function blobToDataUrl(blob:Blob){return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error??new Error('读取导出文件失败。'));reader.readAsDataURL(blob);});}
async function transcodeBlob(blob:Blob,type:'image/jpeg'|'image/webp',quality:number){
  const image=await createImageBitmap(blob);
  try{
    const canvas=document.createElement('canvas');
    canvas.width=image.width;
    canvas.height=image.height;
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('无法创建压缩画布。');
    ctx.drawImage(image,0,0);
    return await canvasBlob(canvas,type,quality);
  }finally{image.close();}
}
function sourceQuality(scale:number){return scale<=1?'preview' as const:'original' as const;}
async function renderSharePages(book:Book,indices:number[],scale:number,compressionQuality:number,onProgress:(n:number)=>void,progressEnd=.78){
  const blobs:Blob[]=[];
  for(let i=0;i<indices.length;i++){
    const page=presentationPage(book,indices[i]);
    if(!page)continue;
    const source=await renderPage(page,{scale,quality:sourceQuality(scale),mimeType:'image/jpeg'});
    blobs.push(await transcodeBlob(source,'image/webp',compressionQuality));
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
async function renderCompositions(book:Book,indices:number[],scale:number,onProgress:(n:number)=>void,options:ExportOptions,compressionQuality:number){
  const count=compositionGeometry(options).count,output:Blob[]=[];
  for(let offset=0;offset<indices.length;offset+=count){
    const images:ImageBitmap[]=[];
    try{
      for(const index of indices.slice(offset,offset+count))images.push(await createImageBitmap(await renderPage(presentationPage(book,index),{scale:Math.min(scale,2),quality:sourceQuality(scale),mimeType:'image/jpeg'})));
      const canvas=document.createElement('canvas');
      drawComposition(canvas,images,options,Math.round(H*scale));
      output.push(await canvasBlob(canvas,'image/jpeg',compressionQuality));
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
async function exportMp4(book:Book,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions,compressionQuality:number){
  const mimeType=mp4MimeType();
  if(!mimeType)throw new Error('当前浏览器暂不支持直接编码 MP4，请使用最新版 Safari、Chrome 或 Edge。');
  if(typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('当前浏览器暂不支持视频导出。');
  const scale=clamp(quality,.35,1.1);
  const blobs=await renderCompositions(book,indices,scale,n=>onProgress(n*.42),options,Math.max(.8,compressionQuality));
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
  const videoBitsPerSecond=Math.round(800_000+Math.pow(compressionQuality,2)*8_000_000);
  const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond});
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
async function loadCoverTextureDataUrl(){
  try{
    const response=await fetch('/reference/cover-texture.png');
    if(!response.ok)return '';
    return await blobToDataUrl(await response.blob());
  }catch{
    return '';
  }
}

function safeWorkspaceColor(value:string|undefined){return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value??'')?value!:'#e9eaec';}
function workspaceTint(hex:string,alpha=.45){
  const normalized=hex.slice(1);
  const value=normalized.length===3?normalized.split('').map(char=>char+char).join(''):normalized;
  const number=parseInt(value,16);
  return `rgba(${number>>16},${number>>8&255},${number&255},${alpha})`;
}
async function loadWorkspaceBackgroundCss(book:Book){
  const color=safeWorkspaceColor(book.workspaceBackground);
  const textureId=book.workspaceTextureId;
  const imageId=textureId??book.workspaceImageId;
  if(imageId){
    try{
      const asset=await repository.getAsset(imageId);
      if(asset){
        const image=await blobToDataUrl(asset.preview);
        if(textureId){
          const tint=workspaceTint(color);
          return `html,body{background-color:${color};background-image:linear-gradient(${tint},${tint}),url("${image}");background-size:auto,clamp(720px,70vw,960px) auto;background-position:center,center;background-repeat:no-repeat,repeat}`;
        }
        return `html,body{background-color:${color};background-image:url("${image}");background-size:cover;background-position:center;background-repeat:no-repeat}`;
      }
    }catch{/* Fall back to the saved color below. */}
  }
  if(book.workspacePattern){
    try{
      const response=await fetch(`/reference/${encodeURIComponent(book.workspacePattern)}`);
      if(response.ok){
        const image=await blobToDataUrl(await response.blob());
        const tint=workspaceTint(color);
        const size=book.workspacePattern.startsWith('bg-')?'clamp(560px,55vw,760px) auto':'clamp(720px,70vw,960px) auto';
        return `html,body{background-color:${color};background-image:linear-gradient(${tint},${tint}),url("${image}");background-size:auto,${size};background-position:center,center;background-repeat:no-repeat,repeat}`;
      }
    }catch{/* Fall back to the saved color below. */}
  }
  return `html,body{background-color:${color}}`;
}

function tuneShareViewerHtml(html:string,workspaceCss:string){
  const autoplayDelay='const autoplayDelay=Math.max(3600,(Number(viewerConfig.flippingTime)||620)+2400);';
  const fastAutoplay='const autoplayDelay=200,autoplayFlipDuration=180;';
  const flipCall='    pageFlip.flipNext(viewerConfig.corner);';
  const fastFlip=[
    '    const autoplaySettings=autoPlaying&&pageFlip.getSettings?pageFlip.getSettings():null;',
    '    const normalFlippingTime=autoplaySettings?autoplaySettings.flippingTime:0;',
    '    if(autoplaySettings)autoplaySettings.flippingTime=autoplayFlipDuration;',
    '    pageFlip.flipNext(viewerConfig.corner);',
    '    if(autoplaySettings)setTimeout(()=>{if(autoplaySettings.flippingTime===autoplayFlipDuration)autoplaySettings.flippingTime=normalFlippingTime;},190);',
  ].join('\n');
  return html
    .replace(autoplayDelay,fastAutoplay)
    .replace(flipCall,fastFlip)
    .replace('</head>',`<style>${workspaceCss}</style></head>`);
}

async function exportSharePage(book:Book,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions,compressionQuality:number){
  void options;
  const scale=clamp(quality,.35,3);
  const blobs=await renderSharePages(book,indices,scale,compressionQuality,n=>onProgress(n*.68),1);
  const pages:string[]=[];
  for(let i=0;i<blobs.length;i++){
    pages.push(await blobToDataUrl(blobs[i]));
    onProgress(.68+(i+1)/blobs.length*.18);
  }

  const labels=indices.map(index=>index===0?'封面':'第 '+index+' 页');
  const showCover=indices[0]===0;
  const back=backCoverFor(book);
  const [pageFlipSource,coverTexture,backSource,workspaceCss]=await Promise.all([
    loadEmbeddedPageFlipBundle(),
    loadCoverTextureDataUrl(),
    showCover?renderPage(backCoverPage(book),{scale,quality:sourceQuality(scale),mimeType:'image/jpeg'}):Promise.resolve(null),
    loadWorkspaceBackgroundCss(book),
  ]);
  const backBlob=backSource?await transcodeBlob(backSource,'image/webp',compressionQuality):null;
  const backPage=backBlob?await blobToDataUrl(backBlob):'';
  onProgress(.92);

  const libraryScript='<script>'+pageFlipSource+'</'+'script>';

  const html=tuneShareViewerHtml(buildShareHtmlDocument({
    title:book.title,
    pages,
    labels,
    showCover,
    coverTexture,
    backColor:back.backgroundMode==='match-front'?(book.pages[0]?.background??back.background):back.background,
    backPage,
    leafPlan:readerLeafPlan(pages.length),
    viewerConfig:{...shareViewerSizeForScale(scale),...flipbookMotion},
    libraryScript,
  }),workspaceCss);

  onProgress(1);
  return new Blob([html],{type:'text/html;charset=utf-8'});
}

export async function exportBook(book:Book,format:ExportFormat,indices:number[],quality:number,onProgress:(n:number)=>void,options:ExportOptions={}):Promise<ExportArtifact>{
  const valid=[...new Set(indices)].filter(index=>index>=0&&index<book.pages.length).sort((a,b)=>a-b);
  if(!valid.length)throw new Error('请至少选择一页。');
  const resolutionScale=clamp(quality,.35,3);
  const compressionQuality=clamp(options.compressionQuality??.78,.35,.98);
  options={...defaultComposition,...options,pagesPerCollage:options.pagesPerCollage??(format==='collage'?4:1)};
  if(format==='share')options={...options,bookStyle:true};
  onProgress(0);
  if(format==='pdf'){
    const blobs=await renderCompositions(book,valid,resolutionScale,n=>onProgress(n*.82),options,compressionQuality);
    const {PDFDocument}=await import('pdf-lib');const pdf=await PDFDocument.create();
    for(let i=0;i<blobs.length;i++){const image=await pdf.embedJpg(await blobs[i].arrayBuffer());const page=pdf.addPage([image.width/resolutionScale*.6,image.height/resolutionScale*.6]);page.drawImage(image,{x:0,y:0,width:page.getWidth(),height:page.getHeight()});onProgress(.82+(i+1)/blobs.length*.16);}
    onProgress(1);return {blob:new Blob([new Uint8Array(await pdf.save({useObjectStreams:true}))],{type:'application/pdf'}),extension:'pdf',suffix:'-book'};
  }
  if(format==='collage'){
    const blobs=await renderCompositions(book,valid,resolutionScale,n=>onProgress(n*.94),options,compressionQuality);
    if(blobs.length===1){onProgress(1);return {blob:blobs[0],extension:'jpg',suffix:'-composition'};}
    const zip=await zipJpegs(blobs,blobs.map((_,i)=>i),'composition');onProgress(1);return {blob:zip,extension:'zip',suffix:'-compositions'};
  }
  if(format==='mp4')return {blob:await exportMp4(book,valid,resolutionScale,onProgress,options,compressionQuality),extension:'mp4',suffix:'-live'};
  return {blob:await exportSharePage(book,valid,resolutionScale,onProgress,options,compressionQuality),extension:'html',suffix:'-share'};
}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60_000);}
