import Konva from 'konva';
import type {Element,Page} from '../domain/model';
import {W,H} from '../domain/model';
import {repository} from '../db/repository';
import {decodeImage} from '../domain/assets';
export function imageCrop(element:Element,image:HTMLImageElement){
  const iw=image.naturalWidth,ih=image.naturalHeight;const ratio=element.width/element.height;
  let width=iw,height=ih;if(iw/ih>ratio)width=ih*ratio;else height=iw/ratio;
  const zoom=element.crop?.zoom??1;width/=zoom;height/=zoom;
  return {x:(iw-width)*(element.crop?.x??.5),y:(ih-height)*(element.crop?.y??.5),width,height};
}
export function elementProps(e:Element){return {id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,rotation:e.rotation,opacity:e.opacity,fill:e.color??'#252525',stroke:e.borderColor??'#fff',strokeWidth:e.border??0,shadowEnabled:!!e.shadow,shadowColor:'#000',shadowBlur:e.shadow?22:0,shadowOpacity:.18,shadowOffsetY:8};}
export function textProps(e:Element){return {...elementProps(e),text:e.text??'',fontSize:e.fontSize??60,fontFamily:e.fontFamily??'Domine',fontStyle:e.fontWeight===700?'bold':'normal',align:e.align??'left',lineHeight:1.2,wrap:'word' as const};}
export function photoProps(e:Element,image:HTMLImageElement){const common={...elementProps(e),image};if(e.fit==='contain'){const ratio=Math.min(e.width/image.naturalWidth,e.height/image.naturalHeight);return {...common,width:image.naturalWidth*ratio,height:image.naturalHeight*ratio};}return {...common,crop:imageCrop(e,image)};}
const images=new Map<string,Promise<HTMLImageElement>>();
export function loadAssetImage(id:string,quality:'preview'|'original'='preview'){
  const key=`${id}:${quality}`;if(!images.has(key)){images.set(key,repository.getAsset(id).then(a=>{if(!a)throw new Error('图片素材丢失，请重新上传。');return decodeImage(a[quality]);}).catch(e=>{images.delete(key);throw e;}));}return images.get(key)!;
}
export function clearImageCache(){images.clear();}
export async function loadStaticImage(url:string){const response=await fetch(url);if(!response.ok)throw new Error('背景素材加载失败');return decodeImage(await response.blob());}
export async function renderPage(page:Page,options:{scale?:number;quality?:'preview'|'original';mimeType?:'image/png'|'image/jpeg'}={}):Promise<Blob>{
  await document.fonts.ready;
  const holder=document.createElement('div');const stage=new Konva.Stage({container:holder,width:W,height:H});const layer=new Konva.Layer();stage.add(layer);
  try{layer.add(new Konva.Rect({width:W,height:H,fill:page.background}));if(page.pattern){const pattern=await loadStaticImage(`/reference/${page.pattern}`);layer.add(new Konva.Image({image:pattern,width:W,height:H,opacity:.55}));}
    for(const e of page.elements){if(e.type==='image'&&e.assetId){const img=await loadAssetImage(e.assetId,options.quality??'preview');layer.add(new Konva.Image(photoProps(e,img)));}else if(e.type==='text'||e.type==='sticker'){layer.add(new Konva.Text(textProps(e)));}else{layer.add(new Konva.Rect({...elementProps(e),cornerRadius:e.cornerRadius??0}));}}
    layer.draw();const canvas=stage.toCanvas({pixelRatio:options.scale??1});return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('页面渲染失败')),options.mimeType??'image/png',.95));
  }finally{stage.destroy();holder.remove();}
}
