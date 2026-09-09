import {Component,forwardRef,useEffect,useImperativeHandle,useRef,type ForwardedRef,type ReactNode} from 'react';
import HTMLFlipBook from 'react-pageflip';
import type {Book} from '../domain/model';
import {BookCoverVisual} from './BookCover';
import {PageThumbnail} from './PageThumbnail';
import {EditorCanvas} from '../editor/EditorCanvas';
import {Plus} from 'lucide-react';

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
  width:number;
  onSelect:(index:number)=>void;
  onAddPage:()=>void;
  onTextEdit:()=>void;
  onCrop:()=>void;
  onImageSelect:()=>void;
  scale:number;
};

function LiveEditorSurface({children}:{children:ReactNode}){
  const surface=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=surface.current;if(!node)return;
    const stop=(event:Event)=>event.stopPropagation();
    const events=['mousedown','pointerdown','touchstart'] as const;
    for(const type of events)node.addEventListener(type,stop,{passive:false});
    return()=>{for(const type of events)node.removeEventListener(type,stop);};
  },[]);
  return <div ref={surface} className="editor-flip-live">{children}</div>;
}

function FlipLeafInner(
  {book,index,kind,active,width,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,scale}:LeafProps,
  ref:ForwardedRef<HTMLDivElement>
){
  if(kind==='back')return <div ref={ref} className="editor-flip-page editor-flip-back" data-density="hard" aria-hidden/>;
  if(kind==='blank')return <div ref={ref} className="editor-flip-page editor-flip-blank" aria-hidden/>;
  if(kind==='add')return <div ref={ref} className="editor-flip-page editor-flip-add">
    <button aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={28}/></button>
  </div>;

  const page=book.pages[index];
  if(!page)return <div ref={ref} className="editor-flip-page editor-flip-blank" aria-hidden/>;

  return <div ref={ref} className={`editor-flip-page ${index===0?'editor-flip-cover':''}`} data-density={index===0?'hard':'soft'}>
    {index===0
      ?<BookCoverVisual book={book} className="editor-flip-cover-visual"/>
      :active
        ?<LiveEditorSurface>
          <EditorCanvas page={page} width={width} onTextEdit={onTextEdit} onCrop={onCrop} onImageSelect={onImageSelect}/>
        </LiveEditorSurface>
        :<>
          <PageThumbnail page={page} scale={scale} immediate/>
          <button
            className="editor-flip-select-page"
            aria-label={`编辑第 ${index} 页`}
            onClick={e=>{e.stopPropagation();onSelect(index);}}
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

function StaticBookFallback({book,pageWidth,activeIndex,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect}:Omit<EditorFlipBookProps,'onFlip'>){
  const pageHeight=Math.round(pageWidth*1696/1200);
  if(activeIndex===0){
    return <div className="editor-pageflip-shell static-book-fallback is-cover" style={{width:pageWidth*2,height:pageHeight}}>
      <div className="editor-fallback-cover" style={{width:pageWidth,height:pageHeight}}><BookCoverVisual book={book} className="editor-flip-cover-visual"/></div>
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
        ?<EditorCanvas page={page} width={pageWidth} onTextEdit={onTextEdit} onCrop={onCrop} onImageSelect={onImageSelect}/>
        :<><PageThumbnail page={page} scale={.4} immediate/><button className="editor-flip-select-page" aria-label={`编辑第 ${index} 页`} onClick={()=>onSelect(index)}/></>}
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
  {book,pageWidth,activeIndex,onFlip,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect}:EditorFlipBookProps,
  ref:ForwardedRef<EditorFlipBookHandle>
){
  const flip=useRef<any>(null);
  const safeWidth=Math.max(120,Math.round(pageWidth));
  const pageHeight=Math.round(safeWidth*1696/1200);
  const imageScale=Math.max(.24,Math.min(.5,safeWidth/1200*1.15));
  const lastReal=Math.max(0,book.pages.length-1);
  const plusIndex=book.pages.length;
  const needsFiller=lastReal%2===0;
  const backIndex=plusIndex+(needsFiller?2:1);

  useImperativeHandle(ref,()=>({
    flipNext:()=>flip.current?.pageFlip?.().flipNext?.(),
    flipPrev:()=>flip.current?.pageFlip?.().flipPrev?.(),
    flipTo:(page:number)=>flip.current?.pageFlip?.().flip?.(Math.max(0,Math.min(lastReal,page))),
    turnTo:(page:number)=>flip.current?.pageFlip?.().turnToPage?.(Math.max(0,Math.min(lastReal,page))),
    current:()=>flip.current?.pageFlip?.().getCurrentPageIndex?.()??0,
  }),[lastReal]);

  const resetKey=`${book.id}:${book.pages.map(page=>page.id).join('.') }:${safeWidth}`;
  const leafProps={book,width:safeWidth,onSelect,onAddPage,onTextEdit,onCrop,onImageSelect,scale:imageScale};

  const fallback=<StaticBookFallback
    book={book}
    pageWidth={safeWidth}
    activeIndex={Math.max(0,Math.min(lastReal,activeIndex))}
    onSelect={onSelect}
    onAddPage={onAddPage}
    onTextEdit={onTextEdit}
    onCrop={onCrop}
    onImageSelect={onImageSelect}
  />;

  if(!book.pages.length)return fallback;

  return <FlipBookBoundary resetKey={resetKey} fallback={fallback}>
    <div className={`editor-pageflip-shell ${activeIndex===0?'is-cover':''}`} style={{width:safeWidth*2,height:pageHeight}}>
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
        useMouseEvents
        swipeDistance={28}
        showPageCorners
        disableFlipByClick
        startPage={Math.max(0,Math.min(lastReal,activeIndex))}
        className="editor-flip-book"
        style={{}}
        onFlip={(e:any)=>{
          const index=Number(e.data);
          if(Number.isFinite(index)&&index>=0&&index<=lastReal)onFlip(index);
        }}
      >
        {book.pages.map((_,index)=><FlipLeaf
          key={book.pages[index].id}
          {...leafProps}
          index={index}
          kind="page"
          active={activeIndex===index}
        />)}
        <FlipLeaf key="__add__" {...leafProps} index={plusIndex} kind="add" active={false}/>
        {needsFiller&&<FlipLeaf key="__blank__" {...leafProps} index={plusIndex+1} kind="blank" active={false}/>}
        <FlipLeaf key="__back__" {...leafProps} index={backIndex} kind="back" active={false}/>
      </HTMLFlipBook>
      {activeIndex>0&&<button className="editor-flip-nav-zone previous" aria-label="翻到上一跨页" onClick={()=>flip.current?.pageFlip?.().flipPrev?.()}/>}
      {activeIndex<lastReal&&<button className="editor-flip-nav-zone next" aria-label="翻到下一跨页" onClick={()=>flip.current?.pageFlip?.().flipNext?.()}/>}
    </div>
  </FlipBookBoundary>;
}

export const EditorFlipBook=forwardRef(EditorFlipBookInner);
EditorFlipBook.displayName='EditorFlipBook';
