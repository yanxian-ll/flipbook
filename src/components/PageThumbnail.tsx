import {useLayoutEffect,useState} from 'react';
import {visualPageBackground,type Page} from '../domain/model';
import {renderPage} from '../editor/renderer';
const cache=new WeakMap<Page,Map<number,Blob>>();
const pending=new WeakMap<Page,Map<number,Promise<Blob>>>();
function cached(page:Page,scale:number){return cache.get(page)?.get(scale);}
function store(page:Page,scale:number,blob:Blob){if(!cache.has(page))cache.set(page,new Map());cache.get(page)!.set(scale,blob);return blob;}
export function preloadPageThumbnail(page:Page,scale=.12):Promise<Blob>{
  const hit=cached(page,scale);if(hit)return Promise.resolve(hit);
  if(!pending.has(page))pending.set(page,new Map());
  const existing=pending.get(page)!.get(scale);if(existing)return existing;
  const task=renderPage(page,{scale}).then(blob=>store(page,scale,blob)).finally(()=>pending.get(page)?.delete(scale));
  pending.get(page)!.set(scale,task);return task;
}
export function PageThumbnail({page,alt='页面预览',scale=.12,immediate=false}:{page:Page;alt?:string;scale?:number;immediate?:boolean}){
  const [url,setUrl]=useState('');
  useLayoutEffect(()=>{let alive=true,objectUrl='',timer:ReturnType<typeof setTimeout>|undefined;
    const show=(blob:Blob)=>{if(!alive)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);};
    const hit=cached(page,scale);
    if(hit)show(hit);
    else if(immediate)void preloadPageThumbnail(page,scale).then(show).catch(()=>{});
    else timer=setTimeout(()=>{void preloadPageThumbnail(page,scale).then(show).catch(()=>{});},200);
    return()=>{alive=false;if(timer)clearTimeout(timer);if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[page,scale,immediate]);
  return url?<img src={url} alt={alt}/>:<div className="thumbnail-placeholder" style={{background:visualPageBackground(page)}}/>;
}
