import {useEffect,useState} from 'react';
import type {Book} from '../domain/model';
import {repository} from '../db/repository';
export function BookCover({book,onClick}:{book:Book;onClick?:()=>void}){
  const [src,setSrc]=useState('');const cover=book.pages[0];const image=cover.elements.find(e=>e.type==='image');
  useEffect(()=>{let url='',disposed=false;setSrc('');if(image?.assetId)void repository.getAsset(image.assetId).then(asset=>{if(asset&&!disposed){url=URL.createObjectURL(asset.thumbnail);setSrc(url);}}).catch(()=>{});return()=>{disposed=true;URL.revokeObjectURL(url);};},[image?.assetId]);
  return <button className={`book-cover ${book.coverTemplate}`} style={{backgroundColor:cover.background}} onClick={onClick} aria-label={`打开 ${book.title}`}><span className="cover-grain"/><span className="cover-spine"/>{src&&<img className="cover-window" src={src} alt="画册封面照片"/>}<span className="cover-caption">{cover.elements.find(e=>e.type==='text')?.text??'TIME TO FLIPIN'}</span></button>;
}
