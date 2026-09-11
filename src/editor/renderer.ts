import Konva from 'konva';
import type {Element,Page} from '../domain/model';
import {W,H,visualPageBackground} from '../domain/model';
import {effectiveTemplateOverlay,pageTemplateDecorations,type TemplateDecoration} from '../domain/templateDecorations';
import {polaroidAssetIdFor,polaroidPhotoFrame,polaroidTemplateFor} from '../domain/polaroids';
import {isPaperTapeElement,paperTapeStyleFor,type TapeStyleId} from '../domain/tapeStyles';
import {repository} from '../db/repository';
import {decodeImage} from '../domain/assets';
import {createWorkQueue} from '../domain/workQueue';
import {cropRect} from '../domain/crop';
export function imageCrop(element:Element,image:HTMLImageElement){
  return cropRect(element,{width:image.naturalWidth,height:image.naturalHeight},element.crop);
}
export function elementProps(e:Element){return {id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,opacity:e.opacity,fill:e.color??'#252525',stroke:e.borderColor??'#fff',strokeWidth:e.border??0,shadowEnabled:!!e.shadow,shadowColor:'#000',shadowBlur:e.shadow?22:0,shadowOpacity:.18,shadowOffsetY:8};}
export function paperTapeImageProps(e:Element,image:HTMLImageElement){return {id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,opacity:e.opacity,image};}
function textFontStyle(e:Element){return [e.fontWeight===700?'bold':'',e.fontStyle==='italic'?'italic':''].filter(Boolean).join(' ')||'normal';}
export function stickerLayout(e:Element){
  const fontSize=Math.max(Number.EPSILON,e.fontSize??60);
  const fontFamily=e.fontFamily??'Arial';
  const fontStyle=textFontStyle(e);
  const letterSpacing=e.letterSpacing??0;
  const probe=new Konva.Text({
    text:e.text??'',fontSize,fontFamily,fontStyle,lineHeight:1,letterSpacing,wrap:'none'
  });
  const width=Math.max(Number.EPSILON,probe.width());
  const height=Math.max(Number.EPSILON,probe.height());
  probe.destroy();
  return {x:e.x,y:e.y,width,height,fontStyle};
}
export function textLayout(e:Element){
  const fontSize=Math.max(1,e.fontSize??60);
  const fontFamily=e.fontFamily??'Domine';
  const fontStyle=textFontStyle(e);
  const lineHeight=e.lineHeight??1.2;
  const letterSpacing=e.letterSpacing??0;
  if(e.type==='sticker')return stickerLayout(e);
  if(e.type!=='text')return {x:e.x,y:e.y,width:e.width,height:e.height,fontStyle};

  const anchor=e.align??'left';
  const left=e.x;
  const center=e.x+e.width/2;
  const right=e.x+e.width;
  const pageAvailable=anchor==='center'
    ?Math.max(20,2*Math.min(center,W-center))
    :anchor==='right'
      ?Math.max(20,right)
      :Math.max(20,W-left);
  const storedWidth=Math.max(20,e.width);
  const crossesSpineIntent=e.x<0||e.x+storedWidth>W;
  const maxWidth=crossesSpineIntent
    ?Math.max(20,Math.min(W*2,Math.max(storedWidth,pageAvailable)))
    :Math.max(20,Math.min(W-20,pageAvailable));
  const probe=new Konva.Text({
    text:e.text??'',fontSize,fontFamily,fontStyle,lineHeight,letterSpacing,wrap:'word'
  });
  const naturalWidth=Math.max(20,Math.ceil(probe.width()||fontSize*.6));
  const fittedWidth=Math.min(maxWidth,naturalWidth);
  probe.width(fittedWidth);
  const fittedHeight=Math.max(Math.ceil(fontSize*lineHeight),Math.ceil(probe.height()));
  probe.destroy();

  const localShift=anchor==='center'?(e.width-fittedWidth)/2:anchor==='right'?e.width-fittedWidth:0;
  const radians=(e.rotation??0)*Math.PI/180;
  return {
    x:e.x+localShift*Math.cos(radians),
    y:e.y+localShift*Math.sin(radians),
    width:fittedWidth,
    height:fittedHeight,
    fontStyle,
  };
}
export function textProps(e:Element){const layout=textLayout(e),sticker=e.type==='sticker';return {...elementProps(e),...layout,text:e.text??'',fontSize:e.fontSize??60,fontFamily:e.fontFamily??(sticker?'Arial':'Domine'),fontStyle:layout.fontStyle,align:sticker?'left':e.align??'left',lineHeight:sticker?1:e.lineHeight??1.2,letterSpacing:e.letterSpacing??0,wrap:(sticker?'none':'word') as 'none'|'word'};}
export function frameClip(e:Element){return (ctx:Konva.Context)=>{ctx.beginPath();if(e.frameShape==='ellipse')ctx.ellipse(e.width/2,e.height/2,e.width/2,e.height/2,0,0,Math.PI*2);else ctx.rect(0,0,e.width,e.height);ctx.closePath();};}
export function photoProps(e:Element,image:HTMLImageElement){const common={...elementProps(e),image,strokeWidth:0,strokeEnabled:false};if(e.fit==='contain'){const ratio=Math.min(e.width/image.naturalWidth,e.height/image.naturalHeight);return {...common,width:image.naturalWidth*ratio,height:image.naturalHeight*ratio};}return {...common,crop:imageCrop(e,image)};}
export function templateDecorationProps(decoration:TemplateDecoration){return {x:decoration.x*W,y:decoration.y*H,width:decoration.width*W,height:decoration.height*H,stroke:decoration.stroke||'#111',strokeWidth:Math.max(.5,decoration.strokeWidth||1),fillEnabled:false,listening:false};}
export function pageTextureProps(image:HTMLImageElement){
  const sourceWidth=Math.max(1,image.naturalWidth||image.width||1);
  const sourceHeight=Math.max(1,image.naturalHeight||image.height||1);
  const sourceRatio=sourceWidth/sourceHeight;
  const pageRatio=W/H;
  let cropWidth=sourceWidth,cropHeight=sourceHeight;
  if(sourceRatio>pageRatio)cropWidth=sourceHeight*pageRatio;
  else cropHeight=sourceWidth/pageRatio;
  return {
    image,
    width:W,height:H,
    crop:{
      x:(sourceWidth-cropWidth)/2,
      y:(sourceHeight-cropHeight)/2,
      width:cropWidth,
      height:cropHeight,
    },
    opacity:.55,
    listening:false,
  };
}
const images=new Map<string,Promise<HTMLImageElement>>();
const imageBytes=new Map<string,number>();
const decodeQueue=createWorkQueue(3);
const imageCacheBudget=48*1024*1024;
function trimImageCache(){let bytes=[...imageBytes.values()].reduce((a,b)=>a+b,0);for(const key of images.keys()){if(bytes<=imageCacheBudget&&images.size<=96)break;const size=imageBytes.get(key);if(size===undefined)continue;bytes-=size;images.delete(key);imageBytes.delete(key);}}
export function loadAssetImage(id:string,quality:'thumbnail'|'preview'|'original'='preview'){
  const key=`${id}:${quality}`;
  const decode=()=>decodeQueue(async()=>{const asset=await repository.getAsset(id);if(!asset)throw new Error('图片素材丢失，请重新上传。');return decodeImage(asset[quality]);});
  if(quality==='original')return decode();
  const hit=images.get(key);if(hit){images.delete(key);images.set(key,hit);return hit;}
  const task=decode().then(image=>{if(images.get(key)===task){imageBytes.set(key,image.naturalWidth*image.naturalHeight*4);trimImageCache();}return image;}).catch(error=>{if(images.get(key)===task){images.delete(key);imageBytes.delete(key);}throw error;});
  images.set(key,task);return task;
}
const staticImages=new Map<string,Promise<HTMLImageElement>>();
export function loadStaticImage(url:string){if(!staticImages.has(url))staticImages.set(url,fetch(url).then(response=>{if(!response.ok)throw new Error('背景素材加载失败');return response.blob();}).then(decodeImage).catch(e=>{staticImages.delete(url);throw e;}));return staticImages.get(url)!;}
const tapeSvgSources=new Map<string,Promise<string>>();
const tapeImages=new Map<string,Promise<HTMLImageElement>>();
function normalizeTapeColor(value:string|undefined){
  const color=(value??'').trim();
  if(/^#[0-9a-f]{6}$/i.test(color))return color.toLowerCase();
  if(/^#[0-9a-f]{3}$/i.test(color)){
    const [r,g,b]=color.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '#d9c9a8';
}
function loadTapeSvg(url:string){
  if(!tapeSvgSources.has(url))tapeSvgSources.set(url,fetch(url).then(response=>{if(!response.ok)throw new Error('纸胶带纹理加载失败');return response.text();}).catch(error=>{tapeSvgSources.delete(url);throw error;}));
  return tapeSvgSources.get(url)!;
}
export function loadPaperTapeImage(styleId:TapeStyleId|undefined,color:string|undefined){
  const style=paperTapeStyleFor(styleId);
  const tint=normalizeTapeColor(color||style.defaultColor);
  const key=`${style.id}:${tint}`;
  const hit=tapeImages.get(key);if(hit)return hit;
  const task=loadTapeSvg(style.texture).then(svg=>{
    const tinted=svg.split(style.sourceColor).join(tint);
    return decodeImage(new Blob([tinted],{type:'image/svg+xml'}));
  }).catch(error=>{tapeImages.delete(key);throw error;});
  tapeImages.set(key,task);return task;
}
export function clearImageCache(){images.clear();imageBytes.clear();tapeImages.clear();}
export async function loadPageFonts(page:Page){await Promise.all(page.elements.filter(e=>e.type==='text'||e.type==='sticker').map(e=>document.fonts.load(`${e.fontStyle==='italic'?'italic ':''}${e.fontWeight===700?'bold ':''}${e.fontSize??60}px ${e.fontFamily??(e.type==='sticker'?'Arial':'Domine')}`).catch(()=>[])));}
export async function renderPage(page:Page,options:{scale?:number;quality?:'thumbnail'|'preview'|'original';mimeType?:'image/png'|'image/jpeg'}={}):Promise<Blob>{
  await loadPageFonts(page);
  const holder=document.createElement('div');const stage=new Konva.Stage({container:holder,width:W,height:H});const layer=new Konva.Layer();stage.add(layer);
  try{
    layer.add(new Konva.Rect({width:W,height:H,fill:visualPageBackground(page)}));
    const uploadedTexture=!!page.patternAssetId;
    const pattern=uploadedTexture
      ?await loadAssetImage(page.patternAssetId!,options.quality??'preview')
      :page.pattern?await loadStaticImage(`/reference/${page.pattern}`):undefined;
    if(pattern)layer.add(new Konva.Image(pageTextureProps(pattern)));
    const overlay=effectiveTemplateOverlay(page);
    const decorations=pageTemplateDecorations(page);
    const hasTemplateLayer=!!overlay||decorations.length>0;
    const ordered=hasTemplateLayer?[...page.elements.filter(e=>e.type==='image'),...page.elements.filter(e=>e.type!=='image')]:page.elements;
    let overlayAdded=false;
    const addOverlay=async()=>{if(overlayAdded)return;if(overlay)layer.add(new Konva.Image({image:await loadStaticImage(overlay),width:W,height:H,listening:false}));for(const decoration of decorations)layer.add(new Konva.Rect(templateDecorationProps(decoration)));overlayAdded=true;};
    for(const e of ordered){
      if(e.type!=='image')await addOverlay();
      if(e.type==='image'&&e.polaroidStyle){
        const frame=polaroidPhotoFrame(e);
        const template=polaroidTemplateFor(e.polaroidStyle);
        const group=new Konva.Group({x:e.x,y:e.y,rotation:e.rotation,opacity:e.opacity});
        group.add(new Konva.Rect({width:e.width,height:e.height,fill:'#faf9f5'}));
        const polaroidAssetId=polaroidAssetIdFor(e);
        if(polaroidAssetId){
          const img=await loadAssetImage(polaroidAssetId,options.quality??'preview');
          const photo=new Konva.Image({
            image:img,
            x:frame.x,y:frame.y,width:frame.width,height:frame.height,
            crop:cropRect({width:frame.width,height:frame.height},{width:img.naturalWidth,height:img.naturalHeight},e.crop),
          });
          if((e.blur??0)>0){photo.cache({pixelRatio:1});photo.filters([Konva.Filters.Blur]);photo.blurRadius(e.blur??0);}
          group.add(photo);
        }else group.add(new Konva.Rect({x:frame.x,y:frame.y,width:frame.width,height:frame.height,fill:'#e7e7e4'}));
        group.add(new Konva.Image({image:await loadStaticImage(template.overlay),width:e.width,height:e.height,listening:false}));
        layer.add(group);
      }else if(e.type==='image'&&e.assetId){
        const img=await loadAssetImage(e.assetId,options.quality??'preview');
        const group=new Konva.Group({x:e.x,y:e.y,rotation:e.rotation,clipFunc:frameClip(e)});
        const photo=new Konva.Image(photoProps({...e,x:0,y:0,rotation:0},img));
        if((e.blur??0)>0){photo.cache({pixelRatio:1});photo.filters([Konva.Filters.Blur]);photo.blurRadius(e.blur??0);}
        group.add(photo);layer.add(group);
      }else if(isPaperTapeElement(e))layer.add(new Konva.Image(paperTapeImageProps(e,await loadPaperTapeImage(e.tapeStyle,e.color))));
      else if(e.type==='text'||e.type==='sticker')layer.add(new Konva.Text(textProps(e)));
      else layer.add(new Konva.Rect({...elementProps(e),cornerRadius:e.cornerRadius??0}));
    }
    await addOverlay();
    layer.draw();const canvas=stage.toCanvas({pixelRatio:options.scale??1});return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('页面加载失败')),options.mimeType??'image/png',.95));
  }finally{stage.destroy();holder.remove();}
}
