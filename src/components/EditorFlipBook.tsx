import {Children,Component,forwardRef,useEffect,useImperativeHandle,useRef,useState,type ForwardedRef,type ReactNode} from 'react';
import HTMLFlipBook from 'react-pageflip';
import type {Book} from '../domain/model';
import {BookCoverEditor,BookCoverVisual} from './BookCover';
import {PageThumbnail} from './PageThumbnail';
import {EditorCanvas} from '../editor/EditorCanvas';
import {Plus} from 'lucide-react';
import {useEditor} from '../store/editor';

export type EditorFlipBookHandle={
  flipNext:()=>void;
  flipPrev:()=>void;
  flipTo:(page:number)=>void;
  turnTo:(page:number)=>void;
  current:()=>number;
};

type LeafProps={
  book:Book;
  index:number;
  kind:'page'|'add'|'blank'|'back';
  active:boolean;
  priority:boolean;
  width:number;
  onSelect:(index:number)=>void;
  onAddPage:()=>void;
  onTextEdit:()=>void;
  onCrop:()=>void;
  onImageSelect:()=>void;
  onBlankPage:()=>void;
  onOpenCover:()=>void;
  onInteractionChange:(active:boolean)=>void;
  scale:number;
};

function LiveEditorSurface({children,onInteractionChange}:{children:ReactNode;onInteractionChange?:(active:boolean)=>void}){
  const surface=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=surface.current;if(!node)return;
    const stop=(event:Event)=>event.stopPropagation();
    const events=['mousedown','pointerdown','touchstart'] as const;
    for(const type of events)node.addEventListener(type,stop,{passive:false});
    return()=>{for(const type of events)node.removeEventListener(type,stop);};
  },[]);
  return <div
    ref={surface}
    className="editor-flip-live"
    onPointerEnter={()=>onInteractionChange?.(true)}
    onPointerLeave={()=>onInteractionChange?.(false)}
  >{children}</div>;
}

function FlipLeafInner(
  {book,index,kind,active,priority,width,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage,onOpenCover,onInteractionChange,scale}:LeafProps,
  ref:ForwardedRef<HTMLDivElement>
){
  if(kind==='back')return <div ref={ref} className="editor-flip-page editor-flip-back" data-density="hard" style={{backgroundColor:book.pages[0]?.background??'#f2efe4'}} aria-hidden><span className="cover-grain"/><span className="cover-spine"/></div>;
  if(kind==='blank')return <div ref={ref} className="editor-flip-page editor-flip-blank" aria-hidden/>;
  if(kind==='add')return <div ref={ref} className="editor-flip-page editor-flip-add">
    <button aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={28}/></button>
  </div>;

  const page=book.pages[index];
  if(!page)return <div ref={ref} className="editor-flip-page editor-flip-blank" aria-hidden/>;

  return <div ref={ref} className={`editor-flip-page ${index===0?'editor-flip-cover':''}`} data-book-side={index===0?'cover':index%2===1?'left':'right'} data-density={index===0?'hard':'soft'}>
    {index===0
      ?active
        ?<LiveEditorSurface onInteractionChange={onInteractionChange}><BookCoverEditor book={book} width={width} onTextEdit={onTextEdit} onImageSelect={onImageSelect} onOpen={onOpenCover}/></LiveEditorSurface>
        :<BookCoverVisual book={book} className="editor-flip-cover-visual"/>
      :active
        ?<LiveEditorSurface onInteractionChange={onInteractionChange}>
          <EditorCanvas page={page} width={width} onTextEdit={onTextEdit} onCrop={onCrop} onImageSelect={onImageSelect} onBackgroundClick={onBlankPage}/>
        </LiveEditorSurface>
        :<>
          <PageThumbnail page={page} scale={scale} immediate={priority}/>
          <button
            className="editor-flip-select-page"
            aria-label={`编辑第 ${index} 页`}
            onClick={e=>{e.stopPropagation();onSelect(index);if(!page.elements.some(element=>element.type==='image'))onBlankPage();}}
          />
        </>
    }
  </div>;
}
const FlipLeaf=forwardRef(FlipLeafInner);
FlipLeaf.displayName='FlipLeaf';

type EditorFlipBookProps={
  book:Book;
  pageWidth:number;
  activeIndex:number;
  onFlip:(index:number)=>void;
  onSelect:(index:number)=>void;
  onAddPage:()=>void;
  onTextEdit:()=>void;
  onCrop:()=>void;
  onImageSelect:()=>void;
  onBlankPage:()=>void;
};

/**
 * page-flip@2.0.7 calculates programmatic previous turns from x=10
 * instead of rect.left+10. When the book is centered in a wider workspace,
 * that point sits outside the book and the reverse turn is distorted.
 * User-driven drags already provide the correct global pointer coordinate.
 */
function flipPrevSafely(pageFlip:any){
  const rect=pageFlip?.getBoundsRect?.();
  const controller=pageFlip?.getFlipController?.();
  if(controller?.flip&&rect&&Number.isFinite(rect.left)){
    controller.flip({x:rect.left+10,y:1});
    return;
  }
  pageFlip?.flipPrev?.('top');
}

function flipToSafely(pageFlip:any,page:number){
  if(!pageFlip)return;
  const collection=pageFlip.getPageCollection?.();
  const currentSpread=collection?.getCurrentSpreadIndex?.();
  const targetSpread=collection?.getSpreadIndexByPage?.(page);
  if(Number.isFinite(currentSpread)&&Number.isFinite(targetSpread)&&targetSpread<currentSpread){
    try{
      collection.setCurrentSpreadIndex(targetSpread+1);
      flipPrevSafely(pageFlip);
      return;
    }catch{
      // Fall back to the public API if the internal spread state changed.
    }
  }
  pageFlip.flip?.(page,'top');
}

type BoundaryProps={resetKey:string;fallback:ReactNode;children:ReactNode};
class FlipBookBoundary extends Component<BoundaryProps,{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidUpdate(prev:BoundaryProps){
    if(prev.resetKey!==this.props.resetKey&&this.state.failed)this.setState({failed:false});
  }
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function StaticBookFallback({book,pageWidth,activeIndex,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage}:Omit<EditorFlipBookProps,'onFlip'>){
  const pageHeight=Math.round(pageWidth*1696/1200);
  if(activeIndex===0){
    return <div className="editor-pageflip-shell static-book-fallback is-cover" style={{width:pageWidth*2,height:pageHeight}}>
      <div className="editor-fallback-cover" style={{width:pageWidth,height:pageHeight}}><BookCoverEditor book={book} width={pageWidth} onTextEdit={onTextEdit} onImageSelect={onImageSelect} onOpen={()=>onSelect(Math.min(1,book.pages.length-1))}/></div>
    </div>;
  }
  const leftIndex=activeIndex%2===1?activeIndex:activeIndex-1;
  const rightIndex=leftIndex+1;
  const renderPage=(index:number,side:'left'|'right')=>{
    const page=book.pages[index];
    if(!page)return <div className={`editor-fallback-page ${side} blank`} style={{width:pageWidth,height:pageHeight}}/>;
    const active=index===activeIndex;
    return <div className={`editor-fallback-page ${side}`} style={{width:pageWidth,height:pageHeight}}>
      {active
        ?<EditorCanvas page={page} width={pageWidth} onTextEdit={onTextEdit} onCrop={onCrop} onImageSelect={onImageSelect} onBackgroundClick={onBlankPage}/>
        :<><PageThumbnail page={page} scale={.4} immediate/><button className="editor-flip-select-page" aria-label={`编辑第 ${index} 页`} onClick={()=>{onSelect(index);if(!page.elements.some(element=>element.type==='image'))onBlankPage();}}/></>}
    </div>;
  };
  return <div className="editor-pageflip-shell static-book-fallback" style={{width:pageWidth*2,height:pageHeight}}>
    <div className="editor-fallback-spread">
      {renderPage(leftIndex,'left')}
      {renderPage(rightIndex,'right')}
      <div className="spine-shadow"/>
    </div>
    {rightIndex>=book.pages.length&&<button className="editor-fallback-add" onClick={onAddPage} aria-label="添加新页"><Plus size={26}/></button>}
  </div>;
}

function EditorFlipBookInner(
  {book,pageWidth,activeIndex,onFlip,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage}:EditorFlipBookProps,
  ref:ForwardedRef<EditorFlipBookHandle>
){
  const flip=useRef<any>(null);
  const [editingSurfaceHovered,setEditingSurfaceHovered]=useState(false);
  const [displayedIndex,setDisplayedIndex]=useState(activeIndex);
  const hasSelectedElement=useEditor(state=>state.selected.length>0);
  const nativeFlipLocked=editingSurfaceHovered||hasSelectedElement;
  const safeWidth=Math.max(40,Math.floor(pageWidth));
  const pageHeight=Math.round(safeWidth*1696/1200);
  const imageScale=Math.max(.24,Math.min(.5,safeWidth/1200*1.15));
  const lastReal=Math.max(0,book.pages.length-1);
  const plusIndex=book.pages.length;
  const needsFiller=lastReal%2===0;
  const backIndex=plusIndex+(needsFiller?2:1);

  useImperativeHandle(ref,()=>({
    flipNext:()=>flip.current?.pageFlip?.().flipNext?.('top'),
    flipPrev:()=>flipPrevSafely(flip.current?.pageFlip?.()),
    flipTo:(page:number)=>flipToSafely(flip.current?.pageFlip?.(),Math.max(0,Math.min(lastReal,page))),
    turnTo:(page:number)=>flip.current?.pageFlip?.().turnToPage?.(Math.max(0,Math.min(lastReal,page))),
    current:()=>flip.current?.pageFlip?.().getCurrentPageIndex?.()??0,
  }),[lastReal]);

  const resetKey=`${book.id}:${book.pages.map(page=>page.id).join('.') }:${safeWidth}`;
  useEffect(()=>setDisplayedIndex(activeIndex),[activeIndex,resetKey]);
  const openCover=()=>flip.current?.pageFlip?.().flipNext?.();
  const leafProps={book,width:safeWidth,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage,onOpenCover:openCover,onInteractionChange:setEditingSurfaceHovered,scale:imageScale};

  const fallback=<StaticBookFallback
    book={book}
    pageWidth={safeWidth}
    activeIndex={Math.max(0,Math.min(lastReal,activeIndex))}
    onSelect={onSelect}
    onAddPage={onAddPage}
    onTextEdit={onTextEdit}
    onCrop={onCrop}
    onImageSelect={onImageSelect}
    onBlankPage={onBlankPage}
  />;

  if(!book.pages.length)return fallback;

  return <FlipBookBoundary resetKey={resetKey} fallback={fallback}>
    <div className={`editor-pageflip-shell ${displayedIndex===0?'is-cover':''} ${displayedIndex>=backIndex?'is-back-cover':''} ${nativeFlipLocked?'native-flip-locked':''}`} style={{width:safeWidth*2,height:pageHeight}}>
      <HTMLFlipBook
        key={resetKey}
        ref={flip}
        width={safeWidth}
        height={pageHeight}
        size="fixed"
        minWidth={safeWidth}
        maxWidth={safeWidth}
        minHeight={pageHeight}
        maxHeight={pageHeight}
        drawShadow
        flippingTime={620}
        usePortrait={false}
        startZIndex={0}
        autoSize={false}
        maxShadowOpacity={.28}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents={!nativeFlipLocked}
        swipeDistance={28}
        showPageCorners={!nativeFlipLocked}
        disableFlipByClick
        startPage={Math.max(0,Math.min(lastReal,activeIndex))}
        className="editor-flip-book"
        style={{}}
        onFlip={(e:any)=>{
          const index=Number(e.data);
          if(!Number.isFinite(index)||index<0)return;
          setDisplayedIndex(index);
          if(index<=lastReal)onFlip(index);
        }}
      >
        {Children.toArray([
          ...book.pages.map((_,index)=><FlipLeaf key={book.pages[index].id} {...leafProps} index={index} kind="page" active={activeIndex===index} priority={Math.abs(index-activeIndex)<=3}/>),
          <FlipLeaf key="__add__" {...leafProps} index={plusIndex} kind="add" active={false} priority={false}/>,
          needsFiller?<FlipLeaf key="__blank__" {...leafProps} index={plusIndex+1} kind="blank" active={false} priority={false}/>:null,
          <FlipLeaf key="__back__" {...leafProps} index={backIndex} kind="back" active={false} priority={false}/>
        ])}
      </HTMLFlipBook>
      {activeIndex>0&&<button className="editor-flip-nav-zone previous" aria-label="翻到上一跨页" onClick={()=>flipPrevSafely(flip.current?.pageFlip?.())}/>}
      {activeIndex<lastReal&&<button className="editor-flip-nav-zone next" aria-label="翻到下一跨页" onClick={()=>flip.current?.pageFlip?.().flipNext?.('top')}/>}
    </div>
  </FlipBookBoundary>;
}

export const EditorFlipBook=forwardRef(EditorFlipBookInner);
EditorFlipBook.displayName='EditorFlipBook';
