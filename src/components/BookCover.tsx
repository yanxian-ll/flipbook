import {useEffect,useState} from 'react';
import type {Book} from '../domain/model';
import {repository} from '../db/repository';
import {EditorCanvas} from '../editor/EditorCanvas';

function useCoverImage(book:Book){
  const [src,setSrc]=useState('');const cover=book.pages[0];const image=cover.elements.find(e=>e.type==='image');
  useEffect(()=>{let url='',disposed=false;setSrc('');if(image?.assetId)void repository.getAsset(image.assetId).then(asset=>{if(asset&&!disposed){url=URL.createObjectURL(asset.thumbnail);setSrc(url);}}).catch(()=>{});return()=>{disposed=true;if(url)URL.revokeObjectURL(url);};},[image?.assetId]);
  return src;
}

function CoverContents({book}:{book:Book}){
  const src=useCoverImage(book);const cover=book.pages[0];
  return <><span className="cover-grain"/><span className="cover-spine"/>{src&&<img className="cover-window" src={src} alt="画册封面照片"/>}<span className="cover-caption">{cover.elements.find(e=>e.type==='text')?.text??'TIME TO FLIPIN'}</span></>;
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
  const editableCover={...cover,pattern:undefined};
  return <div
    className={`book-cover-editor ${book.coverTemplate}`}
    style={{width,height:width*1696/1200,backgroundColor:cover.background}}
  >
    <EditorCanvas
      page={editableCover}
      width={width}
      onTextEdit={onTextEdit}
      onCrop={onImageSelect}
      onImageSelect={onImageSelect}
    />
    <span className="cover-grain"/>
    <span className="cover-spine"/>
  </div>;
}
