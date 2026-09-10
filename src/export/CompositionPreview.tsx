import {useEffect,useRef,useState} from 'react';
import type {Book} from '../domain/model';
import {renderPage} from '../editor/renderer';
import {drawComposition,type CompositionOptions} from './composition';

export function CompositionPreview({book,indices,options,onChange,disabled}:{book:Book;indices:number[];options:CompositionOptions;onChange:(options:CompositionOptions)=>void;disabled:boolean}){
  const canvas=useRef<HTMLCanvasElement>(null),[images,setImages]=useState<ImageBitmap[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const key=indices.join(',');
  useEffect(()=>{
    let active=true;const loaded:ImageBitmap[]=[];
    setLoading(true);setError('');setImages([]);
    void (async()=>{try{
      for(const index of key.split(',').filter(Boolean).map(Number)){
        const image=await createImageBitmap(await renderPage(book.pages[index],{scale:.45,quality:'preview',mimeType:'image/jpeg'}));
        if(!active){image.close();return;}loaded.push(image);
      }
      if(active)setImages([...loaded]);
    }catch(e){if(active)setError(e instanceof Error?e.message:'预览失败');}finally{if(active)setLoading(false);}})();
    return ()=>{active=false;loaded.forEach(image=>image.close());};
  },[book,key]);
  useEffect(()=>{
    const frame=requestAnimationFrame(()=>{if(canvas.current)drawComposition(canvas.current,images.filter(image=>image.width>0),options,900);});
    return ()=>cancelAnimationFrame(frame);
  },[images,options]);
  return <div className="composition-preview">
    <div className="composition-stage" aria-busy={loading}><canvas ref={canvas} tabIndex={options.frame&&!disabled&&indices.length?0:-1} aria-label="导出画面预览，可用方向键移动，按住 Shift 加速，Home 复位" style={{cursor:options.frame&&!disabled?'grab':'default',visibility:indices.length?'visible':'hidden'}}
      onKeyDown={e=>{
        if(!options.frame||disabled)return;
        const step=e.shiftKey?.05:.01;
        const moves:Record<string,[number,number]>={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
        if(e.key==='Home'){e.preventDefault();onChange({...options,offsetX:0,offsetY:0,zoom:1});return;}
        const move=moves[e.key];if(!move)return;e.preventDefault();
        onChange({...options,offsetX:Math.max(-1,Math.min(1,(options.offsetX??0)+move[0])),offsetY:Math.max(-1,Math.min(1,(options.offsetY??0)+move[1]))});
      }}
      onPointerDown={e=>{if(!options.frame||disabled)return;drag.current={x:e.clientX,y:e.clientY,ox:options.offsetX??0,oy:options.offsetY??0};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!drag.current||disabled)return;const rect=e.currentTarget.getBoundingClientRect();onChange({...options,offsetX:Math.max(-1,Math.min(1,drag.current.ox+(e.clientX-drag.current.x)/rect.width)),offsetY:Math.max(-1,Math.min(1,drag.current.oy+(e.clientY-drag.current.y)/rect.height))});}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}/>
      {loading&&indices.length>0&&<span className="composition-status" role="status">正在生成预览…</span>}
      {!indices.length&&<div className="composition-empty"><b>先选择要导出的页面</b><span>选好后，这里会显示完整排版</span></div>}
    </div>
    {error&&<p role="alert" className="error">{error}</p>}
    <p className="export-hint">{options.frame?'拖动或使用方向键调整位置，按住 Shift 加速。超出相框的部分会裁切。':'预览与导出使用相同排版。最后一组不足时保留版式，单页居中。'}</p>
  </div>;
}
