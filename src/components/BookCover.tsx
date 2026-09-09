import {useEffect,useRef,useState} from 'react';
import type {Book,Element} from '../domain/model';
import {repository} from '../db/repository';
import {useEditor} from '../store/editor';

function useCoverImage(book:Book){
  const [src,setSrc]=useState('');
  const image=book.pages[0].elements.find(element=>element.type==='image');
  useEffect(()=>{
    let url='',disposed=false;
    setSrc('');
    if(image?.assetId)void repository.getAsset(image.assetId).then(asset=>{
      if(asset&&!disposed){
        url=URL.createObjectURL(asset.thumbnail);
        setSrc(url);
      }
    }).catch(()=>{});
    return()=>{disposed=true;if(url)URL.revokeObjectURL(url);};
  },[image?.assetId]);
  return src;
}

function coverCropStyle(image?:Element){
  const crop=image?.crop??{x:.5,y:.5,zoom:1};
  return {
    objectPosition:`${crop.x*100}% ${crop.y*100}%`,
    transform:`scale(${crop.zoom})`,
    transformOrigin:`${crop.x*100}% ${crop.y*100}%`,
  };
}

function CoverContents({book}:{book:Book}){
  const src=useCoverImage(book);
  const cover=book.pages[0];
  const image=cover.elements.find(element=>element.type==='image');
  return <>
    <span className="cover-grain"/>
    <span className="cover-spine"/>
    {src&&<span className="cover-window"><img className="cover-window-image" src={src} alt="画册封面照片" style={coverCropStyle(image)}/></span>}
    <span className="cover-caption">{cover.elements.find(element=>element.type==='text')?.text??'TIME TO FLIPIN'}</span>
  </>;
}

export function BookCoverVisual({book,className=''}:{book:Book;className?:string}){
  const cover=book.pages[0];
  return <div className={`book-cover ${book.coverTemplate} ${className}`.trim()} style={{backgroundColor:cover.background}}><CoverContents book={book}/></div>;
}

export function BookCover({book,onClick}:{book:Book;onClick?:()=>void}){
  const cover=book.pages[0];
  return <button className={`book-cover ${book.coverTemplate}`} style={{backgroundColor:cover.background}} onClick={onClick} aria-label={`打开 ${book.title}`}><CoverContents book={book}/></button>;
}

export function BookCoverEditor({
  book,
  width,
  onTextEdit,
  onImageSelect,
}:{
  book:Book;
  width:number;
  onTextEdit:()=>void;
  onImageSelect:()=>void;
}){
  const cover=book.pages[0];
  const image=cover.elements.find(element=>element.type==='image');
  const text=cover.elements.find(element=>element.type==='text');
  const update=useEditor(state=>state.updateElement);
  const select=useEditor(state=>state.select);
  const drag=useRef<{pointerId:number;x:number;y:number;crop:{x:number;y:number;zoom:number};moved:boolean}|null>(null);
  const clamp=(value:number)=>Math.max(0,Math.min(1,value));

  function beginPhoto(e:React.PointerEvent<HTMLButtonElement>){
    if(e.button!==0||!image)return;
    const crop=image.crop??{x:.5,y:.5,zoom:1};
    drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,crop,moved:false};
    e.currentTarget.setPointerCapture(e.pointerId);
    select(image.id);
    e.stopPropagation();
  }
  function movePhoto(e:React.PointerEvent<HTMLButtonElement>){
    const start=drag.current;
    if(!start||start.pointerId!==e.pointerId||!image)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const dx=e.clientX-start.x,dy=e.clientY-start.y;
    if(Math.abs(dx)+Math.abs(dy)>3)start.moved=true;
    const zoom=Math.max(1,start.crop.zoom);
    update(image.id,{crop:{
      zoom:start.crop.zoom,
      x:clamp(start.crop.x-dx/Math.max(1,rect.width)/zoom),
      y:clamp(start.crop.y-dy/Math.max(1,rect.height)/zoom),
    }});
    e.stopPropagation();
  }
  function endPhoto(e:React.PointerEvent<HTMLButtonElement>){
    const start=drag.current;
    if(!start||start.pointerId!==e.pointerId)return;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current=null;
    e.stopPropagation();
    if(!start.moved)onImageSelect();
  }

  return <div
    className={`book-cover-editor ${book.coverTemplate}`}
    style={{width,height:width*1696/1200}}
  >
    <BookCoverVisual book={book} className="book-cover-editor-visual"/>
    {image&&<button
      type="button"
      className="cover-editor-photo-hit"
      aria-label="调整或替换封面照片"
      onPointerDown={beginPhoto}
      onPointerMove={movePhoto}
      onPointerUp={endPhoto}
      onPointerCancel={()=>{drag.current=null;}}
      onWheel={e=>{
        e.preventDefault();
        e.stopPropagation();
        const crop=image.crop??{x:.5,y:.5,zoom:1};
        update(image.id,{crop:{...crop,zoom:Math.max(1,Math.min(4,crop.zoom-e.deltaY*.002))}});
      }}
    />}
    {text&&<button
      type="button"
      className="cover-editor-text-hit"
      aria-label="编辑封面文字"
      onClick={e=>{e.stopPropagation();select(text.id);onTextEdit();}}
    />}
  </div>;
}
