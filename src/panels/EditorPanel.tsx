import {useEffect,useLayoutEffect,useState,type ComponentProps,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Copy,Trash2,X} from 'lucide-react';
import {backCoverFor,textElement,uid,type Element} from '../domain/model';
import {createPolaroidElement,polaroidTemplates,type PolaroidStyleId} from '../domain/polaroids';
import {addBackCoverElement,copyBackCoverElements,deleteBackCoverElements,pasteBackCoverElements,updateBackCoverElement} from '../domain/backCoverElements';
import {useCoverContext} from '../store/coverContext';
import {useEditor} from '../store/editor';
import {Button,IconButton} from '../components/ui';
import {EditorPanel as EditorPanelCore} from './EditorPanelCore';
import './coverPanelCompact.css';
export type {PanelId} from './EditorPanelCore';

const baseStickers=['★','♡','✿','↗','✦','♥','☀','✈','✽','☻','❀','➜','✉','♫','☁','✧'] as const;
const cakeStickers=['🎂','🍰','🧁','🍩','🍪','🍓','🍒','🍬','🍭','🕯️','🎈','🎁','🥳','🎉','✨'] as const;
const emojiFont='"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

function CakeStickerButtons(){
  return <>{cakeStickers.map(sticker=><button key={sticker} type="button" title={`添加 ${sticker} 贴纸`} aria-label={`添加 ${sticker} 贴纸`} onClick={()=>useEditor.getState().addElement({...textElement(sticker,{fontSize:180,width:260,height:280,fontFamily:emojiFont,color:'#b47d7d'}),type:'sticker'})}>{sticker}</button>)}</>;
}

function PolaroidStickerSection(){
  const add=(style:PolaroidStyleId)=>useEditor.getState().addElement(createPolaroidElement(style));
  return <section style={{marginTop:18}} aria-label="拍立得贴纸">
    <p className="field-label">拍立得</p>
    <p className="muted" style={{marginTop:-4}}>点击添加；双击画布中的拍立得可去素材库换图。照片区域可拖动构图、滚轮缩放，外框可拖动、旋转和缩放。</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:10}}>
      {polaroidTemplates.map(template=><button
        key={template.id}
        type="button"
        onClick={()=>add(template.id)}
        title={`添加${template.name}`}
        style={{display:'flex',flexDirection:'column',gap:7,alignItems:'stretch',padding:8,border:'1px solid rgba(38,38,38,.12)',borderRadius:10,background:'rgba(255,255,255,.66)',cursor:'pointer',textAlign:'left'}}
      >
        <span style={{position:'relative',display:'block',aspectRatio:'4 / 5',overflow:'hidden',borderRadius:7,background:'linear-gradient(145deg,#ecebe7,#dcdad4)'}}>
          <img src={template.overlay} alt="" draggable={false} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'contain'}}/>
        </span>
        <span style={{fontSize:12,fontWeight:650,color:'inherit'}}>{template.name}</span>
        <span className="muted" style={{fontSize:10,lineHeight:1.35}}>{template.description}</span>
      </button>)}
    </div>
  </section>;
}

function PaperTapeSelectionActions(){
  const page=useEditor(state=>state.book?.pages[state.pageIndex]);
  const selectedIds=useEditor(state=>state.selected);
  const hasPaperTape=page?.elements.some(element=>
    selectedIds.includes(element.id)
    &&element.type==='shape'
    &&!element.shadow
    &&element.width/Math.max(1,element.height)>=3
  );
  if(!hasPaperTape)return null;
  return <div className="segments" style={{marginTop:14}} aria-label="纸胶带选择操作">
    <Button disabled={!selectedIds.length} onClick={()=>useEditor.getState().duplicateSelected()}><Copy size={15}/>复制所选</Button>
    <Button className="danger" disabled={!selectedIds.length} onClick={()=>useEditor.getState().deleteSelected()}><Trash2 size={15}/>删除所选</Button>
  </div>;
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
    {props.panel==='stickers'&&stickerGrid?.parentElement&&createPortal(<PolaroidStickerSection/>,stickerGrid.parentElement)}
    {props.panel==='stickers'&&stickerGrid?.parentElement&&createPortal(<PaperTapeSelectionActions/>,stickerGrid.parentElement)}
  </>;
}