import {forwardRef,useImperativeHandle,useRef} from 'react';
import HTMLFlipBook from 'react-pageflip';
import type {Book} from '../domain/model';
import {BookCoverVisual} from './BookCover';
import {PageThumbnail} from './PageThumbnail';
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
  onFocus:(index:number)=>void;
  onAddPage:()=>void;
  scale:number;
};

const FlipLeaf=forwardRef<HTMLDivElement,LeafProps>(({book,index,kind,onFocus,onAddPage,scale},ref)=>{
  if(kind==='back')return <div ref={ref} className="editor-flip-page editor-flip-back" data-density="hard" aria-hidden/>;
  if(kind==='blank')return <div ref={ref} className="editor-flip-page editor-flip-blank" aria-hidden/>;
  if(kind==='add')return <div ref={ref} className="editor-flip-page editor-flip-add"><button aria-label="添加新页" title="添加新页" onClick={onAddPage}><Plus size={28}/></button></div>;
  const page=book.pages[index];
  return <div ref={ref} className={`editor-flip-page ${index===0?'editor-flip-cover':''}`} data-density={index===0?'hard':'soft'}>
    {index===0?<BookCoverVisual book={book} className="editor-flip-cover-visual"/>:<><PageThumbnail page={page} scale={scale} immediate/><button className="editor-flip-focus-hit" aria-label={`放大并编辑第 ${index} 页`} onClick={()=>onFocus(index)}/></>}
  </div>;
});
FlipLeaf.displayName='FlipLeaf';

export const EditorFlipBook=forwardRef<EditorFlipBookHandle,{
  book:Book;
  pageWidth:number;
  activeIndex:number;
  onFlip:(index:number)=>void;
  onFocus:(index:number)=>void;
  onAddPage:()=>void;
}>(({book,pageWidth,activeIndex,onFlip,onFocus,onAddPage},ref)=>{
  const flip=useRef<any>(null);
  const pageHeight=Math.round(pageWidth*1696/1200);
  const imageScale=Math.max(.24,Math.min(.5,pageWidth/1200*1.15));
  const lastReal=book.pages.length-1;
  const plusIndex=book.pages.length;
  const needsFiller=lastReal%2===0;
  const backIndex=plusIndex+(needsFiller?2:1);
  useImperativeHandle(ref,()=>({
    flipNext:()=>flip.current?.pageFlip().flipNext(),
    flipPrev:()=>flip.current?.pageFlip().flipPrev(),
    flipTo:(page:number)=>flip.current?.pageFlip().flip(Math.max(0,Math.min(lastReal,page))),
    turnTo:(page:number)=>flip.current?.pageFlip().turnToPage(Math.max(0,Math.min(lastReal,page))),
    current:()=>flip.current?.pageFlip().getCurrentPageIndex?.()??0,
  }),[lastReal]);

  const synthetic=[];
  synthetic.push(<FlipLeaf key="__add__" book={book} index={plusIndex} kind="add" onFocus={onFocus} onAddPage={onAddPage} scale={imageScale}/>);
  if(needsFiller)synthetic.push(<FlipLeaf key="__blank__" book={book} index={plusIndex+1} kind="blank" onFocus={onFocus} onAddPage={onAddPage} scale={imageScale}/>);
  synthetic.push(<FlipLeaf key="__back__" book={book} index={backIndex} kind="back" onFocus={onFocus} onAddPage={onAddPage} scale={imageScale}/>);

  return <div className={`editor-pageflip-shell ${activeIndex===0?'is-cover':''}`} style={{width:pageWidth*2,height:pageHeight}}>
    <HTMLFlipBook
      key={`${book.id}:${book.pages.map(page=>page.id).join('.') }:${Math.round(pageWidth)}`}
      ref={flip}
      width={Math.round(pageWidth)}
      height={pageHeight}
      size="fixed"
      minWidth={Math.round(pageWidth)}
      maxWidth={Math.round(pageWidth)}
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
      disableFlipByClick={false}
      startPage={Math.max(0,Math.min(lastReal,activeIndex))}
      className="editor-flip-book"
      style={{}}
      onFlip={(e:any)=>{const index=Number(e.data);if(Number.isFinite(index)&&index<=lastReal)onFlip(index);}}
    >
      {book.pages.map((_,index)=><FlipLeaf key={book.pages[index].id} book={book} index={index} kind="page" onFocus={onFocus} onAddPage={onAddPage} scale={imageScale}/>)}
      {synthetic}
    </HTMLFlipBook>
  </div>;
});
EditorFlipBook.displayName='EditorFlipBook';
