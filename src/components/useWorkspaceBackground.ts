import {useEffect,useState,type CSSProperties} from 'react';
import type {Book} from '../domain/model';
import {repository} from '../db/repository';

function rgba(hex:string,alpha:number){
  const normalized=hex.trim().replace('#','');
  const value=normalized.length===3?normalized.split('').map(char=>char+char).join(''):normalized;
  if(!/^[0-9a-f]{6}$/i.test(value))return `rgba(233,234,236,${alpha})`;
  const number=parseInt(value,16);
  return `rgba(${number>>16},${number>>8&255},${number&255},${alpha})`;
}

export function useWorkspaceBackground(book:Book|null|undefined):CSSProperties{
  const [image,setImage]=useState('');
  const textureId=book?.workspaceTextureId;
  const legacyImageId=book?.workspaceImageId;
  const imageId=textureId??legacyImageId;
  useEffect(()=>{let live=true,url='';setImage('');if(imageId)void repository.getAsset(imageId).then(asset=>{if(asset&&live){url=URL.createObjectURL(asset.preview);setImage(url);}}).catch(()=>{});return()=>{live=false;if(url)URL.revokeObjectURL(url);};},[imageId]);

  const backgroundColor=book?.workspaceBackground??'#e9eaec';
  if(image&&textureId){
    const tint=rgba(backgroundColor,.45);
    return {
      backgroundColor,
      backgroundImage:`linear-gradient(${tint},${tint}),url("${image}")`,
      backgroundSize:'auto, clamp(720px,70vw,960px) auto',
      backgroundPosition:'center,center',
      backgroundRepeat:'no-repeat,repeat',
    };
  }
  if(image)return {backgroundColor,backgroundImage:`url("${image}")`,backgroundSize:'cover',backgroundPosition:'center',backgroundRepeat:'no-repeat'};

  const pattern=book?.workspacePattern;
  if(pattern){
    const tint=rgba(backgroundColor,.45);
    return {
      backgroundColor,
      backgroundImage:`linear-gradient(${tint},${tint}),url("/reference/${pattern}")`,
      backgroundSize:`auto, ${pattern.startsWith('bg-')?'clamp(560px,55vw,760px) auto':'clamp(720px,70vw,960px) auto'}`,
      backgroundPosition:'center,center',
      backgroundRepeat:'no-repeat,repeat',
    };
  }

  return {backgroundColor};
}
