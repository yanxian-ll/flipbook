import {useEffect,useRef,useState,type RefObject} from 'react';
import {ChevronsLeft,ChevronsRight,Plus,Trash2} from 'lucide-react';
import type {Book} from '../../domain/model';
import {IconButton} from '../../components/ui';
import {PageThumbnail} from '../../components/PageThumbnail';
import type {EditorFlipBookHandle} from '../../components/EditorFlipBook';
import {useEditor} from '../../store/editor';
import {useCoverContext} from '../../store/coverContext';

type ViewMode='spread'|'page';

export function EditorPreviewRail({book,mode,flipBook,onAddPage,onRequestDelete}:{
  book:Book;
  mode:ViewMode;
  flipBook:RefObject<EditorFlipBookHandle|null>;
  onAddPage:()=>void;
  onRequestDelete:()=>void;
}){
  const pageIndex=useEditor(state=>state.pageIndex);
  const coverSide=useCoverContext(state=>state.side);
  const [overflow,setOverflow]=useState(false);
  const [dragSpread,setDragSpread]=useState<number|null>(null);
  const [dragOverSpread,setDragOverSpread]=useState<number|null>(null);
  const strip=useRef<HTMLDivElement>(null);
  const suppressClick=useRef(false);
  const thumbnailSpreads=Array.from({length:Math.ceil(Math.max(0,book.pages.length-1)/2)},(_,index)=>1+index*2);

  useEffect(()=>{
    const node=strip.current;if(!node)return;
    const selected=node.querySelector<HTMLElement>('.selected');if(!selected)return;
    const left=selected.getBoundingClientRect().left-node.getBoundingClientRect().left+node.scrollLeft-(node.clientWidth-selected.offsetWidth)/2;
    node.scrollTo({left:Math.max(0,left),behavior:Math.abs(left-node.scrollLeft)>node.clientWidth?'auto':'smooth'});
  },[pageIndex,mode,book.pages.length]);

  useEffect(()=>{
    const node=strip.current;if(!node){setOverflow(false);return;}
    const update=()=>setOverflow(node.scrollWidth>node.clientWidth+2);
    update();
    const observer=new ResizeObserver(update);
    observer.observe(node);
    const track=node.querySelector<HTMLElement>('.page-strip-track');
    if(track)observer.observe(track);
    return()=>observer.disconnect();
  },[pageIndex,mode,book.pages.length]);

  if(pageIndex===0)return null;

  const jumpTo=(index:number)=>{flipBook.current?.turnTo(index);useEditor.getState().setPage(index);};
  const dropSpread=(targetStart:number)=>{
    const from=dragSpread;
    setDragSpread(null);setDragOverSpread(null);
    if(from===null||from===targetStart)return;
    suppressClick.current=true;
    useEditor.getState().reorderSpread(from,targetStart);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      flipBook.current?.turnTo(useEditor.getState().pageIndex);
      window.setTimeout(()=>{suppressClick.current=false;},0);
    }));
  };
  const railClass=`page-strip clean-page-strip ${mode==='spread'?'spread-preview-strip':'single-preview-strip'} ${overflow?'has-overflow':'fits-content'}`;
  const deleteButton=coverSide===null&&pageIndex>0?<button className="thumbnail-add-page thumbnail-delete-page" type="button" aria-label={`删除第 ${pageIndex} 页`} title={`删除第 ${pageIndex} 页`} onClick={onRequestDelete}><Trash2 size={15}/></button>:null;

  if(mode==='spread')return <div className={railClass} aria-label="双页预览">
    <IconButton label="跳到第一页" disabled={pageIndex<=1} onClick={()=>jumpTo(Math.min(1,book.pages.length-1))}><ChevronsLeft size={18}/></IconButton>
    <div ref={strip} className="page-strip-scroll"><div className="page-strip-track">
      <button className="cover-spread-thumb" aria-label="封面" onClick={()=>flipBook.current?.flipTo(0)}><PageThumbnail page={book.pages[0]}/></button>
      {thumbnailSpreads.map(start=>{
        const left=book.pages[start],right=book.pages[start+1],selectedSpread=pageIndex===start||pageIndex===start+1;
        return <button
          key={left.id}
          draggable
          className={`spread-thumb ${selectedSpread?'selected':''} ${dragSpread===start?'dragging':''} ${dragOverSpread===start&&dragSpread!==start?'drag-over':''}`}
          aria-label={right?`第 ${start}–${start+1} 页，可拖动排序`:`第 ${start} 页，可拖动排序`}
          onClick={()=>{if(suppressClick.current)return;flipBook.current?.flipTo(start);useEditor.getState().setPage(start);}}
          onDragStart={event=>{suppressClick.current=true;setDragSpread(start);setDragOverSpread(start);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(start));}}
          onDragEnter={event=>{event.preventDefault();if(dragSpread!==null&&dragSpread!==start)setDragOverSpread(start);}}
          onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';if(dragSpread!==null&&dragSpread!==start)setDragOverSpread(start);}}
          onDrop={event=>{event.preventDefault();dropSpread(start);}}
          onDragEnd={()=>{setDragSpread(null);setDragOverSpread(null);window.setTimeout(()=>{suppressClick.current=false;},0);}}
        ><div className="spread-thumb-page"><PageThumbnail page={left}/></div><div className={`spread-thumb-page ${right?'':'blank'}`}>{right&&<PageThumbnail page={right}/>}</div></button>;
      })}
    </div></div>
    <button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={17}/></button>
    {deleteButton}
    <IconButton label="跳到最后一页" disabled={pageIndex===book.pages.length-1} onClick={()=>jumpTo(book.pages.length-1)}><ChevronsRight size={18}/></IconButton>
  </div>;

  return <div className={railClass} aria-label="单页预览">
    <IconButton label="跳到第一页" disabled={pageIndex<=1} onClick={()=>jumpTo(Math.min(1,book.pages.length-1))}><ChevronsLeft size={18}/></IconButton>
    <div ref={strip} className="page-strip-scroll"><div className="page-strip-track">
      {book.pages.map((page,index)=><button key={page.id} className={`single-page-thumb ${pageIndex===index?'selected':''}`} aria-label={index===0?'封面':`第 ${index} 页`} onClick={()=>useEditor.getState().setPage(index)}><PageThumbnail page={page}/></button>)}
    </div></div>
    <button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={17}/></button>
    {deleteButton}
    <IconButton label="跳到最后一页" disabled={pageIndex===book.pages.length-1} onClick={()=>jumpTo(book.pages.length-1)}><ChevronsRight size={18}/></IconButton>
  </div>;
}
