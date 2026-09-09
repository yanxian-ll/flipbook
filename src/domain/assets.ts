import {uid,type StoredAsset} from './model';
export function decodeImage(blob:Blob):Promise<HTMLImageElement>{return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob);const image=new Image();image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片解码失败，请使用有效的 JPG、PNG 或 WebP 图片。'));};image.src=url;});}
async function resize(image:HTMLImageElement,max:number):Promise<Blob>{const ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('无法处理图片。')),'image/webp',0.88));}
export async function prepareAsset(file:File,batch?:{id:string;at:number}):Promise<StoredAsset>{
  if(!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type))throw new Error(`不支持 ${file.name}，请选择 JPG、PNG、WebP、GIF 或 AVIF。`);
  if(file.size>40*1024*1024)throw new Error(`${file.name} 超过 40MB，请压缩后重试。`);
  const image=await decodeImage(file);const id=uid();const ratio=image.naturalWidth/image.naturalHeight;
  return {id,name:file.name,mimeType:file.type,width:image.naturalWidth,height:image.naturalHeight,orientation:ratio>1.2?'landscape':ratio<0.8?'portrait':'square',storageKey:id,createdAt:Date.now(),uploadBatchId:batch?.id,uploadBatchAt:batch?.at,original:file,preview:await resize(image,1800),thumbnail:await resize(image,240)};
}
export function assetMetadata(asset:StoredAsset){const {original: _original,preview: _preview,thumbnail: _thumbnail,...metadata}=asset;void _original;void _preview;void _thumbnail;return metadata;}
