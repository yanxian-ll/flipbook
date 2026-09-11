import {useEffect,useState,type ComponentProps} from 'react';
import {createPortal} from 'react-dom';
import {X} from 'lucide-react';
import {backCoverFor,textElement} from '../domain/model';
import {useCoverContext} from '../store/coverContext';
import {useEditor} from '../store/editor';
import {IconButton} from '../components/ui';
import {EditorPanel as EditorPanelCore} from './EditorPanelCore';
export type {PanelId} from './EditorPanelCore';

const cakeStickers=['🎂','🍰','🧁','🍩','🍪','🍓','🍒','🍬','🍭','🕯️','🎈','🎁','🥳','🎉','✨'] as const;
const emojiFont='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function CakeStickerButtons(){
  return <>{cakeStickers.map(sticker=><button key={sticker} type="button" title={`添加 ${sticker} 贴纸`} aria-label={`添加 ${sticker} 贴纸`} onClick={()=>useEditor.getState().addElement({...textElement(sticker,{fontSize:180,width:260,height:280,fontFamily:emojiFont,color:'#b47d7d'}),type:'sticker'})}>{sticker}</button>)}</>;
}

type EditorPanelProps=ComponentProps<typeof EditorPanelCore>;

function BackCoverTextPanel({onClose,placement,paired}:{onClose:()=>void;placement?:'left'|'right';paired?:boolean}){
  const book=useEditor(state=>state.book)!;
  const change=useEditor(state=>state.change);
  const back=backCoverFor(book);
  const update=(patch:Partial<ReturnType<typeof backCoverFor>>)=>change(draft=>{
    const current=backCoverFor(draft);
    const next={...current,...patch};
    draft.backCover={
      ...draft.backCover,
      backgroundMode:next.backgroundMode,
      background:next.background,
      templateId:next.templateId,
      assetId:next.assetId,
      crop:next.crop,
      text:next.text,
      textColor:next.textColor,
      mode:next.backgroundMode==='match-front'?'match-front':next.templateId==='plain'?'solid':'custom',
    };
  });
  return <aside className={`editor-panel ${placement?`panel-${placement}`:''} ${paired?'paired-library-panel':''}`}>
    <div className="panel-grabber"/>
    <header><h2>文字</h2><IconButton label="关闭面板" onClick={onClose}><X size={17}/></IconButton></header>
    <div className="panel-body">
      <p className="muted">正在编辑后封面文字。后封面不是普通内页，因此文字内容单独保存在封面数据中。</p>
      <label className="field stack">后封面文字<textarea aria-label="文字内容" rows={3} value={back.text} placeholder="例如：日期、地点或一句话" onChange={event=>update({text:event.target.value})}/></label>
      <label className="field">文字颜色<input type="color" value={back.textColor} onChange={event=>update({textColor:event.target.value})}/></label>
    </div>
  </aside>;
}

export function EditorPanel(props:EditorPanelProps){
  const [stickerGrid,setStickerGrid]=useState<HTMLElement|null>(null);
  const coverSide=useCoverContext(state=>state.side);
  const page=useEditor(state=>state.book?.pages[state.pageIndex]);
  const selectedIds=useEditor(state=>state.selected);

  useEffect(()=>{
    setStickerGrid(null);
    if(props.panel!=='stickers')return;
    const frame=requestAnimationFrame(()=>setStickerGrid(document.querySelector<HTMLElement>('.editor-panel .sticker-grid')));
    return()=>cancelAnimationFrame(frame);
  },[props.panel]);

  useEffect(()=>{
    if(props.panel!=='text'||page?.type!=='cover')return;
    if(useCoverContext.getState().side!=='front')useCoverContext.getState().setSide('front');
    const state=useEditor.getState();
    const current=state.book?.pages[state.pageIndex];
    if(!current)return;
    const selectedText=current.elements.find(element=>element.type==='text'&&state.selected.includes(element.id));
    if(selectedText)return;
    const firstText=current.elements.find(element=>element.type==='text');
    if(firstText)state.select(firstText.id);
  },[props.panel,page?.id,page?.type,selectedIds.join('|')]);

  const effectiveCoverSide=page?.type==='cover'?'front':coverSide;
  if(props.panel==='text'&&effectiveCoverSide==='back'){
    return <BackCoverTextPanel onClose={props.onClose} placement={props.placement} paired={props.paired}/>;
  }

  return <>
    <EditorPanelCore {...props}/>
    {props.panel==='stickers'&&stickerGrid&&createPortal(<CakeStickerButtons/>,stickerGrid)}
  </>;
}
