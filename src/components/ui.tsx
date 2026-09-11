import * as Dialog from '@radix-ui/react-dialog';
import {X,LoaderCircle} from 'lucide-react';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
export function Button({children,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>){return <button className={`btn ${className}`} {...props}>{children}</button>;}
export function IconButton({label,children,active=false,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{label:string;active?:boolean}){
  return <button title={label} aria-label={label} className={`icon-btn ${active?'active':''}`} {...props}>{children}</button>;
}
export function DesktopCloseControl(){
  if(typeof window==='undefined'||!window.desktopWindow)return null;
  return <button type="button" title="关闭" aria-label="关闭 Flipbook" className="icon-btn desktop-inline-close" onClick={()=>window.desktopWindow?.close()}><X size={17}/></button>;
}
export function Modal({open,onClose,title,description,children,wide=false,className=''}:{open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;wide?:boolean;className?:string}){return <Dialog.Root open={open} onOpenChange={v=>{if(!v)onClose();}}><Dialog.Portal><Dialog.Overlay className="modal-shade"/><Dialog.Content className={`modal ${wide?'wide':''} ${className}`} aria-describedby={description?'modal-description':undefined}><Dialog.Close className="modal-close" aria-label="关闭"><X size={16}/></Dialog.Close><Dialog.Title>{title}</Dialog.Title>{description&&<Dialog.Description id="modal-description">{description}</Dialog.Description>}{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;}
export function Loading({text='正在装订回忆…'}:{text?:string}){return <div className="loading"><LoaderCircle className="spin" size={25}/><p>{text}</p></div>;}
export function ErrorMessage({message}:{message:string}){return message?<div className="error" role="alert">{message}</div>:null;}
