import {useEffect,useState,type ComponentProps} from 'react';
import {createPortal} from 'react-dom';
import {textElement} from '../domain/model';
import {useEditor} from '../store/editor';
import {EditorPanel as EditorPanelCore} from './EditorPanelCore';
export type {PanelId} from './EditorPanelCore';

const cakeStickers=['🎂','🍰','🧁','🍩','🍪','🍓','🍒','🍬','🍭','🕯️','🎈','🎁','🥳','🎉','✨'] as const;
const emojiFont='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function CakeStickerButtons(){
  return <>{cakeStickers.map(sticker=><button key={sticker} type="button" title={`添加 ${sticker} 贴纸`} aria-label={`添加 ${sticker} 贴纸`} onClick={()=>useEditor.getState().addElement({...textElement(sticker,{fontSize:180,width:260,height:280,fontFamily:emojiFont,color:'#b47d7d'}),type:'sticker'})}>{sticker}</button>)}</>;
}

type EditorPanelProps=ComponentProps<typeof EditorPanelCore>;

export function EditorPanel(props:EditorPanelProps){
  const [stickerGrid,setStickerGrid]=useState<HTMLElement|null>(null);
  useEffect(()=>{
    setStickerGrid(null);
    if(props.panel!=='stickers')return;
    const frame=requestAnimationFrame(()=>setStickerGrid(document.querySelector<HTMLElement>('.editor-panel .sticker-grid')));
    return()=>cancelAnimationFrame(frame);
  },[props.panel]);
  return <>
    <EditorPanelCore {...props}/>
    {props.panel==='stickers'&&stickerGrid&&createPortal(<CakeStickerButtons/>,stickerGrid)}
  </>;
}
