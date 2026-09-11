import {useEffect,useRef,useState,type RefObject} from 'react';
import {ChevronsLeft,ChevronsRight,Plus,Trash2} from 'lucide-react';
import {backCoverPage,type Book} from '../../domain/model';
import {presentationPage} from '../../domain/coverPresentation';
import {IconButton} from '../../components/ui';
import {PageThumbnail} from '../../components/PageThumbnail';
import type {EditorFlipBookHandle} from '../../components/EditorFlipBook';
import {useEditor} from '../../store/editor';
import {useCoverContext} from '../../store/coverContext';

type ViewMode='spread'|'page';

function spreadAnchor(index:number){
  if(index<=0)return 0;
  return index%2===0?index-1:index;
}

export function EditorPreviewRail({book,mode,flipBook,onNavigatePage,onAddPage,onRequestDelete}:{
  book:Book;
  mode:ViewMode;
  flipBook:RefObject<EditorFlipBookHandle|null>;
  onNavigatePage:(index:number)=>void;
  onAddPage:()=>void;
  onRequestDelete:()=>void;
}){
  const pageIndex=useEditor(state=>state.pageIndex);
  const selectedPages=useEditor(state=>state.selectedPages);
  const coverSide=useCoverContext(state=>state.side);
  const [overflow,setOverflow]=useState(false);
  const [dragSpread,setDragSpread]=useState<number|null>(null);
  const [dragOverSpread,setDragOverSpread]=useState<number|null>(null);
  const strip=useRef<HTMLDivElement>(null);
  const suppressClick=useRef(false);
  const selectedPageSet=new Set(selectedPages);
  const thumbnailSpreads=Array.from({length:Math.ceil(Math.max(0,book.pages.length-1)/2)},(_,index)=>1+index*2);
  const backPage=backCoverPage(book);
  const backActive=coverSide==='back';

  useEffect(()=>{
    const node=strip.current;if(!node)return;
    const selected=node.querySelector<HTMLElement>('.preview-page-active');if(!selected)return;
    const left=selected.getBoundingClientRect().left-node.getBoundingClientRect().left+node.scrollLeft-(node.clientWidth-selected.offsetWidth)/2;
    node.scrollTo({left:Math.max(0,left),behavior:Math.abs(left-node.scrollLeft)>node.clientWidth?'auto':'smooth'});
  },[pageIndex,mode,book.pages.length,coverSide]);

  useEffect(()=>{
    const node=strip.current;if(!node){setOverflow(false);return;}
    const update=()=>setOverflow(node.scrollWidth>node.clientWidth+2);
    update();
    const observer=new ResizeObserver(update);
    observer.observe(node);
    const track=node.querySelector<HTMLElement>('.page-strip-track');
    if(track)observer.observe(track);
    return()=>observer.disconnect();
  },[pageIndex,mode,book.pages.length,coverSide]);

  if(pageIndex===0&&!backActive)return null;

  const commitSpreadTarget=(index:number)=>{
    const state=useEditor.getState();
    flipBook.current?.turnTo(spreadAnchor(index));
    // page-flip reports the visible spread anchor from turnToPage. Re-apply the
    // clicked logical page after that report so clicking a right-hand thumbnail
    // edits the right page instead of being overwritten by the left page.
    requestAnimationFrame(()=>requestAnimationFrame(()=>state.selectPreviewPage(index,false)));
  };
  const selectPreviewPage=(index:number,multi=false)=>{
    const state=useEditor.getState();
    if(multi&&index<book.pages.length){
      const activeIndex=state.pageIndex;
      state.selectPreviewPage(index,true);
      if(useEditor.getState().pageIndex!==activeIndex)useEditor.setState({pageIndex:activeIndex});
      return;
    }
    if(mode==='page'){
      onNavigatePage(index);
      return;
    }
    if(index>=book.pages.length){
      flipBook.current?.turnTo(index);
      return;
    }
    commitSpreadTarget(index);
  };
  const jumpTo=(index:number)=>{
    if(mode==='page'){
      onNavigatePage(index);
      return;
    }
    if(index>=book.pages.length){flipBook.current?.turnTo(index);return;}
    commitSpreadTarget(index);
  };
  const dropSpread=(targetStart:number)=>{
    const from=dragSpread;
    setDragSpread(null);setDragOverSpread(null);
    if(from===null||from===targetStart)return;
    suppressClick.current=true;
    useEditor.getState().reorderSpread(from,targetStart);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      flipBook.current?.turnTo(spreadAnchor(useEditor.getState().pageIndex));
      window.setTimeout(()=>{suppressClick.current=false;},0);
    }));
  };
  const railClass=`page-strip clean-page-strip ${mode==='spread'?'spread-preview-strip':'single-preview-strip'} ${overflow?'has-overflow':'fits-content'}`;
  const selectedDeleteCount=selectedPages.reduce((count,id)=>count+Number(book.pages.findIndex(page=>page.id===id)>0),0);
  const deleteCount=selectedDeleteCount||Number(pageIndex>0);
  const deleteLabel=deleteCount>1?`删除选中的 ${deleteCount} 页`:`删除第 ${pageIndex} 页`;
  const deleteButton=coverSide===null&&pageIndex>0?<button className="thumbnail-add-page thumbnail-delete-page" type="button" data-page-delete-trigger aria-label={deleteLabel} title={deleteLabel} onClick={onRequestDelete}><Trash2 size={15}/></button>:null;

  if(mode==='spread')return <div className={railClass} aria-label="双页预览">
    <IconButton label="跳到第一页" disabled={pageIndex<=1} onClick={()=>jumpTo(Math.min(1,book.pages.length-1))}><ChevronsLeft size={18}/></IconButton>
    <div ref={strip} className="page-strip-scroll"><div className="page-strip-track">
      <button className="cover-spread-thumb" aria-label="封面" onClick={()=>selectPreviewPage(0,false)}><PageThumbnail page={book.pages[0]}/></button>
      {thumbnailSpreads.map(start=>{
        const left=book.pages[start],right=book.pages[start+1];
        const leftRender=presentationPage(book,start),rightRender=right?presentationPage(book,start+1):undefined;
        const leftSelected=selectedPageSet.has(left.id),rightSelected=!!right&&selectedPageSet.has(right.id);
        const leftActive=pageIndex===start&&!backActive,rightActive=!!right&&pageIndex===start+1&&!backActive;
        return <button
          key={left.id}
          draggable
          className={`spread-thumb ${dragSpread===start?'dragging':''} ${dragOverSpread===start&&dragSpread!==start?'drag-over':''}`}
          aria-label={right?`第 ${start}–${start+1} 页，可点击单页；按 Ctrl 或 Command 可多选；可拖动排序`:`第 ${start} 页，可点击选择；按 Ctrl 或 Command 可多选；可拖动排序`}
          onClick={event=>{
            if(suppressClick.current)return;
            const rect=event.currentTarget.getBoundingClientRect();
            const target=right&&event.clientX>=rect.left+rect.width/2?start+1:start;
            selectPreviewPage(target,event.ctrlKey||event.metaKey);
          }}
          onDragStart={event=>{suppressClick.current=true;setDragSpread(start);setDragOverSpread(start);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(start));}}
          onDragEnter={event=>{event.preventDefault();if(dragSpread!==null&&dragSpread!==start)setDragOverSpread(start);}}
          onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';if(dragSpread!==null&&dragSpread!==start)setDragOverSpread(start);}}
          onDrop={event=>{event.preventDefault();dropSpread(start);}}
          onDragEnd={()=>{setDragSpread(null);setDragOverSpread(null);window.setTimeout(()=>{suppressClick.current=false;},0);}}
        >
          <div className={`spread-thumb-page ${leftSelected?'preview-page-selected':''} ${leftActive?'preview-page-active':''}`}><PageThumbnail page={leftRender}/></div>
          <div className={`spread-thumb-page ${right?'':'blank'} ${rightSelected?'preview-page-selected':''} ${rightActive?'preview-page-active':''}`}>{rightRender&&<PageThumbnail page={rightRender}/>}</div>
        </button>;
      })}
    </div></div>
    <button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={17}/></button>
    {deleteButton}
    <IconButton label="跳到最后一页" disabled={pageIndex===book.pages.length-1&&!backActive} onClick={()=>jumpTo(book.pages.length-1)}><ChevronsRight size={18}/></IconButton>
  </div>;

  return <div className={railClass} aria-label="单页预览">
    <IconButton label="跳到第一页" disabled={pageIndex<=1&&!backActive} onClick={()=>jumpTo(Math.min(1,book.pages.length-1))}><ChevronsLeft size={18}/></IconButton>
    <div ref={strip} className="page-strip-scroll"><div className="page-strip-track">
      {book.pages.map((page,index)=>{
        const selected=selectedPageSet.has(page.id),active=!backActive&&pageIndex===index;
        const rendered=index===0?page:presentationPage(book,index);
        return <button
          key={page.id}
          className={`single-page-thumb ${active?'selected':''} ${selected?'preview-page-selected':''} ${active?'preview-page-active':''}`}
          aria-label={index===0?'封面':`第 ${index} 页${index>0?'；按 Ctrl 或 Command 可多选':''}`}
          aria-current={active?'page':undefined}
          onClick={event=>selectPreviewPage(index,index>0&&(event.ctrlKey||event.metaKey))}
        ><PageThumbnail page={rendered}/></button>;
      })}
      <button
        key={backPage.id}
        className={`single-page-thumb back-cover-thumb ${backActive?'selected preview-page-active':''}`}
        aria-label="后封面"
        aria-current={backActive?'page':undefined}
        onClick={()=>selectPreviewPage(book.pages.length,false)}
      ><PageThumbnail page={backPage}/></button>
    </div></div>
    <button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={17}/></button>
    {deleteButton}
    <IconButton label="跳到后封面" disabled={backActive} onClick={()=>jumpTo(book.pages.length)}><ChevronsRight size={18}/></IconButton>
  </div>;
}
