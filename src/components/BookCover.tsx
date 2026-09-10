import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {H,W,backCoverFor,bookStyleFor,type Book,type Element} from '../domain/model';
import {dragCrop} from '../domain/crop';
import {repository} from '../db/repository';
import {useEditor} from '../store/editor';

function useAssetImage(assetId:string|undefined,quality:'thumbnail'|'preview'='thumbnail'){
  const [src,setSrc]=useState('');
  useEffect(()=>{
    let url='',disposed=false;
    setSrc('');
    if(assetId)void repository.getAsset(assetId).then(asset=>{
      if(asset&&!disposed){
        url=URL.createObjectURL(asset[quality]);
        setSrc(url);
      }
    }).catch(()=>{});
    return()=>{disposed=true;if(url)URL.revokeObjectURL(url);};
  },[assetId,quality]);
  return src;
}
function useCoverImage(book:Book,quality:'thumbnail'|'preview'='thumbnail'){
  return useAssetImage(book.pages[0].elements.find(element=>element.type==='image')?.assetId,quality);
}

function coverCropStyle(image?:Element){
  const crop=image?.crop??{x:.5,y:.5,zoom:1};
  return {
    objectPosition:`${crop.x*100}% ${crop.y*100}%`,
    transform:`scale(${crop.zoom})`,
    transformOrigin:`${crop.x*100}% ${crop.y*100}%`,
    filter:`blur(${Math.max(0,image?.blur??0)}px)`,
  };
}
function coverTemplateClass(book:Book){return book.coverTemplate==='basic'||book.coverTemplate==='cutout'?book.coverTemplate:'custom';}
function customCoverFrameStyle(book:Book,image?:Element):CSSProperties|undefined{
  if(!image||book.coverTemplate==='basic'||book.coverTemplate==='cutout')return undefined;
  return {
    left:`${image.x/W*100}%`,
    top:`${image.y/H*100}%`,
    width:`${image.width/W*100}%`,
    height:`${image.height/H*100}%`,
    borderRadius:image.frameShape==='ellipse'?'50%':undefined,
  };
}

function CoverContents({book,cropOverride,quality='thumbnail'}:{book:Book;cropOverride?:Element['crop'];quality?:'thumbnail'|'preview'}){
  const src=useCoverImage(book,quality);
  const cover=book.pages[0];
  const image=cover.elements.find(element=>element.type==='image');
  const shownImage=image&&cropOverride?{...image,crop:cropOverride}:image;
  return <>
    <span className="cover-grain"/>
    <span className="cover-spine"/>
    {src&&<span className="cover-window" style={customCoverFrameStyle(book,image)}><img className="cover-window-image" src={src} alt="画册封面照片" style={coverCropStyle(shownImage)}/></span>}
    <span className="cover-caption" style={{color:cover.elements.find(element=>element.type==='text')?.color}}>{cover.elements.find(element=>element.type==='text')?.text??'TIME TO FLIPBOOK'}</span>
  </>;
}

export function BookCoverVisual({book,className='',cropOverride}:{book:Book;className?:string;cropOverride?:Element['crop']}){
  const cover=book.pages[0];
  return <div className={`book-cover ${coverTemplateClass(book)} ${className}`.trim()} style={{backgroundColor:cover.background}}><CoverContents book={book} cropOverride={cropOverride} quality="preview"/></div>;
}

export function BookCover({book,onClick}:{book:Book;onClick?:()=>void}){
  const cover=book.pages[0];
  return <button className={`book-cover ${coverTemplateClass(book)}`} style={{backgroundColor:cover.background}} onClick={onClick} aria-label={`打开 ${book.title}`}><CoverContents book={book}/></button>;
}

export function BookBackCoverVisual({book,className=''}:{book:Book;className?:string}){
  const back=backCoverFor(book);
  const custom=back.mode==='custom';
  const background=back.mode==='match-front'?(book.pages[0]?.background??back.background):back.background;
  const src=useAssetImage(custom?back.assetId:undefined,'preview');
  const style=bookStyleFor(book);
  return <div className={`book-back-cover ${className}`.trim()} style={{backgroundColor:background}}>
    <span className="cover-grain"/>
    <span className="cover-spine"/>
    {custom&&src&&<span className="back-cover-window"><img src={src} alt="画册后封面照片" style={coverCropStyle({crop:back.crop} as Element)}/></span>}
    {custom&&back.text?.trim()&&<span className="back-cover-caption" style={{color:back.textColor??style.textColor,fontFamily:style.fontFamily}}>{back.text}</span>}
  </div>;
}


export function BookCoverEditor({
  book,
  width,
  onTextEdit,
  onImageSelect,
  onOpen,
}:{
  book:Book;
  width:number;
  onTextEdit:()=>void;
  onImageSelect:()=>void;
  onOpen:()=>void;
}){
  const cover=book.pages[0];
  const image=cover.elements.find(element=>element.type==='image');
  const text=cover.elements.find(element=>element.type==='text');
  const update=useEditor(state=>state.updateElement);
  const select=useEditor(state=>state.select);
  const [previewCrop,setPreviewCrop]=useState<Element['crop']>();
  const drag=useRef<{pointerId:number;x:number;y:number;crop:{x:number;y:number;zoom:number};moved:boolean}|null>(null);
  const asset=book.assets.find(asset=>asset.id===image?.assetId);

  function beginPhoto(e:React.PointerEvent<HTMLButtonElement>){
    if(e.button!==0||!image||drag.current)return;
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
    if(asset&&start.moved)setPreviewCrop(dragCrop(rect,asset,start.crop,dx,dy));
    e.stopPropagation();
  }
  function endPhoto(e:React.PointerEvent<HTMLButtonElement>){
    const start=drag.current;
    if(!start||start.pointerId!==e.pointerId)return;
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    drag.current=null;
    if(start.moved&&image&&asset){const rect=e.currentTarget.getBoundingClientRect();const crop=dragCrop(rect,asset,start.crop,e.clientX-start.x,e.clientY-start.y);if(crop.x!==start.crop.x||crop.y!==start.crop.y)update(image.id,{crop});}
    setPreviewCrop(undefined);
    e.stopPropagation();
    if(!start.moved)onImageSelect();
  }

  return <div
    className={`book-cover-editor ${coverTemplateClass(book)}`}
    style={{width,height:width*1696/1200}}
  >
    <BookCoverVisual book={book} className="book-cover-editor-visual" cropOverride={previewCrop}/>
    <button
      type="button"
      className="cover-editor-open-hit"
      aria-label="打开画册"
      title="打开画册"
      onClick={e=>{e.stopPropagation();onOpen();}}
    />
    {image&&<button
      type="button"
      className="cover-editor-photo-hit"
      style={customCoverFrameStyle(book,image)}
      aria-label="调整或替换封面照片"
      onPointerDown={beginPhoto}
      onPointerMove={movePhoto}
      onPointerUp={endPhoto}
      onPointerCancel={()=>{drag.current=null;setPreviewCrop(undefined);}}
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
