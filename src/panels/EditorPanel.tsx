import {useEffect,useMemo,useRef,useState,type DragEvent as ReactDragEvent} from 'react';
import {useShallow} from 'zustand/react/shallow';
import {Plus,X,Upload,ArrowUp,ArrowDown,Copy,Trash2} from 'lucide-react';
import {CoverSettingsPanel} from './CoverSettingsPanel';
import {WorkspaceBackgroundPanel} from './WorkspaceBackgroundPanel';
import {BookStylePanel} from './BookStylePanel';
import {VirtualAssetLibrary} from '../components/VirtualAssetLibrary';
import {VisualTemplateEditor} from '../editor/VisualTemplateEditor';
import {useEditor} from '../store/editor';
import {useCoverContext,type CoverSide} from '../store/coverContext';
import {applyLayout,layoutsForTheme,fitAssetIds,frameIsFixed,type Slot} from '../domain/layouts';
import {PageThumbnail} from '../components/PageThumbnail';
import {H,W,backCoverFor,coverTemplateFor,coverTemplatesFor,imageElement,textElement,uid,type Book,type Element,type Asset,type CoverTemplate} from '../domain/model';
import {prepareAsset} from '../domain/assets';
import {friendlyError,repository} from '../db/repository';
import {Button,ErrorMessage,IconButton,Modal} from '../components/ui';

export type PanelId='photos'|'layouts'|'text'|'stickers'|'background'|'page-background'|'cover'|'book-style'|'adjust';
const names:Record<PanelId,string>={photos:'上传素材',layouts:'选择排版',text:'文字',stickers:'贴纸',background:'垫底背景','page-background':'页面背景',cover:'封面设置','book-style':'画册风格',adjust:'调整元素'};
const colors=['#ffffff','#eeeae3','#f5ec30','#e48af5','#d9eb51','#75a4e1','#ff9658','#f6c9cc','#1a1a1a'];
const supportedTextFonts=['Domine','Arial','Georgia','KaiTi','STKaiti','cursive','sans-serif'] as const;
const textPaletteColors=['#252525','#f3f0e8','#88786f','#b47d7d','#7f9483','#788da5'] as const;
const assetThumbnailCache=new Map<string,Blob>();
const assetThumbnailPending=new Map<string,Promise<Blob|undefined>>();
const ASSET_THUMBNAIL_CACHE_LIMIT=160;

function normalizedHexColor(value:string|undefined){
  const color=(value??'').trim();
  if(/^#[0-9a-f]{6}$/i.test(color))return color.toLowerCase();
  if(/^#[0-9a-f]{3}$/i.test(color)){
    const [r,g,b]=color.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return '#252525';
}
function ColorPaletteField({value,onChange}:{value:string|undefined;onChange:(color:string)=>void}){
  const current=normalizedHexColor(value);
  return <div className="field color-memory-field">
    <span>颜色</span>
    <div className="color-memory-controls">
      <input type="color" aria-label="调色盘" value={current} onChange={event=>onChange(event.target.value)}/>
      <span className="recent-color-swatches" aria-label="常用颜色">{textPaletteColors.map(color=><button key={color} type="button" aria-label={`使用颜色 ${color}`} title={color} className={`recent-color-swatch ${normalizedHexColor(color)===current?'chosen':''}`} style={{backgroundColor:color}} onClick={()=>onChange(color)}/>)}</span>
    </div>
  </div>;
}

async function assetThumbnail(id:string){
  const hit=assetThumbnailCache.get(id);
  if(hit){
    assetThumbnailCache.delete(id);
    assetThumbnailCache.set(id,hit);
    return hit;
  }
  const pending=assetThumbnailPending.get(id);
  if(pending)return pending;
  const task=repository.getAsset(id).then(asset=>{
    const blob=asset?.thumbnail;
    if(blob){
      assetThumbnailCache.set(id,blob);
      while(assetThumbnailCache.size>ASSET_THUMBNAIL_CACHE_LIMIT){
        const oldest=assetThumbnailCache.keys().next().value as string|undefined;
        if(!oldest)break;
        assetThumbnailCache.delete(oldest);
      }
    }
    return blob;
  }).finally(()=>assetThumbnailPending.delete(id));
  assetThumbnailPending.set(id,task);
  return task;
}

function patchBackCover(draft:Book,patch:Partial<ReturnType<typeof backCoverFor>>){
  const current=backCoverFor(draft),next={...current,...patch};
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
}

type EditorPanelProps={
  panel:PanelId;
  onClose:()=>void;
  onPanel:(panel:PanelId)=>void;
  placement?:'left'|'right';
  photoIds?:string[];
  onPhotoIdsChange?:(ids:string[])=>void;
  paired?:boolean;
};

export function EditorPanel({panel,onClose,onPanel,placement,photoIds:controlledPhotoIds,onPhotoIdsChange,paired=false}:EditorPanelProps){
  const s=useEditor(useShallow(state=>({
    book:state.book,
    pageIndex:state.pageIndex,
    selected:state.selected,
    change:state.change,
    updateElement:state.updateElement,
    setPhotos:state.setPhotos,
    select:state.select,
    addAssets:state.addAssets,
    removeAssets:state.removeAssets,
    layout:state.layout,
    addElement:state.addElement,
    duplicateSelected:state.duplicateSelected,
    deleteSelected:state.deleteSelected,
  })));
  const book=s.book!;
  const page=book.pages[s.pageIndex];
  const contextSide=useCoverContext(state=>state.side);
  const coverSide:CoverSide|null=contextSide??(page.type==='cover'?'front':null);
  const coverTarget=coverSide!==null;
  const frontPhoto=book.pages[0].elements.find(element=>element.type==='image');
  const back=backCoverFor(book);
  const coverAssetId=coverSide==='front'?frontPhoto?.assetId:coverSide==='back'?back.assetId:undefined;
  const coverTemplateId=coverSide==='front'?book.coverTemplate:coverSide==='back'?back.templateId:undefined;
  const coverBackground=coverSide==='front'?book.pages[0].background:coverSide==='back'?(back.backgroundMode==='match-front'?book.pages[0].background:back.background):page.background;
  const selected=coverSide==='back'?undefined:page.elements.find(element=>s.selected.includes(element.id));

  const initialPhotoIds=()=>coverTarget
    ?coverAssetId?[coverAssetId]:[]
    :[...new Set(page.elements.filter(element=>element.type==='image').map(element=>element.assetId).filter((id):id is string=>!!id))];
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[count,setCount]=useState(0),[localPhotoIds,setLocalPhotoIds]=useState<string[]>(initialPhotoIds),[dragAssetId,setDragAssetId]=useState<string|null>(null),[dragOverAssetId,setDragOverAssetId]=useState<string|null>(null),[assetFilter,setAssetFilter]=useState<'all'|'used'|'unused'>('all'),[assetSort,setAssetSort]=useState<'recent'|'oldest'|'name'>('recent'),[assetQuery,setAssetQuery]=useState(''),[assetDeleteOpen,setAssetDeleteOpen]=useState(false);
  const input=useRef<HTMLInputElement>(null),suppressAssetClick=useRef(false),cancelUpload=useRef(false);
  const photoIds=coverTarget?localPhotoIds:(controlledPhotoIds??localPhotoIds);
  const setPhotoIds=(ids:string[])=>{
    const next=[...new Set(ids.filter(Boolean))].slice(0,coverTarget||page.type==='cover'?1:9);
    if(coverTarget)setLocalPhotoIds(next);
    else if(onPhotoIdsChange)onPhotoIdsChange(next);
    else setLocalPhotoIds(next);
  };

  useEffect(()=>{
    if(!coverTarget)return;
    setLocalPhotoIds(coverAssetId?[coverAssetId]:[]);
  },[coverTarget,coverSide,coverAssetId]);

  function applyCoverPhoto(assetId:string|undefined){
    if(!coverSide)return;
    s.change(draft=>{
      if(coverSide==='back'){
        patchBackCover(draft,{assetId,crop:{x:.5,y:.5,zoom:1}});
        return;
      }
      const cover=draft.pages[0];
      const existing=cover.elements.find(element=>element.type==='image');
      if(!assetId){
        cover.elements=cover.elements.filter(element=>element.type!=='image');
        return;
      }
      if(existing){
        existing.assetId=assetId;
        existing.crop={x:.5,y:.5,zoom:1};
        return;
      }
      const template=coverTemplateFor(draft,draft.coverTemplate);
      const slot=template.slot??coverTemplateFor(draft,'cutout').slot!;
      cover.elements.unshift(imageElement(assetId,{x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape}));
    });
  }

  function reorderSelectedAsset(targetId:string){
    const fromId=dragAssetId;
    if(!fromId||fromId===targetId)return;
    const from=photoIds.indexOf(fromId),to=photoIds.indexOf(targetId);
    if(from<0||to<0)return;
    const next=[...photoIds];
    const [moved]=next.splice(from,1);
    next.splice(to,0,moved);
    setPhotoIds(next);
    if(!coverTarget&&page.type!=='cover'&&page.layoutId){
      const applied=[...new Set(page.elements.filter(element=>element.type==='image'&&!element.freeImage&&element.assetId).map(element=>element.assetId!))];
      const pureReorder=applied.length===next.length&&applied.every(id=>next.includes(id));
      if(pureReorder)s.setPhotos(next);
    }
  }

  function chooseAsset(assetId:string){
    if(suppressAssetClick.current)return;
    if(coverTarget){
      const next=photoIds.includes(assetId)?[]:[assetId];
      setPhotoIds(next);
      applyCoverPhoto(next[0]);
      return;
    }
    if(page.type==='cover'){
      if(photoIds.includes(assetId)){setPhotoIds([]);return;}
      setPhotoIds([assetId]);
      const image=page.elements.find(element=>element.type==='image');
      if(image)s.updateElement(image.id,{assetId,crop:{x:.5,y:.5,zoom:1}});
      else s.setPhotos([assetId]);
      return;
    }
    if(selected?.type==='image'){
      const next=[...photoIds],old=selected.assetId,index=old?next.indexOf(old):-1;
      if(index>=0){next[index]=assetId;setPhotoIds(next);}
      else if(next.length<9)setPhotoIds([...next,assetId]);
      s.updateElement(selected.id,{assetId,crop:{x:.5,y:.5,zoom:1}});
      s.select(null);
      return;
    }
    setPhotoIds(photoIds.includes(assetId)?photoIds.filter(id=>id!==assetId):photoIds.length<9?[...photoIds,assetId]:photoIds);
  }

  async function upload(files:FileList|null){
    if(!files?.length)return;
    setBusy(true);setError('');cancelUpload.current=false;
    const uploadBatch={id:uid(),at:Date.now()};
    try{
      const added=[];
      for(let i=0;i<files.length;i++){
        if(cancelUpload.current)break;
        setCount(i+1);
        const prepared=await prepareAsset(files[i],uploadBatch);
        if(cancelUpload.current)break;
        added.push(prepared);
      }
      if(added.length)await s.addAssets(added);
    }catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);setCount(0);cancelUpload.current=false;if(input.current)input.current.value='';}
  }

  async function removeSelectedAssets(){
    if(!photoIds.length)return;
    setBusy(true);setError('');
    try{
      await s.removeAssets(photoIds);
      setPhotoIds([]);
      setAssetDeleteOpen(false);
    }catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);}
  }

  const selectedAssets=useMemo(()=>photoIds.map(id=>book.assets.find(asset=>asset.id===id)).filter((asset):asset is Asset=>!!asset),[book.assets,photoIds]);
  const usedAssetIds=useMemo(()=>{
    const ids=new Set(book.pages.flatMap(item=>item.elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!)));
    if(book.workspaceImageId)ids.add(book.workspaceImageId);
    if(book.backCover?.assetId)ids.add(book.backCover.assetId);
    return ids;
  },[book.pages,book.workspaceImageId,book.backCover?.assetId]);
  const selectedUsedCount=useMemo(()=>photoIds.filter(id=>usedAssetIds.has(id)).length,[photoIds,usedAssetIds]);
  const selectedUsePages=useMemo(()=>book.pages.filter(item=>item.elements.some(element=>element.type==='image'&&!!element.assetId&&photoIds.includes(element.assetId))).length,[book.pages,photoIds]);
  const selectedSpecialUses=Number(!!book.backCover?.assetId&&photoIds.includes(book.backCover.assetId))+Number(!!book.workspaceImageId&&photoIds.includes(book.workspaceImageId));
  const deleteDescription=selectedUsedCount
    ?`其中 ${selectedUsedCount} 张正在 ${selectedUsePages} 个页面${selectedSpecialUses?`及 ${selectedSpecialUses} 个封面/背景位置`:''}中使用。删除后对应位置会变为空白；素材删除不进入普通撤销栈，但删除前会保留历史版本。`
    :'这些素材当前没有被画册页面使用。删除后不会出现在素材库中。';
  const assetUsage=useMemo(()=>({
    used:book.assets.reduce((sum,asset)=>sum+Number(usedAssetIds.has(asset.id)),0),
    unused:book.assets.reduce((sum,asset)=>sum+Number(!usedAssetIds.has(asset.id)),0),
  }),[book.assets,usedAssetIds]);
  const libraryAssets=useMemo(()=>{
    const selectedSet=new Set(photoIds),query=assetQuery.trim().toLocaleLowerCase();
    return book.assets.filter(asset=>{
      if(selectedSet.has(asset.id))return false;
      if(assetFilter==='used'&&!usedAssetIds.has(asset.id))return false;
      if(assetFilter==='unused'&&usedAssetIds.has(asset.id))return false;
      return !query||asset.name.toLocaleLowerCase().includes(query);
    });
  },[book.assets,photoIds,assetFilter,assetQuery,usedAssetIds]);
  const assetBatches=useMemo(()=>{
    if(assetSort==='name'){
      return libraryAssets.length?[{id:'__name__',at:0,legacy:false,assets:[...libraryAssets].sort((a,b)=>a.name.localeCompare(b.name,'zh-CN',{numeric:true}))}]:[];
    }
    const groups=new Map<string,{id:string;at:number;legacy:boolean;assets:Asset[]}>();
    for(const asset of libraryAssets){
      const legacy=!asset.uploadBatchId,key=legacy?'__legacy__':asset.uploadBatchId!;
      const existing=groups.get(key);
      if(existing){existing.assets.push(asset);existing.at=Math.max(existing.at,asset.uploadBatchAt??asset.createdAt);}
      else groups.set(key,{id:key,at:asset.uploadBatchAt??asset.createdAt,legacy,assets:[asset]});
    }
    const direction=assetSort==='oldest'?1:-1;
    return [...groups.values()]
      .sort((a,b)=>a.legacy===b.legacy?(a.at-b.at)*direction:a.legacy?1:-1)
      .map(group=>({...group,assets:[...group.assets].sort((a,b)=>(a.createdAt-b.createdAt)*(assetSort==='oldest'?1:-1))}));
  },[libraryAssets,assetSort]);
  const libraryAssetCount=assetBatches.reduce((sum,batch)=>sum+batch.assets.length,0);
  const formatBatch=(batch:{at:number;legacy:boolean})=>batch.legacy?'较早上传':new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(batch.at));

  const [customOpen,setCustomOpen]=useState(false),[customName,setCustomName]=useState('我的模板'),[customSlots,setCustomSlots]=useState<Slot[]>([]);
  const pagePhotoIds=coverTarget
    ?coverAssetId?[coverAssetId]:[]
    :page.elements.filter(element=>element.type==='image').map(element=>element.assetId).filter((id):id is string=>!!id);
  const photoCount=pagePhotoIds.length;
  const layoutSourceIds=photoIds.length?photoIds:[...new Set(pagePhotoIds)];
  const previewSourceIds=layoutSourceIds.length?layoutSourceIds:book.assets.slice(0,1).map(asset=>asset.id);
  const preferredLayoutCount=Math.max(1,Math.min(9,photoIds.length||[...new Set(pagePhotoIds)].length||1));
  const [layoutCount,setLayoutCount]=useState(preferredLayoutCount);
  useEffect(()=>{setLayoutCount(preferredLayoutCount);},[preferredLayoutCount,page.id]);
  const allLayouts=useMemo(()=>coverTarget||page.type==='cover'?[]:[...layoutsForTheme(book.themeId),...(book.customLayouts??[])],[coverTarget,page.type,book.themeId,book.customLayouts]);
  const layoutCounts=useMemo(()=>new Set(allLayouts.map(layout=>layout.slots.length)),[allLayouts]);
  const variants=useMemo(()=>coverTarget||page.type==='cover'?[]:allLayouts
    .filter(layout=>layout.slots.length===layoutCount)
    .sort((a,b)=>Number(b.id===page.layoutId)-Number(a.id===page.layoutId))
    .map(layout=>({layout,preview:applyLayout(page,layout,fitAssetIds(previewSourceIds,layout.slots.length))})),
  [coverTarget,allLayouts,layoutCount,page,previewSourceIds.join('|')]);
  const coverTemplates=useMemo(()=>coverTemplatesFor(book)
    .sort((a,b)=>Number(b.id===coverTemplateId)-Number(a.id===coverTemplateId)),
  [book.customCoverTemplates,coverTemplateId]);

  function applyCoverTemplate(template:CoverTemplate){
    if(!coverSide)return;
    s.change(draft=>{
      if(coverSide==='back'){
        patchBackCover(draft,{templateId:template.id});
        return;
      }
      draft.coverTemplate=template.id;
      const image=draft.pages[0].elements.find(element=>element.type==='image');
      if(image&&template.slot)Object.assign(image,{
        x:template.slot.x*W,
        y:template.slot.y*H,
        width:template.slot.width*W,
        height:template.slot.height*H,
        frameLocked:true,
        frameShape:template.slot.shape,
      });
    });
  }

  function openCustomTemplate(){
    if(coverTarget){
      const selectedTemplate=coverTemplates.find(template=>template.id===coverTemplateId)??coverTemplateFor(book,'cutout');
      const slot=selectedTemplate.slot??coverTemplateFor(book,'cutout').slot!;
      setCustomSlots([{...slot}]);
      setCustomName('我的封面模板');
    }else{
      setCustomSlots(page.elements.filter(element=>element.type==='image').map(element=>({x:element.x/W,y:element.y/H,width:element.width/W,height:element.height/H,shape:element.frameShape})));
      setCustomName('我的模板');
    }
    setCustomOpen(true);
  }

  function saveCustomTemplate(){
    if(customSlots.some(slot=>slot.width<=0||slot.height<=0||slot.x<0||slot.y<0||slot.x+slot.width>1.001||slot.y+slot.height>1.001)){
      setError('请将所有图框放在页面范围内。');
      return;
    }
    if(coverTarget){
      const slot=customSlots[0];
      if(!slot){setError('封面模板需要一个照片区域。');return;}
      const template:CoverTemplate={id:'cover-custom-'+uid(),name:customName.trim()||'我的封面模板',slot:{...slot}};
      s.change(draft=>{
        (draft.customCoverTemplates??=[]).push(template);
        if(coverSide==='back')patchBackCover(draft,{templateId:template.id});
        else{
          draft.coverTemplate=template.id;
          const image=draft.pages[0].elements.find(element=>element.type==='image');
          if(image)Object.assign(image,{x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape});
        }
      });
    }else{
      const layout={id:'custom-'+uid(),name:customName.trim()||'我的模板',minImages:customSlots.length,maxImages:customSlots.length,slots:customSlots,background:page.templateBackground??page.background,overlay:page.templateOverlay,texts:page.elements.filter(element=>element.type==='text').map(element=>({x:element.x/W,y:element.y/H,width:element.width/W,height:element.height/H,key:element.templateTextKey??element.id,text:element.text??'',fontFamily:element.fontFamily??'Domine',fontSize:(element.fontSize??60)/W,fontWeight:element.fontWeight??400,fontStyle:element.fontStyle,color:element.color??'#222',align:element.align??'left',lineHeight:element.lineHeight??1.2,letterSpacing:(element.letterSpacing??0)*320/W}))};
      s.change(draft=>{(draft.customLayouts??=[]).push(layout);draft.pages[s.pageIndex]=applyLayout(draft.pages[s.pageIndex],layout);});
    }
    setError('');
    setCustomOpen(false);
  }

  const fixed=selected?frameIsFixed(page,selected):false;
  const templateTexts=page.elements.filter((element):element is Element=>element.type==='text'&&!!element.templateTextKey);
  const update=(patch:Partial<Element>)=>{if(selected)s.updateElement(selected.id,patch);};
  const updateColor=(color:string)=>{if(selected)s.updateElement(selected.id,{color:normalizedHexColor(color)});};
  const addText=(text:string,size:number)=>{const style=book.bookStyle??{fontFamily:'Domine',textColor:'#252525'};s.addElement(textElement(text,{fontSize:size,fontFamily:style.fontFamily??'Domine',color:style.textColor??'#252525'}));};
  const layer=(direction:number)=>{if(!selected)return;s.change(draft=>{const elements=draft.pages[s.pageIndex].elements;const index=elements.findIndex(element=>element.id===selected.id);const [element]=elements.splice(index,1);elements.splice(Math.max(0,Math.min(elements.length,index+direction)),0,element);});};
  const coverLabel=coverSide==='back'?'后封面':'前封面';
  const panelTitle=coverTarget&&panel==='layouts'?`${coverLabel}模板`:coverTarget&&panel==='photos'?`${coverLabel}照片`:names[panel];

  return <aside className={`editor-panel ${placement?`panel-${placement}`:''} ${paired?'paired-library-panel':''}`}>
    <div className="panel-grabber"/>
    <header><h2>{panelTitle}</h2><IconButton label="关闭面板" onClick={onClose}><X size={17}/></IconButton></header>
    <ErrorMessage message={error}/>
    <div className="panel-body">
      {panel==='photos'&&<>
        <p className="muted">{coverTarget?`点击任意素材，直接设置${coverLabel}照片。模板只控制照片是否显示以及照片窗口的位置。`:selected?.type==='image'?'点击任意素材，直接替换当前图框。':'选择本页照片（最多 9 张）'}</p>
        {coverTarget&&!coverTemplateFor(book,coverTemplateId).slot&&<p className="cover-library-note">当前模板不显示照片。你仍可先选好照片，切换到带图模板后会自动显示。</p>}
        <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={event=>void upload(event.target.files)}/>
        <div className="asset-library-manager">
          <div className="asset-library-tabs" role="tablist" aria-label="筛选素材">
            <button type="button" role="tab" aria-selected={assetFilter==='all'} className={assetFilter==='all'?'active':''} onClick={()=>setAssetFilter('all')}>全部 <small>{book.assets.length}</small></button>
            <button type="button" role="tab" aria-selected={assetFilter==='used'} className={assetFilter==='used'?'active':''} onClick={()=>setAssetFilter('used')}>已使用 <small>{assetUsage.used}</small></button>
            <button type="button" role="tab" aria-selected={assetFilter==='unused'} className={assetFilter==='unused'?'active':''} onClick={()=>setAssetFilter('unused')}>未使用 <small>{assetUsage.unused}</small></button>
          </div>
          <div className="asset-library-tools">
            <input type="search" value={assetQuery} onChange={event=>setAssetQuery(event.target.value)} placeholder="搜索文件名" aria-label="搜索素材"/>
            <select value={assetSort} onChange={event=>setAssetSort(event.target.value as 'recent'|'oldest'|'name')} aria-label="素材排序"><option value="recent">最近上传</option><option value="oldest">最早上传</option><option value="name">文件名 A–Z</option></select>
          </div>
        </div>
        <div className="asset-batches">
          {selectedAssets.length>0&&<section className="asset-batch asset-batch-selected">
            <div className="asset-batch-header"><span><b>{coverTarget?`${coverLabel}照片`:'本页已选'}</b></span><small>{selectedAssets.length} 张</small></div>
            <div className="asset-grid">{selectedAssets.map((asset,index)=><AssetTile key={asset.id} asset={asset} selectionIndex={index+1} draggable={!coverTarget} dragging={dragAssetId===asset.id} dragOver={dragOverAssetId===asset.id&&dragAssetId!==asset.id} onDragStart={event=>{suppressAssetClick.current=true;setDragAssetId(asset.id);setDragOverAssetId(asset.id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',asset.id);}} onDragEnter={event=>{event.preventDefault();if(dragAssetId&&dragAssetId!==asset.id)setDragOverAssetId(asset.id);}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect='move';}} onDrop={event=>{event.preventDefault();reorderSelectedAsset(asset.id);setDragAssetId(null);setDragOverAssetId(null);window.setTimeout(()=>{suppressAssetClick.current=false;},0);}} onDragEnd={()=>{setDragAssetId(null);setDragOverAssetId(null);window.setTimeout(()=>{suppressAssetClick.current=false;},0);}} onClick={()=>{setError('');chooseAsset(asset.id);}}/>)}</div>
          </section>}
          <VirtualAssetLibrary batches={assetBatches} label={(batch,index)=>assetSort==='name'?<>按文件名 <b>A–Z</b></>:<>{batch.legacy?'较早上传':assetSort==='oldest'?(index===0?'最早上传':'上传于'):(index===0?'最近上传':'上传于')} <b>{batch.legacy?'':formatBatch(batch)}</b></>} renderAsset={asset=><AssetTile key={asset.id} asset={asset} selectionIndex={0} used={usedAssetIds.has(asset.id)} onClick={()=>{setError('');chooseAsset(asset.id);}}/>}/>
          {book.assets.length>0&&libraryAssetCount===0&&<p className="asset-library-empty">{assetQuery?'没有匹配这个文件名的其他素材':'当前筛选下没有其他素材'}</p>}
        </div>
        {!book.assets.length&&<p className="empty-panel">还没有照片<br/>从下方添加照片开始制作。</p>}
        <div className="photo-selection-actions photo-library-actions">
          {busy?<Button onClick={()=>{cancelUpload.current=true;}}>取消处理 {count?`· ${count}`:''}</Button>:<Button onClick={()=>input.current?.click()}><Upload size={15}/>添加照片</Button>}
          <Button className="danger" disabled={busy||!photoIds.length} onClick={()=>setAssetDeleteOpen(true)}><Trash2 size={15}/>删除</Button>
          <Button className="primary" disabled={busy} onClick={()=>{
            if(coverTarget){applyCoverPhoto(photoIds[0]);if(!paired)onClose();return;}
            s.setPhotos(photoIds);
            if(!photoIds.length){if(!paired)onClose();return;}
            if(page.type==='cover')onClose();else if(!paired)onPanel('layouts');
          }}>使用 {photoIds.length} 张</Button>
        </div>
      </>}

      {panel==='layouts'&&(coverTarget?<>
        <p className="muted">模板只决定是否有照片窗口，以及照片窗口的位置、大小和形状。封皮颜色与文字不会被模板覆盖。</p>
        <div className="cover-template-options cover-template-library-options">{coverTemplates.map(template=>{
          const chosen=coverTemplateId===template.id;
          const mode=!template.slot?'plain':template.id==='basic'||template.id==='cutout'?template.id:'custom';
          return <Button key={template.id} aria-pressed={chosen} className={chosen?'cover-template-card chosen':'cover-template-card'} onClick={()=>applyCoverTemplate(template)}>
            <span className={`cover-template-sample ${mode}`} style={{backgroundColor:coverBackground}}>
              {template.slot&&<i style={{left:`${template.slot.x*100}%`,top:`${template.slot.y*100}%`,width:`${template.slot.width*100}%`,height:`${template.slot.height*100}%`,borderRadius:template.slot.shape==='ellipse'?'50%':undefined}}/>}
              <small>{coverSide==='back'?(back.text||'BACK COVER'):(book.pages[0].elements.find(element=>element.type==='text')?.text??'TIME TO FLIPBOOK')}</small>
            </span>
            <span>{template.name}</span>
          </Button>;
        })}</div>
        <Button className="full" onClick={openCustomTemplate}><Plus size={16}/>添加新封面模板</Button>
        <Button className="full" onClick={()=>onPanel('photos')}>选择{coverLabel}照片 · {photoIds.length||photoCount} 张</Button>
        <Button className="full" onClick={()=>onPanel('cover')}>返回封面设置</Button>
        <p className="muted">同一套封面模板可以分别用于前封面和后封面；两面的颜色、文字和照片选择彼此独立。</p>
      </>:<>
        <div className="photo-counts template-count-tabs" role="tablist" aria-label="按照片数量查看模板">{Array.from({length:9},(_,index)=>index+1).map(count=><button key={count} type="button" role="tab" aria-selected={layoutCount===count} className={layoutCount===count?'active':''} disabled={!layoutCounts.has(count)} onClick={()=>setLayoutCount(count)}>{count} 图</button>)}</div>
        <div className="layout-grid all-layout-grid">{variants.map(({layout,preview})=><button key={layout.id} aria-label={`${layout.name}，${layout.slots.length} 图模板`} title={layout.name} className={page.layoutId===layout.id?'chosen':''} disabled={!layoutSourceIds.length} onClick={()=>s.layout(layout.id,layoutSourceIds)}><span className="layout-mini"><PageThumbnail page={preview} scale={.12}/></span><span className="layout-card-meta"><small>{layout.name}</small><em>{layout.slots.length} 图</em></span></button>)}</div>
        {!variants.length&&<p className="muted">当前分类暂时没有模板，可以切换其他照片数量。</p>}
        {!layoutSourceIds.length&&<p className="muted">先在左侧素材库选择至少一张照片。模板仍可浏览。</p>}
        {!paired&&<Button className="full" onClick={()=>onPanel('photos')}>更换本页照片 · {photoIds.length||photoCount} 张</Button>}
        <Button className="full" onClick={()=>onPanel('page-background')}>页面底色与纹理</Button>
        <Button className="full" disabled={!photoCount} onClick={openCustomTemplate}>基于当前页新建模板</Button>
        <p className="muted">选择不同图数模板时会按模板图框数使用当前照片；多出的照片仍保留在素材库，不会被删除。图框内可拖动位置、滚轮缩放。</p>
      </>)}

      {panel==='text'&&(coverSide==='back'?<><p className="muted">后封面文字在“封面设置”中统一编辑，避免修改到最后一张内页。</p><Button className="full" onClick={()=>onPanel('cover')}>打开封面设置</Button></>:<>
        {templateTexts.length>0&&<section className="template-text-editor-list"><p className="field-label">本页模板文字</p>{templateTexts.map((element,index)=><label key={element.id} className="template-text-editor-item"><span>{index+1}</span><textarea rows={Math.min(3,Math.max(1,(element.text??'').split('\n').length))} value={element.text??''} onFocus={()=>s.select(element.id)} onChange={event=>s.updateElement(element.id,{text:event.target.value})}/></label>)}</section>}
        {selected?.type==='text'?<><p className="field-label">{selected.templateTextKey?'当前模板文字':'当前文字'}</p><textarea aria-label="文字内容" value={selected.text} onChange={event=>update({text:event.target.value})} rows={3}/><label className="field">字体<select value={selected.fontFamily??'Domine'} onChange={event=>update({fontFamily:event.target.value})}>{selected.fontFamily&&!supportedTextFonts.includes(selected.fontFamily as typeof supportedTextFonts[number])&&<option value={selected.fontFamily}>{selected.fontFamily} · 当前作品字体</option>}<option value="Domine">Domine · 杂志衬线</option><option value="Arial">Arial · 现代无衬线</option><option value="Georgia">Georgia · 经典</option><option value="KaiTi">楷体 · 手写感</option><option value="STKaiti">华文楷体 · 手写感</option><option value="cursive">手写体 · 系统</option><option value="sans-serif">系统无衬线</option></select></label><label className="field">字号<input type="range" min={8} max={240} value={selected.fontSize} onChange={event=>update({fontSize:+event.target.value})}/><span>{Math.round(selected.fontSize??0)}</span></label><ColorPaletteField value={selected.color} onChange={updateColor}/><div className="segments"><Button className={selected.fontWeight===700?'primary':''} onClick={()=>update({fontWeight:selected.fontWeight===700?400:700})}><b>B</b></Button><Button className={selected.fontStyle==='italic'?'primary':''} onClick={()=>update({fontStyle:selected.fontStyle==='italic'?'normal':'italic'})}><i>I</i></Button>{(['left','center','right'] as const).map((align,index)=><Button key={align} className={selected.align===align?'primary':''} onClick={()=>update({align})}>{['左','中','右'][index]}</Button>)}</div></>:templateTexts.length===0?<p className="muted">选择一段文字，或者添加新的文字</p>:null}
        <div className="text-presets"><button onClick={()=>addText('写下这一刻',100)}>添加标题 <Plus size={16}/></button><button onClick={()=>addText('一些值得记住的小事',54)}>添加副标题 <Plus size={16}/></button><button onClick={()=>addText('你的段落文字',36)}>添加正文 <Plus size={16}/></button><button onClick={()=>addText(new Date().toLocaleDateString('zh-CN'),28)}>日期 / 注释 <Plus size={16}/></button></div>
      </>)}

      {panel==='stickers'&&(coverSide==='back'?<p className="muted">后封面目前只使用封面模板、照片与文字设置，避免装饰误加到最后一张内页。</p>:<>
        <p className="muted">给回忆加一点小装饰</p>
        {selected?.type==='sticker'&&<><p className="field-label">当前贴纸</p><ColorPaletteField value={selected.color} onChange={updateColor}/></>}
        <div className="sticker-grid">{['★','♡','✿','↗','✦','♥','☀','✈','✽','☻','❀','➜','✉','♫','☁','✧'].map(sticker=><button key={sticker} onClick={()=>s.addElement({...textElement(sticker,{fontSize:180,width:240,height:260,fontFamily:'Arial',color:textPaletteColors[3]}),type:'sticker'})}>{sticker}</button>)}</div>
        <Button className="full" onClick={()=>s.addElement({id:uid(),type:'shape',x:280,y:180,width:460,height:90,rotation:-7,opacity:.65,color:'#ddd0a4'})}>添加纸胶带</Button><Button className="full" onClick={()=>s.addElement({id:uid(),type:'shape',x:140,y:250,width:800,height:1050,rotation:3,opacity:1,color:'#fff',shadow:true})}>添加拍立得底纸</Button>
      </>)}
      {panel==='background'&&<WorkspaceBackgroundPanel/>}
      {panel==='book-style'&&<BookStylePanel/>}
      {panel==='page-background'&&<><p className="settings-intro">只修改当前内页的纸张底色和纹理。</p><label className="field">当前页面背景<input type="color" value={page.background} onChange={event=>s.change(draft=>{draft.pages[s.pageIndex].background=event.target.value;draft.pages[s.pageIndex].templateBackground=undefined;})}/></label><div className="swatches">{colors.map(color=><button key={color} aria-label={`背景 ${color}`} style={{backgroundColor:color}} className={page.background===color?'chosen':''} onClick={()=>s.change(draft=>{draft.pages[s.pageIndex].background=color;draft.pages[s.pageIndex].templateBackground=undefined;})}/>)}</div><p className="field-label">纸张与纹理</p><div className="background-grid">{['','bg-dots.jpg','bg-grid.jpg','bg2.jpg','bg3.jpg','bg4.jpg','bg5.jpg'].map((name,index)=><button key={name} className={page.pattern===name?'chosen':''} onClick={()=>s.change(draft=>{draft.pages[s.pageIndex].pattern=name||undefined;})} style={name?{backgroundImage:`url(/reference/${name})`}:{}}>{index===0?'纯色':['','波点','格纹','纸张','织物','纹理','牛皮纸'][index]}</button>)}</div></>}
      {panel==='cover'&&<CoverSettingsPanel onPanel={onPanel}/>}
      {panel==='adjust'&&(coverSide==='back'?<p className="muted">后封面照片的位置和大小由封面模板决定；照片内容请在素材库中选择。</p>:selected?fixed?<><p className="muted">图框由模板固定。可以调整照片在框内的位置和缩放。</p>{(['x','y','zoom'] as const).map((key,index)=><label key={key} className="field">{['水平位置','垂直位置','缩放'][index]}<input type="range" min={key==='zoom'?1:0} max={key==='zoom'?4:1} step={.01} value={(selected.crop??{x:.5,y:.5,zoom:1})[key]} onChange={event=>update({crop:{...(selected.crop??{x:.5,y:.5,zoom:1}),[key]:+event.target.value}})}/></label>)}<Button onClick={()=>update({crop:{x:.5,y:.5,zoom:1}})}>重置照片</Button></>:<><label className="field">旋转<input type="range" min={-180} max={180} value={selected.rotation} onChange={event=>update({rotation:+event.target.value})}/><span>{Math.round(selected.rotation)}°</span></label><label className="field">透明度<input type="range" min={.05} max={1} step={.05} value={selected.opacity} onChange={event=>update({opacity:+event.target.value})}/></label><label className="field">锁定<input type="checkbox" checked={!!selected.locked} onChange={event=>update({locked:event.target.checked})}/></label><div className="segments"><Button onClick={()=>layer(-1)}><ArrowDown size={16}/>下移</Button><Button onClick={()=>layer(1)}><ArrowUp size={16}/>上移</Button></div>{selected.type==='image'&&<><label className="field">适配<select value={selected.fit??'cover'} onChange={event=>update({fit:event.target.value as 'cover'|'contain'})}><option value="cover">填充</option><option value="contain">完整显示</option></select></label><label className="field">阴影<input type="checkbox" checked={!!selected.shadow} onChange={event=>update({shadow:event.target.checked})}/></label></>}<div className="segments"><Button onClick={s.duplicateSelected}><Copy size={16}/>复制</Button><Button className="danger" onClick={s.deleteSelected}><Trash2 size={16}/>删除</Button></div></>:<p className="empty-panel">先在页面上选择一个元素</p>)}
    </div>

    <Modal open={assetDeleteOpen} onClose={()=>setAssetDeleteOpen(false)} title={`删除选中的 ${photoIds.length} 张素材？`} description={deleteDescription}>
      <div className="actions"><Button disabled={busy} onClick={()=>setAssetDeleteOpen(false)}>取消</Button><Button className="danger" disabled={busy} onClick={()=>void removeSelectedAssets()}>删除素材</Button></div>
    </Modal>
    <Modal wide open={customOpen} onClose={()=>setCustomOpen(false)} title={coverTarget?'新增封面模板':'新建自定义模板'} description={coverTarget?'拖动和缩放照片区域，模板只保存照片窗口几何，不保存封皮颜色或照片内容':'以当前页图框和文字为底稿保存一个新的自定义模板，不覆盖原模板'}>
      <label className="field stack">模板名称<input value={customName} onChange={event=>setCustomName(event.target.value)}/></label>
      <VisualTemplateEditor slots={customSlots} onChange={setCustomSlots} assetIds={coverTarget?photoIds:pagePhotoIds} background={coverTarget?coverBackground:page.templateBackground??page.background} overlay={coverTarget?undefined:page.templateOverlay} texts={coverTarget?(coverSide==='front'?page.elements.filter(element=>element.type==='text'):[]):page.elements.filter(element=>element.type==='text')} maxSlots={coverTarget?1:9}/>
      <ErrorMessage message={error}/>
      <Button className="primary full" onClick={saveCustomTemplate}>保存并应用模板</Button>
    </Modal>
  </aside>;
}

function AssetTile({asset,selectionIndex,onClick,used=false,draggable=false,dragging=false,dragOver=false,onDragStart,onDragEnter,onDragOver,onDrop,onDragEnd}:{asset:Asset;selectionIndex:number;onClick:()=>void;used?:boolean;draggable?:boolean;dragging?:boolean;dragOver?:boolean;onDragStart?:(event:ReactDragEvent<HTMLButtonElement>)=>void;onDragEnter?:(event:ReactDragEvent<HTMLButtonElement>)=>void;onDragOver?:(event:ReactDragEvent<HTMLButtonElement>)=>void;onDrop?:(event:ReactDragEvent<HTMLButtonElement>)=>void;onDragEnd?:()=>void}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let url='',active=true;
    void assetThumbnail(asset.id).then(blob=>{if(blob&&active){url=URL.createObjectURL(blob);setUrl(url);}}).catch(()=>{});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[asset.id]);
  return <button draggable={draggable} className={`${selectionIndex?'asset-tile-selected':''} ${dragging?'asset-tile-dragging':''} ${dragOver?'asset-tile-drag-over':''}`.trim()} title={selectionIndex?`已选第 ${selectionIndex} 张 · 可拖动排序 · ${asset.name}`:used?`已使用 · ${asset.name}`:asset.name} aria-pressed={selectionIndex>0} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} onClick={onClick}><img src={url||undefined} alt={asset.name} loading="lazy" decoding="async"/>{selectionIndex>0&&<span className="asset-selection-index" aria-label={`第 ${selectionIndex} 张`}>{selectionIndex}</span>}{!selectionIndex&&used&&<span className="asset-usage-badge">已用</span>}</button>;
}
