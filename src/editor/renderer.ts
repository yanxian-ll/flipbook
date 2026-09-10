import Konva from 'konva';
import type {Element,Page} from '../domain/model';
import {W,H,visualPageBackground} from '../domain/model';
import {repository} from '../db/repository';
import {decodeImage} from '../domain/assets';
import {createWorkQueue} from '../domain/workQueue';
import {cropRect} from '../domain/crop';
export function imageCrop(element:Element,image:HTMLImageElement){
  return cropRect(element,{width:image.naturalWidth,height:image.naturalHeight},element.crop);
}
export function elementProps(e:Element){return {id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,opacity:e.opacity,fill:e.color??'#252525',stroke:e.borderColor??'#fff',strokeWidth:e.border??0,shadowEnabled:!!e.shadow,shadowColor:'#000',shadowBlur:e.shadow?22:0,shadowOpacity:.18,shadowOffsetY:8};}
export function textProps(e:Element){const style=[e.fontWeight===700?'bold':'',e.fontStyle==='italic'?'italic':''].filter(Boolean).join(' ')||'normal';return {...elementProps(e),text:e.text??'',fontSize:e.fontSize??60,fontFamily:e.fontFamily??'Domine',fontStyle:style,align:e.align??'left',lineHeight:e.lineHeight??1.2,letterSpacing:e.letterSpacing??0,wrap:'word' as const};}
export function frameClip(e:Element){return (ctx:Konva.Context)=>{ctx.beginPath();if(e.frameShape==='ellipse')ctx.ellipse(e.width/2,e.height/2,e.width/2,e.height/2,0,0,Math.PI*2);else ctx.rect(0,0,e.width,e.height);ctx.closePath();};}
export function photoProps(e:Element,image:HTMLImageElement){const common={...elementProps(e),image,strokeWidth:0,strokeEnabled:false};if(e.fit==='contain'){const ratio=Math.min(e.width/image.naturalWidth,e.height/image.naturalHeight);return {...common,width:image.naturalWidth*ratio,height:image.naturalHeight*ratio};}return {...common,crop:imageCrop(e,image)};}
export function pageTextureProps(image:HTMLImageElement,uploaded:boolean){
  const sourceWidth=Math.max(1,image.naturalWidth||image.width||1);
  const targetWidth=uploaded?420:240;
  const patternScale=targetWidth/sourceWidth;
  return {width:W,height:H,fillPatternImage:image,fillPatternRepeat:'repeat' as const,fillPatternScaleX:patternScale,fillPatternScaleY:patternScale,opacity:.55};
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
export function clearImageCache(){images.clear();imageBytes.clear();}
const staticImages=new Map<string,Promise<HTMLImageElement>>();
export function loadStaticImage(url:string){if(!staticImages.has(url))staticImages.set(url,fetch(url).then(response=>{if(!response.ok)throw new Error('背景素材加载失败');return response.blob();}).then(decodeImage).catch(e=>{staticImages.delete(url);throw e;}));return staticImages.get(url)!;}
export async function loadPageFonts(page:Page){await Promise.all(page.elements.filter(e=>e.type==='text').map(e=>document.fonts.load(`${e.fontStyle==='italic'?'italic ':''}${e.fontWeight===700?'bold ':''}${e.fontSize??60}px ${e.fontFamily??'Domine'}`).catch(()=>[])));}
export async function renderPage(page:Page,options:{scale?:number;quality?:'thumbnail'|'preview'|'original';mimeType?:'image/png'|'image/jpeg'}={}):Promise<Blob>{
  await loadPageFonts(page);
  const holder=document.createElement('div');const stage=new Konva.Stage({container:holder,width:W,height:H});const layer=new Konva.Layer();stage.add(layer);
  try{
    layer.add(new Konva.Rect({width:W,height:H,fill:visualPageBackground(page)}));
    const uploadedTexture=!!page.patternAssetId;
    const pattern=uploadedTexture
      ?await loadAssetImage(page.patternAssetId!,options.quality??'preview')
      :page.pattern?await loadStaticImage(`/reference/${page.pattern}`):undefined;
    if(pattern)layer.add(new Konva.Rect(pageTextureProps(pattern,uploadedTexture)));
    const ordered=page.templateOverlay?[...page.elements.filter(e=>e.type==='image'),...page.elements.filter(e=>e.type!=='image')]:page.elements;
    let overlayAdded=false;
    const addOverlay=async()=>{if(page.templateOverlay&&!overlayAdded){layer.add(new Konva.Image({image:await loadStaticImage(page.templateOverlay),width:W,height:H,listening:false}));overlayAdded=true;}};
    for(const e of ordered){if(e.type!=='image')await addOverlay();if(e.type==='image'&&e.assetId){const img=await loadAssetImage(e.assetId,options.quality??'preview');const group=new Konva.Group({x:e.x,y:e.y,rotation:e.rotation,clipFunc:frameClip(e)});const photo=new Konva.Image(photoProps({...e,x:0,y:0,rotation:0},img));if((e.blur??0)>0){photo.cache({pixelRatio:1});photo.filters([Konva.Filters.Blur]);photo.blurRadius(e.blur??0);}group.add(photo);layer.add(group);}else if(e.type==='text'||e.type==='sticker'){layer.add(new Konva.Text(textProps(e)));}else{layer.add(new Konva.Rect({...elementProps(e),cornerRadius:e.cornerRadius??0}));}}
    await addOverlay();
    layer.draw();const canvas=stage.toCanvas({pixelRatio:options.scale??1});return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('页面渲染失败')),options.mimeType??'image/png',.95));
  }finally{stage.destroy();holder.remove();}
}
