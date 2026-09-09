import {CoverSettingsPanel} from './CoverSettingsPanel';
import {WorkspaceBackgroundPanel} from './WorkspaceBackgroundPanel';
import {VirtualAssetLibrary} from '../components/VirtualAssetLibrary';
import {VisualTemplateEditor} from '../editor/VisualTemplateEditor';
import {useRef,useState,type DragEvent as ReactDragEvent} from 'react';
import {Plus,X,Upload,ArrowUp,ArrowDown,Copy,Trash2} from 'lucide-react';
import {useEditor} from '../store/editor';
import {applyLayout,layoutsForTheme,fitAssetIds,frameIsFixed,type Slot} from '../domain/layouts';
import {PageThumbnail} from '../components/PageThumbnail';
import {useMemo} from 'react';
import {H,W,textElement,uid,type Element,type Asset,type CoverTemplate} from '../domain/model';
import {prepareAsset} from '../domain/assets';
import {friendlyError,repository} from '../db/repository';
import {Button,ErrorMessage,IconButton,Modal} from '../components/ui';
import {useEffect} from 'react';
export type PanelId='photos'|'layouts'|'text'|'stickers'|'background'|'page-background'|'cover'|'adjust';
const names:Record<PanelId,string>={photos:'上传素材',layouts:'选择排版',text:'文字',stickers:'贴纸',background:'垫底背景','page-background':'页面背景',cover:'封面设置',adjust:'调整元素'};
const colors=['#ffffff','#eeeae3','#f5ec30','#e48af5','#d9eb51','#75a4e1','#ff9658','#f6c9cc','#1a1a1a'];
const builtInCoverTemplates:CoverTemplate[]=[
  {id:'basic',name:'基础封面',slot:{x:80/W,y:100/H,width:1040/W,height:1300/H}},
  {id:'cutout',name:'镂空笔记本',slot:{x:414/W,y:360/H,width:372/W,height:498/H}},
];
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
  const s=useEditor();const book=s.book!;const page=book.pages[s.pageIndex];const selected=page.elements.find(e=>s.selected.includes(e.id));
  const initialPhotoIds=()=>[...new Set(page.elements.filter(e=>e.type==='image').map(e=>e.assetId).filter((id):id is string=>!!id))];
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[count,setCount]=useState(0),[localPhotoIds,setLocalPhotoIds]=useState<string[]>(initialPhotoIds),[dragAssetId,setDragAssetId]=useState<string|null>(null),[dragOverAssetId,setDragOverAssetId]=useState<string|null>(null);const input=useRef<HTMLInputElement>(null),suppressAssetClick=useRef(false);
  const photoIds=controlledPhotoIds??localPhotoIds;
  const setPhotoIds=(ids:string[])=>{const next=[...new Set(ids.filter(Boolean))].slice(0,page.type==='cover'?1:9);if(onPhotoIdsChange)onPhotoIdsChange(next);else setLocalPhotoIds(next);};
  function reorderSelectedAsset(targetId:string){
    const fromId=dragAssetId;
    if(!fromId||fromId===targetId)return;
    const from=photoIds.indexOf(fromId),to=photoIds.indexOf(targetId);
    if(from<0||to<0)return;
    const next=[...photoIds];
    const [moved]=next.splice(from,1);
    next.splice(to,0,moved);
    setPhotoIds(next);
  }
  function chooseAsset(assetId:string){
    if(suppressAssetClick.current)return;
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
  async function upload(files:FileList|null){if(!files?.length)return;setBusy(true);setError('');const uploadBatch={id:uid(),at:Date.now()};try{const added=[];for(let i=0;i<files.length;i++){setCount(i+1);added.push(await prepareAsset(files[i],uploadBatch));}await s.addAssets(added);}catch(e){setError(friendlyError(e));}finally{setBusy(false);setCount(0);if(input.current)input.current.value='';}}
  async function removeSelectedAssets(){
    if(!photoIds.length)return;
    const count=photoIds.length;
    if(!window.confirm(`确定删除选中的 ${count} 张素材吗？\n已在页面中使用的这些照片也会一并移除，此操作不能撤销。`))return;
    setBusy(true);setError('');
    try{
      await s.removeAssets(photoIds);
      setPhotoIds([]);
    }catch(e){setError(friendlyError(e));}
    finally{setBusy(false);}
  }
  const selectedAssets=useMemo(()=>photoIds.map(id=>book.assets.find(asset=>asset.id===id)).filter((asset):asset is Asset=>!!asset),[book.assets,photoIds]);
  const assetBatches=useMemo(()=>{
    const selectedSet=new Set(photoIds);
    const groups=new Map<string,{id:string;at:number;legacy:boolean;assets:Asset[]}>();
    for(const asset of book.assets){
      if(selectedSet.has(asset.id))continue;
      const legacy=!asset.uploadBatchId,key=legacy?'__legacy__':asset.uploadBatchId!;
      const existing=groups.get(key);
      if(existing){existing.assets.push(asset);existing.at=Math.max(existing.at,asset.uploadBatchAt??asset.createdAt);}
      else groups.set(key,{id:key,at:asset.uploadBatchAt??asset.createdAt,legacy,assets:[asset]});
    }
    return [...groups.values()].sort((a,b)=>a.legacy===b.legacy?b.at-a.at:a.legacy?1:-1).map(group=>({...group,assets:[...group.assets].sort((a,b)=>a.createdAt-b.createdAt)}));
  },[book.assets,photoIds]);
  const formatBatch=(batch:{at:number;legacy:boolean})=>batch.legacy?'较早上传':new Intl.DateTimeFormat('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(batch.at));
  const [customOpen,setCustomOpen]=useState(false),[customName,setCustomName]=useState('我的模板'),[customSlots,setCustomSlots]=useState<Slot[]>([]);
  const pagePhotoIds=page.elements.filter(e=>e.type==='image').map(e=>e.assetId).filter((id):id is string=>!!id);
  const photoCount=pagePhotoIds.length;
  const layoutSourceIds=photoIds.length?photoIds:[...new Set(pagePhotoIds)];
  const previewSourceIds=layoutSourceIds.length?layoutSourceIds:book.assets.slice(0,1).map(asset=>asset.id);
  const preferredLayoutCount=Math.max(1,Math.min(9,photoIds.length||[...new Set(pagePhotoIds)].length||1));
  const [layoutCount,setLayoutCount]=useState(preferredLayoutCount);
  useEffect(()=>{setLayoutCount(preferredLayoutCount);},[preferredLayoutCount,page.id]);
  const allLayouts=useMemo(()=>[...layoutsForTheme(book.themeId),...(book.customLayouts??[])],[book.themeId,book.customLayouts]);
  const layoutCounts=useMemo(()=>new Set(allLayouts.map(layout=>layout.slots.length)),[allLayouts]);
  const variants=useMemo(()=>allLayouts
    .filter(layout=>layout.slots.length===layoutCount)
    .sort((a,b)=>Number(b.id===page.layoutId)-Number(a.id===page.layoutId))
    .map(layout=>({layout,preview:applyLayout(page,layout,fitAssetIds(previewSourceIds,layout.slots.length))})),
  [allLayouts,layoutCount,page,previewSourceIds.join('|')]);
  const coverTemplates=useMemo(()=>[...builtInCoverTemplates,...(book.customCoverTemplates??[])]
    .sort((a,b)=>Number(b.id===book.coverTemplate)-Number(a.id===book.coverTemplate)),
  [book.coverTemplate,book.customCoverTemplates]);
  function applyCoverTemplate(template:CoverTemplate){
    s.change(b=>{
      b.coverTemplate=template.id;
      const image=b.pages[0].elements.find(e=>e.type==='image');
      if(image)Object.assign(image,{
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
    if(page.type==='cover'){
      const image=page.elements.find(e=>e.type==='image');
      const selectedTemplate=coverTemplates.find(template=>template.id===book.coverTemplate)??coverTemplates[0];
      setCustomSlots([image
        ?{x:image.x/W,y:image.y/H,width:image.width/W,height:image.height/H,shape:image.frameShape}
        :{...selectedTemplate.slot}
      ]);
      setCustomName('我的封面模板');
    }else{
      setCustomSlots(page.elements.filter(e=>e.type==='image').map(e=>({x:e.x/W,y:e.y/H,width:e.width/W,height:e.height/H,shape:e.frameShape})));
      setCustomName('我的模板');
    }
    setCustomOpen(true);
  }
  function saveCustomTemplate(){
    if(customSlots.some(slot=>slot.width<=0||slot.height<=0||slot.x<0||slot.y<0||slot.x+slot.width>1.001||slot.y+slot.height>1.001)){setError('请将所有图框放在页面范围内。');return;}
    if(page.type==='cover'){
      const slot=customSlots[0];
      if(!slot){setError('封面模板需要一个照片区域。');return;}
      const template:CoverTemplate={id:'cover-custom-'+uid(),name:customName.trim()||'我的封面模板',slot:{...slot}};
      s.change(b=>{
        (b.customCoverTemplates??=[]).push(template);
        b.coverTemplate=template.id;
        const image=b.pages[0].elements.find(e=>e.type==='image');
        if(image)Object.assign(image,{x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape});
      });
    }else{
      const layout={id:'custom-'+uid(),name:customName.trim()||'我的模板',minImages:customSlots.length,maxImages:customSlots.length,slots:customSlots,background:page.templateBackground??page.background,overlay:page.templateOverlay,texts:page.elements.filter(e=>e.type==='text').map(e=>({x:e.x/W,y:e.y/H,width:e.width/W,height:e.height/H,key:e.templateTextKey??e.id,text:e.text??'',fontFamily:e.fontFamily??'Domine',fontSize:(e.fontSize??60)/W,fontWeight:e.fontWeight??400,color:e.color??'#222',align:e.align??'left',lineHeight:e.lineHeight??1.2,letterSpacing:(e.letterSpacing??0)*320/W}))};
      s.change(b=>{(b.customLayouts??=[]).push(layout);b.pages[s.pageIndex]=applyLayout(b.pages[s.pageIndex],layout);});
    }
    setError('');
    setCustomOpen(false);
  }
  const fixed=selected?frameIsFixed(page,selected):false;
  const update=(patch:Partial<Element>)=>{if(selected)s.updateElement(selected.id,patch);};
  const addText=(text:string,size:number,font='Domine')=>s.addElement(textElement(text,{fontSize:size,fontFamily:font}));
  const layer=(direction:number)=>{if(!selected)return;s.change(b=>{const elements=b.pages[s.pageIndex].elements;const i=elements.findIndex(e=>e.id===selected.id);const [element]=elements.splice(i,1);elements.splice(Math.max(0,Math.min(elements.length,i+direction)),0,element);});};
  return <aside className={`editor-panel ${placement?`panel-${placement}`:''} ${paired?'paired-library-panel':''}`}><div className="panel-grabber"/><header><h2>{page.type==='cover'&&panel==='layouts'?'封面模板':names[panel]}</h2><IconButton label="关闭面板" onClick={onClose}><X size={17}/></IconButton></header><ErrorMessage message={error}/><div className="panel-body">
    {panel==='photos'&&<><p className="muted">{page.type==='cover'?'点击任意素材，直接替换封面照片。':selected?.type==='image'?'点击任意素材，直接替换当前图框。':'选择本页照片（最多 9 张）'}</p><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={e=>void upload(e.target.files)}/><div className="asset-batches">{selectedAssets.length>0&&<section className="asset-batch asset-batch-selected"><div className="asset-batch-header"><span><b>本页已选</b></span><small>{selectedAssets.length} 张</small></div><div className="asset-grid">{selectedAssets.map((asset,index)=><AssetTile key={asset.id} asset={asset} selectionIndex={index+1} draggable dragging={dragAssetId===asset.id} dragOver={dragOverAssetId===asset.id&&dragAssetId!==asset.id} onDragStart={e=>{suppressAssetClick.current=true;setDragAssetId(asset.id);setDragOverAssetId(asset.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',asset.id);}} onDragEnter={e=>{e.preventDefault();if(dragAssetId&&dragAssetId!==asset.id)setDragOverAssetId(asset.id);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}} onDrop={e=>{e.preventDefault();reorderSelectedAsset(asset.id);setDragAssetId(null);setDragOverAssetId(null);window.setTimeout(()=>{suppressAssetClick.current=false;},0);}} onDragEnd={()=>{setDragAssetId(null);setDragOverAssetId(null);window.setTimeout(()=>{suppressAssetClick.current=false;},0);}} onClick={()=>{setError('');chooseAsset(asset.id);}}/>)}</div></section>}<VirtualAssetLibrary batches={assetBatches} label={(batch,index)=><>{batch.legacy?'较早上传':index===0?'最近上传':'上传于'} <b>{batch.legacy?'':formatBatch(batch)}</b></>} renderAsset={asset=><AssetTile key={asset.id} asset={asset} selectionIndex={0} onClick={()=>{setError('');chooseAsset(asset.id);}}/>}/></div>{!book.assets.length&&<p className="empty-panel">还没有照片<br/>从下方添加照片开始制作。</p>}<div className="photo-selection-actions photo-library-actions"><Button disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{busy?`处理中 ${count}`:'添加照片'}</Button><Button className="danger" disabled={busy||!photoIds.length} onClick={()=>void removeSelectedAssets()}><Trash2 size={15}/>删除</Button><Button className="primary" disabled={busy} onClick={()=>{s.setPhotos(photoIds);if(!photoIds.length){if(!paired)onClose();return;}if(page.type==='cover')onClose();else if(!paired)onPanel('layouts');}}>使用 {photoIds.length} 张</Button></div></>}
    {panel==='layouts'&&(page.type==='cover'?<><div className="cover-template-options cover-template-library-options">{coverTemplates.map(template=>{const mode=template.id==='basic'||template.id==='cutout'?template.id:'custom';return <Button key={template.id} aria-pressed={book.coverTemplate===template.id} className={book.coverTemplate===template.id?'cover-template-card chosen':'cover-template-card'} onClick={()=>applyCoverTemplate(template)}><span className={`cover-template-sample ${mode}`} style={{backgroundColor:page.background}}><i style={mode==='custom'?{left:`${template.slot.x*100}%`,top:`${template.slot.y*100}%`,width:`${template.slot.width*100}%`,height:`${template.slot.height*100}%`,borderRadius:template.slot.shape==='ellipse'?'50%':undefined}:undefined}/><small>TIME TO FLIPBOOK</small></span><span>{template.name}</span></Button>;})}</div><Button className="full" onClick={openCustomTemplate}><Plus size={16}/>添加新封面模板</Button><p className="muted">封面模板只管理照片窗口的位置与大小；封皮颜色、模糊度和标题仍在“封面设置”中调整。</p></>:<><div className="photo-counts template-count-tabs" role="tablist" aria-label="按照片数量查看模板">{Array.from({length:9},(_,i)=>i+1).map(count=><button key={count} type="button" role="tab" aria-selected={layoutCount===count} className={layoutCount===count?'active':''} disabled={!layoutCounts.has(count)} onClick={()=>setLayoutCount(count)}>{count} 图</button>)}</div><div className="layout-grid all-layout-grid">{variants.map(({layout,preview})=><button key={layout.id} aria-label={`${layout.name}，${layout.slots.length} 图模板`} title={layout.name} className={page.layoutId===layout.id?'chosen':''} disabled={!layoutSourceIds.length} onClick={()=>s.layout(layout.id,layoutSourceIds)}><span className="layout-mini"><PageThumbnail page={preview} scale={.12}/></span><span className="layout-card-meta"><small>{layout.name}</small><em>{layout.slots.length} 图</em></span></button>)}</div>{!variants.length&&<p className="muted">当前分类暂时没有模板，可以切换其他照片数量。</p>}{!layoutSourceIds.length&&<p className="muted">先在左侧素材库选择至少一张照片。模板仍可浏览。</p>}{!paired&&<Button className="full" onClick={()=>onPanel('photos')}>更换本页照片 · {photoIds.length||photoCount} 张</Button>}<Button className="full" onClick={()=>onPanel('page-background')}>页面底色与纹理</Button><Button className="full" disabled={!photoCount} onClick={openCustomTemplate}>修改模板</Button><p className="muted">模板照片少于已选数量时取前面的照片；模板照片更多时循环重复。图框内直接拖动位置，滚轮缩放。</p></>)}
    {panel==='text'&&<>{selected?.type==='text'?<><textarea aria-label="文字内容" value={selected.text} onChange={e=>update({text:e.target.value})} rows={3}/><label className="field">字体<select value={selected.fontFamily} onChange={e=>update({fontFamily:e.target.value})}><option value="Domine">Domine · 杂志衬线</option><option value="Arial">Arial · 现代无衬线</option><option value="Georgia">Georgia · 经典</option><option value="KaiTi">楷体 · 手写</option><option value="sans-serif">黑体</option></select></label><label className="field">字号<input type="range" min={16} max={240} value={selected.fontSize} onChange={e=>update({fontSize:+e.target.value})}/><span>{selected.fontSize}</span></label><label className="field">颜色<input type="color" value={selected.color} onChange={e=>update({color:e.target.value})}/></label><div className="segments"><Button className={selected.fontWeight===700?'primary':''} onClick={()=>update({fontWeight:selected.fontWeight===700?400:700})}><b>B</b></Button>{(['left','center','right'] as const).map((align,i)=><Button key={align} className={selected.align===align?'primary':''} onClick={()=>update({align})}>{['左','中','右'][i]}</Button>)}</div></>:<p className="muted">选择一段文字，或者添加新的文字</p>}<div className="text-presets"><button onClick={()=>addText('写下这一刻',100)}>添加标题 <Plus size={16}/></button><button onClick={()=>addText('一些值得记住的小事',54)}>添加副标题 <Plus size={16}/></button><button onClick={()=>addText('你的段落文字',36,'sans-serif')}>添加正文 <Plus size={16}/></button><button onClick={()=>addText(new Date().toLocaleDateString('zh-CN'),28,'Arial')}>日期 / 注释 <Plus size={16}/></button></div></>}
    {panel==='stickers'&&<><p className="muted">给回忆加一点小装饰</p><div className="sticker-grid">{['★','♡','✿','↗','✦','♥','☀','✈','✽','☻','❀','➜','✉','♫','☁','✧'].map(sticker=><button key={sticker} onClick={()=>s.addElement({...textElement(sticker,{fontSize:180,width:240,height:260,fontFamily:'Arial',color:'#e63457'}),type:'sticker'})}>{sticker}</button>)}</div><Button className="full" onClick={()=>s.addElement({id:uid(),type:'shape',x:280,y:180,width:460,height:90,rotation:-7,opacity:.65,color:'#ddd0a4'})}>添加纸胶带</Button><Button className="full" onClick={()=>s.addElement({id:uid(),type:'shape',x:140,y:250,width:800,height:1050,rotation:3,opacity:1,color:'#fff',shadow:true})}>添加拍立得底纸</Button></>}
    {panel==='background'&&<WorkspaceBackgroundPanel/>}
    {panel==='page-background'&&<><p className="settings-intro">只修改当前内页的纸张底色和纹理。</p><label className="field">当前页面背景<input type="color" value={page.background} onChange={e=>s.change(b=>{b.pages[s.pageIndex].background=e.target.value;b.pages[s.pageIndex].templateBackground=undefined;})}/></label><div className="swatches">{colors.map(color=><button key={color} aria-label={`背景 ${color}`} style={{backgroundColor:color}} className={page.background===color?'chosen':''} onClick={()=>s.change(b=>{b.pages[s.pageIndex].background=color;b.pages[s.pageIndex].templateBackground=undefined;})}/>)}</div><p className="field-label">纸张与纹理</p><div className="background-grid">{['','bg-dots.jpg','bg-grid.jpg','bg2.jpg','bg3.jpg','bg4.jpg','bg5.jpg'].map((name,i)=><button key={name} className={page.pattern===name?'chosen':''} onClick={()=>s.change(b=>{b.pages[s.pageIndex].pattern=name||undefined;})} style={name?{backgroundImage:`url(/reference/${name})`}:{}}>{i===0?'纯色':['','波点','格纹','纸张','织物','纹理','牛皮纸'][i]}</button>)}</div></>}
    {panel==='cover'&&<CoverSettingsPanel/>}
    {panel==='adjust'&&(selected?fixed?<><p className="muted">图框由模板固定。可以调整照片在框内的位置和缩放。</p>{(['x','y','zoom'] as const).map((key,i)=><label key={key} className="field">{['水平位置','垂直位置','缩放'][i]}<input type="range" min={key==='zoom'?1:0} max={key==='zoom'?4:1} step={.01} value={(selected.crop??{x:.5,y:.5,zoom:1})[key]} onChange={e=>update({crop:{...(selected.crop??{x:.5,y:.5,zoom:1}),[key]:+e.target.value}})}/></label>)}<Button onClick={()=>update({crop:{x:.5,y:.5,zoom:1}})}>重置照片</Button></>:<><label className="field">旋转<input type="range" min={-180} max={180} value={selected.rotation} onChange={e=>update({rotation:+e.target.value})}/><span>{Math.round(selected.rotation)}°</span></label><label className="field">透明度<input type="range" min={.05} max={1} step={.05} value={selected.opacity} onChange={e=>update({opacity:+e.target.value})}/></label><label className="field">锁定<input type="checkbox" checked={!!selected.locked} onChange={e=>update({locked:e.target.checked})}/></label><div className="segments"><Button onClick={()=>layer(-1)}><ArrowDown size={16}/>下移</Button><Button onClick={()=>layer(1)}><ArrowUp size={16}/>上移</Button></div>{selected.type==='image'&&<><label className="field">适配<select value={selected.fit??'cover'} onChange={e=>update({fit:e.target.value as 'cover'|'contain'})}><option value="cover">填充</option><option value="contain">完整显示</option></select></label><label className="field">阴影<input type="checkbox" checked={!!selected.shadow} onChange={e=>update({shadow:e.target.checked})}/></label></>}<div className="segments"><Button onClick={s.duplicateSelected}><Copy size={16}/>复制</Button><Button className="danger" onClick={s.deleteSelected}><Trash2 size={16}/>删除</Button></div></>:<p className="empty-panel">先在页面上选择一个元素</p>)}
  </div><Modal wide open={customOpen} onClose={()=>setCustomOpen(false)} title={page.type==='cover'?'新增封面模板':'修改模板'} description={page.type==='cover'?'拖动和缩放封面照片区域，保存为新的封面模板':'直接拖动和缩放图框，保存为自己的模板'}><label className="field stack">模板名称<input value={customName} onChange={e=>setCustomName(e.target.value)}/></label><VisualTemplateEditor slots={customSlots} onChange={setCustomSlots} assetIds={pagePhotoIds} background={page.type==='cover'?page.background:page.templateBackground??page.background} overlay={page.type==='cover'?undefined:page.templateOverlay} texts={page.elements.filter(e=>e.type==='text')} maxSlots={page.type==='cover'?1:9}/>
<ErrorMessage message={error}/><Button className="primary full" onClick={saveCustomTemplate}>保存并应用模板</Button></Modal></aside>;
}
function AssetTile({asset,selectionIndex,onClick,draggable=false,dragging=false,dragOver=false,onDragStart,onDragEnter,onDragOver,onDrop,onDragEnd}:{asset:Asset;selectionIndex:number;onClick:()=>void;draggable?:boolean;dragging?:boolean;dragOver?:boolean;onDragStart?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDragEnter?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDragOver?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDrop?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDragEnd?:()=>void}){const [url,setUrl]=useState('');useEffect(()=>{let url='',active=true;void repository.getAsset(asset.id).then(a=>{if(a&&active){url=URL.createObjectURL(a.thumbnail);setUrl(url);}}).catch(()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[asset.id]);return <button draggable={draggable} className={`${selectionIndex?'asset-tile-selected':''} ${dragging?'asset-tile-dragging':''} ${dragOver?'asset-tile-drag-over':''}`.trim()} title={selectionIndex?`已选第 ${selectionIndex} 张 · 可拖动排序 · ${asset.name}`:asset.name} aria-pressed={selectionIndex>0} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} onClick={onClick}><img src={url||undefined} alt={asset.name} decoding="async"/>{selectionIndex>0&&<span className="asset-selection-index" aria-label={`第 ${selectionIndex} 张`}>{selectionIndex}</span>}</button>;}
