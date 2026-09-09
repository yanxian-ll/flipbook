import Konva from 'konva';
import type {Element,Page} from '../domain/model';
import {W,H,visualPageBackground} from '../domain/model';
import {repository} from '../db/repository';
import {decodeImage} from '../domain/assets';
export function imageCrop(element:Element,image:HTMLImageElement){
  const iw=image.naturalWidth,ih=image.naturalHeight;const ratio=element.width/element.height;
  let width=iw,height=ih;if(iw/ih>ratio)width=ih*ratio;else height=iw/ratio;
  const zoom=element.crop?.zoom??1;width/=zoom;height/=zoom;
  return {x:(iw-width)*(element.crop?.x??.5),y:(ih-height)*(element.crop?.y??.5),width,height};
}
export function elementProps(e:Element){return {id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,opacity:e.opacity,fill:e.color??'#252525',stroke:e.borderColor??'#fff',strokeWidth:e.border??0,shadowEnabled:!!e.shadow,shadowColor:'#000',shadowBlur:e.shadow?22:0,shadowOpacity:.18,shadowOffsetY:8};}
export function textProps(e:Element){return {...elementProps(e),text:e.text??'',fontSize:e.fontSize??60,fontFamily:e.fontFamily??'Domine',fontStyle:e.fontWeight===700?'bold':'normal',align:e.align??'left',lineHeight:e.lineHeight??1.2,letterSpacing:e.letterSpacing??0,wrap:'word' as const};}
export function frameClip(e:Element){return (ctx:Konva.Context)=>{ctx.beginPath();if(e.frameShape==='ellipse')ctx.ellipse(e.width/2,e.height/2,e.width/2,e.height/2,0,0,Math.PI*2);else ctx.rect(0,0,e.width,e.height);ctx.closePath();};}
export function photoProps(e:Element,image:HTMLImageElement){const common={...elementProps(e),image,strokeWidth:0,strokeEnabled:false};if(e.fit==='contain'){const ratio=Math.min(e.width/image.naturalWidth,e.height/image.naturalHeight);return {...common,width:image.naturalWidth*ratio,height:image.naturalHeight*ratio};}return {...common,crop:imageCrop(e,image)};}
const images=new Map<string,Promise<HTMLImageElement>>();
export function loadAssetImage(id:string,quality:'preview'|'original'='preview'){
  const key=`${id}:${quality}`;if(!images.has(key)){images.set(key,repository.getAsset(id).then(a=>{if(!a)throw new Error('图片素材丢失，请重新上传。');return decodeImage(a[quality]);}).catch(e=>{images.delete(key);throw e;}));}return images.get(key)!;
}
export function clearImageCache(){images.clear();}
const staticImages=new Map<string,Promise<HTMLImageElement>>();
export function loadStaticImage(url:string){if(!staticImages.has(url))staticImages.set(url,fetch(url).then(response=>{if(!response.ok)throw new Error('背景素材加载失败');return response.blob();}).then(decodeImage).catch(e=>{staticImages.delete(url);throw e;}));return staticImages.get(url)!;}
export async function loadPageFonts(page:Page){await Promise.all(page.elements.filter(e=>e.type==='text').map(e=>document.fonts.load(`${e.fontWeight===700?'bold ':''}${e.fontSize??60}px ${e.fontFamily??'Domine'}`).catch(()=>[])));}
export async function renderPage(page:Page,options:{scale?:number;quality?:'preview'|'original';mimeType?:'image/png'|'image/jpeg'}={}):Promise<Blob>{
  await loadPageFonts(page);
  const holder=document.createElement('div');const stage=new Konva.Stage({container:holder,width:W,height:H});const layer=new Konva.Layer();stage.add(layer);
  try{layer.add(new Konva.Rect({width:W,height:H,fill:visualPageBackground(page)}));if(page.pattern){const pattern=await loadStaticImage(`/reference/${page.pattern}`);layer.add(new Konva.Image({image:pattern,width:W,height:H,opacity:.55}));}
    const ordered=page.templateOverlay?[...page.elements.filter(e=>e.type==='image'),...page.elements.filter(e=>e.type!=='image')]:page.elements;
    let overlayAdded=false;
    const addOverlay=async()=>{if(page.templateOverlay&&!overlayAdded){layer.add(new Konva.Image({image:await loadStaticImage(page.templateOverlay),width:W,height:H,listening:false}));overlayAdded=true;}};
    for(const e of ordered){if(e.type!=='image')await addOverlay();if(e.type==='image'&&e.assetId){const img=await loadAssetImage(e.assetId,options.quality??'preview');const group=new Konva.Group({x:e.x,y:e.y,rotation:e.rotation,clipFunc:frameClip(e)});group.add(new Konva.Image(photoProps({...e,x:0,y:0,rotation:0},img)));layer.add(group);}else if(e.type==='text'||e.type==='sticker'){layer.add(new Konva.Text(textProps(e)));}else{layer.add(new Konva.Rect({...elementProps(e),cornerRadius:e.cornerRadius??0}));}}
    await addOverlay();
    layer.draw();const canvas=stage.toCanvas({pixelRatio:options.scale??1});return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('页面渲染失败')),options.mimeType??'image/png',.95));
  }finally{stage.destroy();holder.remove();}
}
