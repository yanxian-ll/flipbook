import {useEffect,useState} from 'react';
import type {Page} from '../domain/model';
import {renderPage} from '../editor/renderer';
const cache=new WeakMap<Page,Map<number,Blob>>();
export function PageThumbnail({page,alt='页面预览',scale=.12}:{page:Page;alt?:string;scale?:number}){const [url,setUrl]=useState('');useEffect(()=>{let alive=true,url='';const timer=setTimeout(()=>{const cached=cache.get(page)?.get(scale);void (cached?Promise.resolve(cached):renderPage(page,{scale})).then(blob=>{if(!cache.has(page))cache.set(page,new Map());cache.get(page)!.set(scale,blob);if(alive){url=URL.createObjectURL(blob);setUrl(url);}}).catch(()=>{});},200);return()=>{alive=false;clearTimeout(timer);URL.revokeObjectURL(url);};},[page,scale]);return url?<img src={url} alt={alt}/>:<div className="thumbnail-placeholder" style={{background:page.background}}/>;}
