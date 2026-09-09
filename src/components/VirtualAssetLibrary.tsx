import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import type {Asset} from '../domain/model';
export type AssetBatch={id:string;at:number;legacy:boolean;assets:Asset[]};
export function VirtualAssetLibrary({batches,label,renderAsset}:{batches:AssetBatch[];label:(batch:AssetBatch,index:number)=>ReactNode;renderAsset:(asset:Asset)=>ReactNode}){
  const host=useRef<HTMLDivElement>(null);
  const [viewport,setViewport]=useState({width:280,top:0,height:400});
  useEffect(()=>{const node=host.current,scroll=node?.closest('.panel-body');if(!node||!scroll)return;let frame=0;
    const measure=()=>{frame=0;const a=node.getBoundingClientRect(),b=scroll.getBoundingClientRect();setViewport(previous=>{const next={width:a.width,top:b.top-a.top,height:b.height};return previous.width===next.width&&previous.top===next.top&&previous.height===next.height?previous:next;});};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};const resize=new ResizeObserver(schedule);resize.observe(node);resize.observe(scroll);scroll.addEventListener('scroll',schedule,{passive:true});measure();return()=>{cancelAnimationFrame(frame);resize.disconnect();scroll.removeEventListener('scroll',schedule);};
  },[]);
  const columns=viewport.width<230?2:3,tile=(viewport.width-8*(columns-1))/columns;
  const {rows,height}=useMemo(()=>{let y=0;const rows:{top:number;height:number;batch?:AssetBatch;batchIndex?:number;assets?:Asset[]}[]=[];batches.forEach((batch,index)=>{rows.push({top:y,height:36,batch,batchIndex:index});y+=36;for(let i=0;i<batch.assets.length;i+=columns){rows.push({top:y,height:tile,assets:batch.assets.slice(i,i+columns)});y+=tile+8;}y+=12;});return {rows,height:y};},[batches,columns,tile]);
  const start=viewport.top-200,end=viewport.top+viewport.height+200;
  const visible=rows.filter(row=>row.top+row.height>=start&&row.top<=end);
  return <div ref={host} className="virtual-asset-library" style={{height,position:'relative'}} aria-label={`素材库，共 ${batches.reduce((sum,b)=>sum+b.assets.length,0)} 张未选照片`}>{visible.map(row=>row.batch?<div key={row.batch.id} className="asset-batch-header" style={{position:'absolute',top:row.top,left:0,right:0,height:row.height}}><span>{label(row.batch,row.batchIndex!)}</span><small>{row.batch.assets.length} 张</small></div>:<div key={row.assets![0].id} className="asset-grid virtual-asset-row" style={{position:'absolute',top:row.top,left:0,right:0,height:tile,gridTemplateColumns:`repeat(${columns},1fr)`,margin:0}}>{row.assets!.map(asset=>renderAsset(asset))}</div>)}</div>;
}
