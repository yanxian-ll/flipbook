import {Children,Component,forwardRef,memo,useEffect,useImperativeHandle,useMemo,useRef,useState,type ForwardedRef,type ReactNode} from 'react';
import HTMLFlipBook from 'react-pageflip';
import {visualPageBackground,type Book} from '../domain/model';
import {BookBackCoverVisual,BookCoverEditor,BookCoverVisual} from './BookCover';
import {PageThumbnail} from './PageThumbnail';
import {EditorCanvas} from '../editor/EditorCanvas';
import {Plus} from 'lucide-react';
import {useEditor} from '../store/editor';
import {useCoverContext} from '../store/coverContext';
import {editorLeafPlan,flipPrevSafely,flipToSafely,flipbookMotion} from '../flipbook/spec';

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
  if(kind==='back')return <div ref={ref} className="editor-flip-page editor-flip-back" data-density="hard" aria-label="后封面"><BookBackCoverVisual book={book} className="editor-back-cover-visual"/></div>;
  if(kind==='blank')return <div ref={ref} className="editor-flip-page editor-flip-blank" aria-hidden/>;
  if(kind==='add')return <div ref={ref} className="editor-flip-page editor-flip-add" aria-hidden/>;

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
          {priority?<PageThumbnail page={page} scale={scale} immediate/>:<div className="thumbnail-placeholder editor-flip-distant-placeholder" style={{background:visualPageBackground(page)}}/>}
          <button
            className="editor-flip-select-page"
            aria-label={`编辑第 ${index} 页`}
            onClick={e=>{e.stopPropagation();onSelect(index);if(!page.elements.some(element=>element.type==='image'))onBlankPage();}}
          />
        </>
    }
  </div>;
}
const ForwardedFlipLeaf=forwardRef(FlipLeafInner);
ForwardedFlipLeaf.displayName='FlipLeaf';
const FlipLeaf=memo(ForwardedFlipLeaf,(prev,next)=>{
  if(prev.index!==next.index||prev.kind!==next.kind||prev.active!==next.active||prev.priority!==next.priority||prev.width!==next.width||prev.scale!==next.scale)return false;
  if(prev.kind==='page'){
    if(prev.book.pages[prev.index]!==next.book.pages[next.index])return false;
    if(prev.index===0&&prev.book.coverTemplate!==next.book.coverTemplate)return false;
    return true;
  }
  if(prev.kind==='back'){
    return prev.book.backCover===next.book.backCover
      &&prev.book.bookStyle===next.book.bookStyle
      &&prev.book.customCoverTemplates===next.book.customCoverTemplates
      &&prev.book.pages[0]?.background===next.book.pages[0]?.background;
  }
  return true;
});
FlipLeaf.displayName='MemoFlipLeaf';

type EditorFlipBookProps={
  book:Book;
  pageWidth:number;
  activeIndex:number;
  interactionMode?:'spread'|'single';
  onFlip:(index:number)=>void;
  onFlipState?:(state:string)=>void;
  onSelect:(index:number)=>void;
  onAddPage:()=>void;
  onTextEdit:()=>void;
  onCrop:()=>void;
  onImageSelect:()=>void;
  onBlankPage:()=>void;
};

type BoundaryProps={resetKey:string;fallback:ReactNode;children:ReactNode};
class FlipBookBoundary extends Component<BoundaryProps,{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidUpdate(prev:BoundaryProps){
    if(prev.resetKey!==this.props.resetKey&&this.state.failed)this.setState({failed:false});
  }
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function StaticBookFallback({book,pageWidth,activeIndex,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage}:Omit<EditorFlipBookProps,'onFlip'|'onFlipState'|'interactionMode'>){
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
  {book,pageWidth,activeIndex,interactionMode='spread',onFlip,onFlipState,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage}:EditorFlipBookProps,
  ref:ForwardedRef<EditorFlipBookHandle>
){
  const flip=useRef<any>(null);
  const [editingSurfaceHovered,setEditingSurfaceHovered]=useState(false);
  const [displayedIndex,setDisplayedIndex]=useState(activeIndex);
  const setCoverSide=useCoverContext(state=>state.setSide);
  const actionRefs=useRef({onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage});
  actionRefs.current={onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,onBlankPage};
  const stableActions=useMemo(()=>({
    onSelect:(index:number)=>actionRefs.current.onSelect(index),
    onAddPage:()=>actionRefs.current.onAddPage(),
    onTextEdit:()=>actionRefs.current.onTextEdit(),
    onCrop:()=>actionRefs.current.onCrop(),
    onImageSelect:()=>actionRefs.current.onImageSelect(),
    onBlankPage:()=>actionRefs.current.onBlankPage(),
  }),[]);
  const hasSelectedElement=useEditor(state=>state.selected.length>0);
  const nativeFlipLocked=editingSurfaceHovered||hasSelectedElement;
  const nativeFlipEnabled=interactionMode==='spread'&&!nativeFlipLocked;
  const safeWidth=Math.max(40,Math.floor(pageWidth));
  const pageHeight=Math.round(safeWidth*1696/1200);
  const imageScale=Math.max(.24,Math.min(.5,safeWidth/1200*1.15));
  const {lastReal,plusIndex,needsFiller,backIndex}=editorLeafPlan(book.pages.length);
  const showCenteredAdd=displayedIndex===plusIndex||(plusIndex%2===0&&displayedIndex===lastReal);

  useImperativeHandle(ref,()=>({
    flipNext:()=>flip.current?.pageFlip?.().flipNext?.(flipbookMotion.corner),
    flipPrev:()=>flipPrevSafely(flip.current?.pageFlip?.()),
    flipTo:(page:number)=>flipToSafely(flip.current?.pageFlip?.(),Math.max(0,Math.min(lastReal,page))),
    turnTo:(page:number)=>flip.current?.pageFlip?.().turnToPage?.(Math.max(0,Math.min(lastReal,page))),
    current:()=>flip.current?.pageFlip?.().getCurrentPageIndex?.()??0,
  }),[lastReal]);

  const resetKey=`${book.id}:${book.pages.map(page=>page.id).join('.') }:${safeWidth}`;
  useEffect(()=>setDisplayedIndex(activeIndex),[activeIndex,resetKey]);
  useEffect(()=>{
    setCoverSide(displayedIndex===0?'front':displayedIndex>=backIndex?'back':null);
  },[displayedIndex,backIndex,setCoverSide]);
  useEffect(()=>()=>useCoverContext.getState().setSide(null),[]);
  const openCover=()=>flip.current?.pageFlip?.().flipNext?.();
  const leafProps={book,width:safeWidth,...stableActions,onOpenCover:openCover,onInteractionChange:setEditingSurfaceHovered,scale:imageScale};

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
    <div className={`editor-pageflip-shell ${displayedIndex===0?'is-cover':''} ${displayedIndex>=backIndex?'is-back-cover':''} ${nativeFlipLocked?'native-flip-locked':''} ${interactionMode==='single'?'single-flip-interaction':''}`} style={{width:safeWidth*2,height:pageHeight}}>
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
        flippingTime={flipbookMotion.flippingTime}
        usePortrait={false}
        startZIndex={0}
        autoSize={false}
        maxShadowOpacity={flipbookMotion.maxShadowOpacity}
        showCover
        mobileScrollSupport
        clickEventForward
        useMouseEvents={nativeFlipEnabled}
        swipeDistance={flipbookMotion.swipeDistance}
        showPageCorners={nativeFlipEnabled}
        disableFlipByClick
        startPage={Math.max(0,Math.min(lastReal,activeIndex))}
        className="editor-flip-book"
        style={{}}
        onChangeState={(e:any)=>onFlipState?.(String(e.data??''))}
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
      {showCenteredAdd&&<div className="editor-flip-add" style={{position:'absolute',inset:0,zIndex:16,background:'transparent',pointerEvents:'none'}}>
        <button aria-label="添加新页" title="添加新页" onClick={onAddPage} style={{pointerEvents:'auto'}}><Plus size={28}/></button>
      </div>}
      {interactionMode==='spread'&&<>
        {activeIndex>0&&<button className="editor-flip-nav-zone previous" aria-label="翻到上一跨页" onClick={()=>flipPrevSafely(flip.current?.pageFlip?.())}/>}
        {activeIndex<lastReal&&<button className="editor-flip-nav-zone next" aria-label="翻到下一跨页" onClick={()=>flip.current?.pageFlip?.().flipNext?.(flipbookMotion.corner)}/>}
      </>}
    </div>
  </FlipBookBoundary>;
}

export const EditorFlipBook=forwardRef(EditorFlipBookInner);
EditorFlipBook.displayName='EditorFlipBook';
