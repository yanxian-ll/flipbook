import {useEffect,useLayoutEffect,useMemo,useRef,useState,type ComponentProps,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Copy,Trash2,Upload,X} from 'lucide-react';
import {backCoverFor,textElement,uid,type Asset,type Element} from '../domain/model';
import {prepareAsset} from '../domain/assets';
import {createPolaroidElement,polaroidAssetIdFor,polaroidAssetPatch,polaroidTemplates,type PolaroidStyleId} from '../domain/polaroids';
import {addBackCoverElement,copyBackCoverElements,deleteBackCoverElements,pasteBackCoverElements,updateBackCoverElement} from '../domain/backCoverElements';
import {friendlyError,repository} from '../db/repository';
import {useCoverContext} from '../store/coverContext';
import {useEditor} from '../store/editor';
import {Button,ErrorMessage,IconButton} from '../components/ui';
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
    <p className="muted" style={{marginTop:-4}}>点击添加。点外框选择整张拍立得，可移动、旋转、缩放；点照片区域拖动构图、滚轮缩放；双击进入拍立得专用素材选择。</p>
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

function PolaroidAssetThumbnail({asset,templateSelected,polaroidSelected,onClick}:{asset:Asset;templateSelected:boolean;polaroidSelected:boolean;onClick:()=>void}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let alive=true,created='';
    void repository.getAsset(asset.id).then(stored=>{
      if(!alive||!stored)return;
      created=URL.createObjectURL(stored.thumbnail);
      setUrl(created);
    }).catch(()=>{});
    return()=>{alive=false;if(created)URL.revokeObjectURL(created);};
  },[asset.id]);
  const outline=polaroidSelected?'3px solid #e9933b':templateSelected?'2px solid #3185ff':'1px solid rgba(38,38,38,.12)';
  return <button
    type="button"
    onClick={onClick}
    aria-pressed={polaroidSelected}
    title={polaroidSelected?'再次点击可取消当前拍立得图片':templateSelected?'此图片已用于页面模板，可同时用于拍立得':'选择为拍立得图片'}
    style={{position:'relative',display:'block',padding:3,border:0,borderRadius:10,background:'#fff',outline,outlineOffset:-1,cursor:'pointer',overflow:'hidden',boxShadow:templateSelected&&polaroidSelected?'inset 0 0 0 3px #3185ff':'0 1px 5px rgba(0,0,0,.08)'}}
  >
    <span style={{display:'block',aspectRatio:'1 / 1',borderRadius:7,overflow:'hidden',background:'#ecebea'}}>
      {url?<img src={url} alt={asset.name} draggable={false} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}/>:<span className="muted" style={{display:'grid',placeItems:'center',height:'100%',fontSize:10}}>加载中</span>}
    </span>
    <span style={{display:'block',padding:'5px 3px 2px',fontSize:10,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{asset.name}</span>
    <span style={{position:'absolute',left:7,top:7,display:'flex',gap:4,flexWrap:'wrap',maxWidth:'calc(100% - 14px)'}}>
      {templateSelected&&<small style={{padding:'2px 5px',borderRadius:999,background:'#3185ff',color:'#fff',fontSize:8,fontWeight:700}}>模板</small>}
      {polaroidSelected&&<small style={{padding:'2px 5px',borderRadius:999,background:'#e9933b',color:'#fff',fontSize:8,fontWeight:700}}>拍立得</small>}
    </span>
  </button>;
}

function PolaroidPhotoPanel({elementId,onClose,placement,paired}:CoverPanelProps&{elementId:string}){
  const book=useEditor(state=>state.book)!;
  const pageIndex=useEditor(state=>state.pageIndex);
  const page=book.pages[pageIndex];
  const element=page.elements.find(item=>item.id===elementId&&!!item.polaroidStyle);
  const [query,setQuery]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const input=useRef<HTMLInputElement>(null);
  const currentAssetId=element?polaroidAssetIdFor(element):undefined;
  const templateAssetIds=useMemo(()=>new Set(page.elements
    .filter(item=>item.type==='image'&&!item.polaroidStyle&&!item.freeImage&&!!item.assetId)
    .map(item=>item.assetId!)),[page.elements]);
  const visibleAssets=useMemo(()=>{
    const normalized=query.trim().toLocaleLowerCase();
    return [...book.assets]
      .sort((a,b)=>b.createdAt-a.createdAt)
      .filter(asset=>!normalized||asset.name.toLocaleLowerCase().includes(normalized));
  },[book.assets,query]);

  if(!element)return <PanelShell title="拍立得照片" onClose={onClose} placement={placement} paired={paired}><p className="muted">当前拍立得已不存在。</p></PanelShell>;

  function choose(assetId:string){
    const next=currentAssetId===assetId?undefined:assetId;
    useEditor.getState().updateElement(element!.id,polaroidAssetPatch(next));
  }
  function clear(){useEditor.getState().updateElement(element!.id,polaroidAssetPatch(undefined));}
  async function upload(files:FileList|null){
    if(!files?.length)return;
    setBusy(true);setError('');
    const batch={id:uid(),at:Date.now()};
    try{
      const added=[];
      for(const file of Array.from(files))added.push(await prepareAsset(file,batch));
      if(added.length)await useEditor.getState().addAssets(added);
    }catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);if(input.current)input.current.value='';}
  }

  return <PanelShell title="拍立得照片" onClose={onClose} placement={placement} paired={paired}>
    <p className="muted">这里的选择只属于当前拍立得，不会改变本页模板的照片数量。蓝框是模板照片，橙框是当前拍立得照片；同一张素材可以同时用于两者。</p>
    <div style={{display:'flex',gap:12,alignItems:'center',fontSize:10,margin:'8px 0 12px',flexWrap:'wrap'}}>
      <span style={{display:'inline-flex',alignItems:'center',gap:5}}><i style={{width:12,height:12,borderRadius:3,border:'2px solid #3185ff'}}/>模板照片</span>
      <span style={{display:'inline-flex',alignItems:'center',gap:5}}><i style={{width:12,height:12,borderRadius:3,border:'3px solid #e9933b'}}/>当前拍立得</span>
    </div>
    <ErrorMessage message={error}/>
    <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={event=>void upload(event.target.files)}/>
    <div className="asset-library-tools" style={{marginBottom:10}}>
      <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜索文件名" aria-label="搜索拍立得素材"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:8}}>
      {visibleAssets.map(asset=><PolaroidAssetThumbnail
        key={asset.id}
        asset={asset}
        templateSelected={templateAssetIds.has(asset.id)}
        polaroidSelected={currentAssetId===asset.id}
        onClick={()=>choose(asset.id)}
      />)}
    </div>
    {!visibleAssets.length&&<p className="empty-panel">{book.assets.length?'没有匹配的素材':'还没有照片，请先添加素材。'}</p>}
    <div className="photo-selection-actions photo-library-actions" style={{marginTop:14}}>
      <Button disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{busy?'处理中…':'添加照片'}</Button>
      <Button disabled={!currentAssetId} onClick={clear}>清空拍立得照片</Button>
      <Button className="primary" onClick={onClose}>完成</Button>
    </div>
  </PanelShell>;
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
  const selectedPolaroid=page?.elements.find(element=>selectedIds.includes(element.id)&&!!element.polaroidStyle);

  useEffect(()=>{
    setStickerGrid(null);
    if(props.panel!=='stickers'||coverSide==='back')return;
    const frame=requestAnimationFrame(()=>setStickerGrid(document.querySelector<HTMLElement>('.editor-panel .sticker-grid')));
    return()=>cancelAnimationFrame(frame);
  },[props.panel,coverSide]);

  // The legacy white "polaroid backing paper" button predates real polaroid elements. Keep the
  // old core panel untouched for compatibility, but remove that obsolete control from the UI.
  useLayoutEffect(()=>{
    if(props.panel!=='stickers')return;
    const hidden:HTMLButtonElement[]=[];
    document.querySelectorAll<HTMLButtonElement>('.editor-panel button').forEach(button=>{
      if(button.textContent?.trim()!=='添加拍立得底纸')return;
      button.style.display='none';
      button.setAttribute('aria-hidden','true');
      button.tabIndex=-1;
      hidden.push(button);
    });
    return()=>hidden.forEach(button=>{button.style.display='';button.removeAttribute('aria-hidden');button.tabIndex=0;});
  },[props.panel,coverSide,page?.id]);

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
  if(props.panel==='photos'&&selectedPolaroid)return <PolaroidPhotoPanel elementId={selectedPolaroid.id} onClose={props.onClose} placement={props.placement} paired={props.paired}/>;
  if(props.panel==='text'&&effectiveCoverSide==='back')return <BackCoverTextPanel onClose={props.onClose} placement={props.placement} paired={props.paired}/>;
  if(props.panel==='stickers'&&effectiveCoverSide==='back')return <BackCoverStickerPanel onClose={props.onClose} placement={props.placement} paired={props.paired}/>;

  return <>
    <EditorPanelCore {...props}/>
    {props.panel==='stickers'&&stickerGrid&&createPortal(<CakeStickerButtons/>,stickerGrid)}
    {props.panel==='stickers'&&stickerGrid?.parentElement&&createPortal(<PolaroidStickerSection/>,stickerGrid.parentElement)}
    {props.panel==='stickers'&&stickerGrid?.parentElement&&createPortal(<PaperTapeSelectionActions/>,stickerGrid.parentElement)}
  </>;
}
