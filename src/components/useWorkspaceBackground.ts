import {useEffect,useState,type CSSProperties} from 'react';
import type {Book} from '../domain/model';
import {repository} from '../db/repository';
export function useWorkspaceBackground(book:Book|null|undefined):CSSProperties{
  const [image,setImage]=useState('');
  useEffect(()=>{let live=true,url='';setImage('');if(book?.workspaceImageId)void repository.getAsset(book.workspaceImageId).then(asset=>{if(asset&&live){url=URL.createObjectURL(asset.preview);setImage(url);}}).catch(()=>{});return()=>{live=false;if(url)URL.revokeObjectURL(url);};},[book?.workspaceImageId]);
  const source=image||(book?.workspacePattern?`/reference/${book.workspacePattern}`:'');
  return {backgroundColor:book?.workspaceBackground??'#e9eaec',backgroundImage:source?`url("${source}")`:undefined,backgroundSize:image?'cover':book?.workspacePattern?.startsWith('bg-')?'240px auto':'cover',backgroundPosition:'center',backgroundRepeat:image?'no-repeat':'repeat'};
}
