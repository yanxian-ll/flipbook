import {createWorkQueue} from '../domain/workQueue';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {visualPageBackground,type Page} from '../domain/model';
import {renderPage} from '../editor/renderer';
const renderQueue=createWorkQueue(2);
const cache=new WeakMap<Page,Map<number,Blob>>();
const pending=new WeakMap<Page,Map<number,Promise<Blob>>>();
const immediatePending=new WeakMap<Page,Map<number,Promise<Blob>>>();
function cached(page:Page,scale:number){return cache.get(page)?.get(scale);}
function store(page:Page,scale:number,blob:Blob){if(!cache.has(page))cache.set(page,new Map());cache.get(page)!.set(scale,blob);return blob;}
export function preloadPageThumbnail(page:Page,scale=.12):Promise<Blob>{
  const hit=cached(page,scale);if(hit)return Promise.resolve(hit);
  if(!pending.has(page))pending.set(page,new Map());
  const existing=pending.get(page)!.get(scale);if(existing)return existing;
  const task=renderQueue(()=>renderPage(page,{scale,quality:scale<=.2?'thumbnail':'preview'})).then(blob=>store(page,scale,blob)).finally(()=>pending.get(page)?.delete(scale));
  pending.get(page)!.set(scale,task);return task;
}

// Visible book leaves must never wait behind template/rail thumbnail work.
// They render directly at the requested scale and keep their own tiny dedupe map.
function preloadImmediatePageThumbnail(page:Page,scale:number):Promise<Blob>{
  const hit=cached(page,scale);if(hit)return Promise.resolve(hit);
  if(!immediatePending.has(page))immediatePending.set(page,new Map());
  const existing=immediatePending.get(page)!.get(scale);if(existing)return existing;
  const task=renderPage(page,{scale,quality:scale<=.2?'thumbnail':'preview'})
    .then(blob=>store(page,scale,blob))
    .finally(()=>immediatePending.get(page)?.delete(scale));
  immediatePending.get(page)!.set(scale,task);
  return task;
}
type ThumbnailProps={page:Page;alt?:string;scale?:number;immediate?:boolean};
// Book leaves never mount the observer-driven component: transforms must not
// decide whether the other half of an open spread has content.
export function PageThumbnail({immediate=false,...props}:ThumbnailProps){
  return immediate?<RenderedThumbnail {...props} immediate/>:<LazyThumbnail {...props}/>;
}
function LazyThumbnail(props:ThumbnailProps){
  const host=useRef<HTMLDivElement>(null),[visible,setVisible]=useState(false);
  useEffect(()=>{
    const node=host.current;if(!node)return;
    const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{rootMargin:'120px'});
    observer.observe(node);
    return()=>observer.disconnect();
  },[]);
  return <div ref={host} className="page-thumbnail-host" style={{width:'100%',height:'100%'}}>{visible?<RenderedThumbnail {...props} delay={200}/>:<div className="thumbnail-placeholder" style={{background:visualPageBackground(props.page)}}/>}</div>;
}
function RenderedThumbnail({page,alt='页面预览',scale=.12,delay=0,immediate=false}:ThumbnailProps&{delay?:number}){
  const [url,setUrl]=useState(''),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const currentUrl=useRef('');
  useEffect(()=>()=>{if(currentUrl.current)URL.revokeObjectURL(currentUrl.current);},[]);
  useLayoutEffect(()=>{
    let alive=true,timer:ReturnType<typeof setTimeout>|undefined;
    setError('');
    const show=(blob:Blob)=>{
      if(!alive)return;
      const next=URL.createObjectURL(blob),previous=currentUrl.current;
      currentUrl.current=next;setUrl(next);
      if(previous)URL.revokeObjectURL(previous);
    };
    const load=()=>void (immediate?preloadImmediatePageThumbnail(page,scale):preloadPageThumbnail(page,scale)).then(show).catch(e=>{if(alive)setError(e instanceof Error?e.message:'页面加载失败');});
    const hit=cached(page,scale);
    if(hit)show(hit);else if(delay)timer=setTimeout(load,delay);else load();
    return()=>{alive=false;if(timer)clearTimeout(timer);};
  },[page,scale,delay,retry,immediate]);
  return <div className="page-thumbnail-host" style={{width:'100%',height:'100%'}}>{error?<button className="thumbnail-retry" title={error} onClick={e=>{e.stopPropagation();setRetry(n=>n+1);}}>页面加载失败，点击重试</button>:url?<img src={url} alt={alt} decoding="async"/>:<div className="thumbnail-placeholder" aria-label="正在加载页面" style={{background:visualPageBackground(page)}}/>}</div>;
}
