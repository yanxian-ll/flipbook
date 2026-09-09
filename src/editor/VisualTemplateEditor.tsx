import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import type {Element} from '../domain/model';
import type {Slot} from '../domain/layouts';
import {repository} from '../db/repository';
import {Button} from '../components/ui';

type Handle='move'|'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w';
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export function resizeSlot(slot:Slot,handle:Handle,dx:number,dy:number):Slot{
  if(handle==='move')return {...slot,x:clamp(slot.x+dx,0,1-slot.width),y:clamp(slot.y+dy,0,1-slot.height)};
  let left=slot.x,top=slot.y,right=slot.x+slot.width,bottom=slot.y+slot.height;
  if(handle.includes('w'))left=clamp(left+dx,0,right-.04);
  if(handle.includes('e'))right=clamp(right+dx,left+.04,1);
  if(handle.includes('n'))top=clamp(top+dy,0,bottom-.04);
  if(handle.includes('s'))bottom=clamp(bottom+dy,top+.04,1);
  return {...slot,x:left,y:top,width:right-left,height:bottom-top};
}
// Snap only the moving edges; opposite edges and frame dimensions stay fixed.
export function snapSlot(slot:Slot,handle:Handle,width:number,height:number):Slot{
  const nearest=(values:number[],pixels:number)=>{
    const offsets=values.map(value=>Math.round(value/.05)*.05-value);
    const offset=offsets.reduce((a,b)=>Math.abs(a)<=Math.abs(b)?a:b);
    return Math.abs(offset)*pixels<=6?offset:0;
  };
  if(handle==='move')return resizeSlot(slot,'move',nearest([slot.x,slot.x+slot.width/2,slot.x+slot.width],width),nearest([slot.y,slot.y+slot.height/2,slot.y+slot.height],height));
  return resizeSlot(slot,handle,handle.includes('w')?nearest([slot.x],width):handle.includes('e')?nearest([slot.x+slot.width],width):0,handle.includes('n')?nearest([slot.y],height):handle.includes('s')?nearest([slot.y+slot.height],height):0);
}
export function VisualTemplateEditor({slots,onChange,assetIds,background,overlay,texts=[],maxSlots=9}:{slots:Slot[];onChange:(slots:Slot[])=>void;assetIds:string[];background:string;overlay?:string;texts?:Element[];maxSlots?:number}){
  const canvas=useRef<HTMLDivElement>(null);
  const gesture=useRef<{pointerId:number;index:number;handle:Handle;x:number;y:number;width:number;height:number;original:Slot[]}|null>(null);
  const [showGrid,setShowGrid]=useState(true),[snap,setSnap]=useState(true);
  const [selected,setSelected]=useState(0),[urls,setUrls]=useState<string[]>([]);
  useEffect(()=>{let alive=true;const created:string[]=[];void Promise.all(assetIds.slice(0,9).map(async id=>{const asset=await repository.getAsset(id);if(!alive||!asset)return '';const url=URL.createObjectURL(asset.thumbnail);created.push(url);return url;})).then(values=>{if(alive)setUrls(values);});return()=>{alive=false;created.forEach(url=>URL.revokeObjectURL(url));};},[assetIds.join('|')]);
  function begin(e:ReactPointerEvent<HTMLElement>,index:number,handle:Handle){if(e.button!==0||gesture.current)return;e.preventDefault();e.stopPropagation();const rect=canvas.current!.getBoundingClientRect();setSelected(index);gesture.current={pointerId:e.pointerId,index,handle,x:e.clientX,y:e.clientY,width:rect.width,height:rect.height,original:slots};e.currentTarget.setPointerCapture(e.pointerId);}
  function move(e:ReactPointerEvent<HTMLElement>){const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;onChange(g.original.map((slot,index)=>{if(index!==g.index)return slot;const next=resizeSlot(slot,g.handle,(e.clientX-g.x)/g.width,(e.clientY-g.y)/g.height);return snap&&!e.altKey?snapSlot(next,g.handle,g.width,g.height):next;}));}
  function end(e:ReactPointerEvent<HTMLElement>){const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;move(e);gesture.current=null;e.currentTarget.releasePointerCapture(e.pointerId);}
  function cancel(e:ReactPointerEvent<HTMLElement>){const g=gesture.current;if(!g||g.pointerId!==e.pointerId)return;onChange(g.original);gesture.current=null;}
  const active=slots[selected];
  return <div className="visual-template-editor"><div className="template-grid-tools"><label><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/>显示网格</label><label><input type="checkbox" checked={snap} onChange={e=>setSnap(e.target.checked)}/>吸附网格</label><span>每格 5%</span></div><div className="template-canvas" ref={canvas} style={{background}} aria-label="可视化模板画布">{slots.map((slot,index)=><div key={index} className={`template-frame ${selected===index?'selected':''}`} style={{left:`${slot.x*100}%`,top:`${slot.y*100}%`,width:`${slot.width*100}%`,height:`${slot.height*100}%`}}><button type="button" className="template-frame-body" style={{borderRadius:slot.shape==='ellipse'?'50%':0}} aria-label={`图框 ${index+1}，拖动移动`} aria-pressed={selected===index} onFocus={()=>setSelected(index)} onPointerDown={e=>begin(e,index,'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onKeyDown={e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();const step=e.shiftKey?.02:.005;onChange(slots.map((s,i)=>i===index?resizeSlot(s,'move',e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0):s));}}>{urls[index%urls.length]&&<img src={urls[index%urls.length]} alt="" draggable={false}/>}<span>{index+1}</span></button>{selected===index&&(['nw','n','ne','e','se','s','sw','w'] as Handle[]).map(handle=><button key={handle} type="button" className={`template-resize-handle handle-${handle}`} aria-label={`图框 ${index+1} ${handle} 调整大小`} onPointerDown={e=>begin(e,index,handle)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}/>)}</div>)}{texts.map(text=><span key={text.id} className="template-text-preview" style={{left:`${text.x/12}%`,top:`${text.y/16.96}%`,width:`${text.width/12}%`,fontSize:`${(text.fontSize??60)/12}cqw`,fontFamily:text.fontFamily,color:text.color,lineHeight:text.lineHeight??1.2,textAlign:text.align,fontWeight:text.fontWeight}}>{text.text}</span>)}{overlay&&<img className="template-decoration" src={overlay} alt="模板装饰"/>}{showGrid&&<div className="template-alignment-grid" aria-hidden="true"><i/><b/></div>}</div><p className="muted centered">拖动图框移动，拖动蓝色控制点调整大小；按住 Alt 暂停吸附，方向键微调</p><div className="template-frame-actions"><Button disabled={slots.length>=maxSlots} onClick={()=>{onChange([...slots,{x:.25,y:.25,width:.5,height:.35}]);setSelected(slots.length);}}>添加图框</Button><Button disabled={!active} onClick={()=>onChange(slots.map((slot,i)=>i===selected?{...slot,shape:slot.shape==='ellipse'?undefined:'ellipse'}:slot))}>{active?.shape==='ellipse'?'改为矩形':'改为圆形'}</Button><Button disabled={slots.length<=1||!active} onClick={()=>{onChange(slots.filter((_,i)=>i!==selected));setSelected(Math.max(0,selected-1));}}>删除图框</Button></div></div>;
}
