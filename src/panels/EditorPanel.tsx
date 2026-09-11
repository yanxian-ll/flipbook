import {useEffect,useLayoutEffect,useState,type ComponentProps,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Copy,Trash2,X} from 'lucide-react';
import {backCoverFor,textElement,uid,type Element} from '../domain/model';
import {addBackCoverElement,copyBackCoverElements,deleteBackCoverElements,pasteBackCoverElements,updateBackCoverElement} from '../domain/backCoverElements';
import {useCoverContext} from '../store/coverContext';
import {useEditor} from '../store/editor';
import {Button,IconButton} from '../components/ui';
import {EditorPanel as EditorPanelCore} from './EditorPanelCore';
export type {PanelId} from './EditorPanelCore';

const baseStickers=['★','♡','✿','↗','✦','♥','☀','✈','✽','☻','❀','➜','✉','♫','☁','✧'] as const;
const cakeStickers=['🎂','🍰','🧁','🍩','🍪','🍓','🍒','🍬','🍭','🕯️','🎈','🎁','🥳','🎉','✨'] as const;
const emojiFont='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function CakeStickerButtons(){
  return <>{cakeStickers.map(sticker=><button key={sticker} type="button" title={`添加 ${sticker} 贴纸`} aria-label={`添加 ${sticker} 贴纸`} onClick={()=>useEditor.getState().addElement({...textElement(sticker,{fontSize:180,width:260,height:280,fontFamily:emojiFont,color:'#b47d7d'}),type:'sticker'})}>{sticker}</button>)}</>;
}

type EditorPanelProps=ComponentProps<typeof EditorPanelCore>;
type CoverPanelProps={onClose:()=>void;placement?:'left'|'right';paired?:boolean};

function PanelShell({title,onClose,placement,paired,children}:{title:string;children:ReactNode}&CoverPanelProps){
  return <aside className={`editor-panel ${placement?`panel-${placement}`:''} ${paired?'paired-library-panel':''}`}>
    <div className="panel-grabber"/>
    <header><h2>{title}</h2><IconButton label="关闭面板" onClick={onClose}><X size={17}/></IconButton></header>
    <div className="panel-body">{children}</div>
  </aside>;
}

function BackCoverTextPanel({onClose,placement,paired}:CoverPanelProps){
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
      elements:next.elements,
      mode:next.backgroundMode==='match-front'?'match-front':next.templateId==='plain'?'solid':'custom',
    };
  });
  return <PanelShell title="文字" onClose={onClose} placement={placement} paired={paired}>
    <p className="muted">正在编辑后封面文字。贴纸等自由元素可以直接在后封面画布上选择和移动。</p>
    <label className="field stack">后封面文字<textarea aria-label="文字内容" rows={3} value={back.text} placeholder="例如：日期、地点或一句话" onChange={event=>update({text:event.target.value})}/></label>
    <label className="field">文字颜色<input type="color" value={back.textColor} onChange={event=>update({textColor:event.target.value})}/></label>
  </PanelShell>;
}

function BackCoverStickerPanel({onClose,placement,paired}:CoverPanelProps){
  const book=useEditor(state=>state.book)!;
  const selectedIds=useEditor(state=>state.selected);
  const change=useEditor(state=>state.change);
  const select=useEditor(state=>state.select);
  const selected=backCoverFor(book).elements.find(element=>selectedIds.includes(element.id)&&element.type==='sticker');

  function addSticker(value:string,emoji=false){
    const element={...textElement(value,{x:470,y:650,width:260,height:280,fontSize:180,fontFamily:emoji?emojiFont:'Arial',color:'#b47d7d'}),id:uid(),type:'sticker' as const};
    change(draft=>addBackCoverElement(draft,element));
    select(element.id);
  }
  function updateSelected(patch:Partial<Element>){
    if(!selected)return;
    change(draft=>updateBackCoverElement(draft,selected.id,patch));
  }
  function duplicateSelected(){
    const source=copyBackCoverElements(book,selectedIds);
    if(!source.length)return;
    let pasted:Element[]=[];
    change(draft=>{pasted=pasteBackCoverElements(draft,source);});
    useEditor.setState({selected:pasted.map(element=>element.id)});
  }
  function removeSelected(){
    if(!selectedIds.length)return;
    change(draft=>deleteBackCoverElements(draft,selectedIds));
    select(null);
  }

  return <PanelShell title="贴纸" onClose={onClose} placement={placement} paired={paired}>
    <p className="muted">贴纸会直接放到后封面。按住 Ctrl（macOS 为 ⌘）可以多选，再一起拖动或复制。</p>
    {selected&&<label className="field">当前贴纸颜色<input type="color" value={selected.color??'#b47d7d'} onChange={event=>updateSelected({color:event.target.value})}/></label>}
    <div className="sticker-grid">{baseStickers.map(sticker=><button key={sticker} type="button" onClick={()=>addSticker(sticker)}>{sticker}</button>)}</div>
    <p className="field-label">Cake / Birthday</p>
    <div className="sticker-grid">{cakeStickers.map(sticker=><button key={sticker} type="button" onClick={()=>addSticker(sticker,true)}>{sticker}</button>)}</div>
    <div className="segments" style={{marginTop:16}}>
      <Button disabled={!selectedIds.length} onClick={duplicateSelected}><Copy size={15}/>复制所选</Button>
      <Button className="danger" disabled={!selectedIds.length} onClick={removeSelected}><Trash2 size={15}/>删除所选</Button>
    </div>
  </PanelShell>;
}

export function EditorPanel(props:EditorPanelProps){
  const [stickerGrid,setStickerGrid]=useState<HTMLElement|null>(null);
  const coverSide=useCoverContext(state=>state.side);
  const page=useEditor(state=>state.book?.pages[state.pageIndex]);
  const selectedIds=useEditor(state=>state.selected);

  useEffect(()=>{
    setStickerGrid(null);
    if(props.panel!=='stickers'||coverSide==='back')return;
    const frame=requestAnimationFrame(()=>setStickerGrid(document.querySelector<HTMLElement>('.editor-panel .sticker-grid')));
    return()=>cancelAnimationFrame(frame);
  },[props.panel,coverSide]);

  useLayoutEffect(()=>{
    if((props.panel!=='text'&&props.panel!=='stickers')||page?.type!=='cover')return;
    if(useCoverContext.getState().side!=='front')useCoverContext.getState().setSide('front');
    if(props.panel!=='text')return;
    const state=useEditor.getState();
    const current=state.book?.pages[state.pageIndex];
    if(!current)return;
    const selectedText=current.elements.find(element=>element.type==='text'&&state.selected.includes(element.id));
    if(selectedText)return;
    const firstText=current.elements.find(element=>element.type==='text');
    if(firstText)state.select(firstText.id);
  },[props.panel,page?.id,page?.type,selectedIds.join('|')]);

  const effectiveCoverSide=page?.type==='cover'?'front':coverSide;
  if(props.panel==='text'&&effectiveCoverSide==='back')return <BackCoverTextPanel onClose={props.onClose} placement={props.placement} paired={props.paired}/>;
  if(props.panel==='stickers'&&effectiveCoverSide==='back')return <BackCoverStickerPanel onClose={props.onClose} placement={props.placement} paired={props.paired}/>;

  return <>
    <EditorPanelCore {...props}/>
    {props.panel==='stickers'&&stickerGrid&&createPortal(<CakeStickerButtons/>,stickerGrid)}
  </>;
}