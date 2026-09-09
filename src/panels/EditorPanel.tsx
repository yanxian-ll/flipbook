import {useRef,useState,type DragEvent as ReactDragEvent} from 'react';
import {Plus,X,Upload,ArrowUp,ArrowDown,Copy,Trash2} from 'lucide-react';
import {useEditor} from '../store/editor';
import {applyLayout,layoutsForTheme,fitAssetIds,frameIsFixed,type Slot} from '../domain/layouts';
import {PageThumbnail} from '../components/PageThumbnail';
import {useMemo} from 'react';
import {textElement,uid,type Element,type Asset} from '../domain/model';
import {prepareAsset} from '../domain/assets';
import {friendlyError,repository} from '../db/repository';
import {Button,ErrorMessage,IconButton,Modal} from '../components/ui';
import {useEffect} from 'react';
export type PanelId='photos'|'layouts'|'text'|'stickers'|'background'|'cover'|'adjust';
const names:Record<PanelId,string>={photos:'上传素材',layouts:'选择排版',text:'文字',stickers:'贴纸',background:'垫底背景',cover:'封面设置',adjust:'调整元素'};
const colors=['#ffffff','#eeeae3','#f5ec30','#e48af5','#d9eb51','#75a4e1','#ff9658','#f6c9cc','#1a1a1a'];
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
    if(selected?.type==='image'){
      const next=[...photoIds],old=selected.assetId,index=old?next.indexOf(old):-1;
      if(page.type==='cover')setPhotoIds([assetId]);
      else if(index>=0){next[index]=assetId;setPhotoIds(next);}
      else if(next.length<9)setPhotoIds([...next,assetId]);
      s.updateElement(selected.id,{assetId,crop:{x:.5,y:.5,zoom:1}});
      s.select(null);
      return;
    }
    setPhotoIds(photoIds.includes(assetId)?photoIds.filter(id=>id!==assetId):page.type==='cover'?[assetId]:photoIds.length<9?[...photoIds,assetId]:photoIds);
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
    .map(layout=>({layout,preview:applyLayout(page,layout,fitAssetIds(previewSourceIds,layout.slots.length))})),
  [allLayouts,layoutCount,page,previewSourceIds.join('|')]);
  const fixed=selected?frameIsFixed(page,selected):false;
  const update=(patch:Partial<Element>)=>{if(selected)s.updateElement(selected.id,patch);};
  const addText=(text:string,size:number,font='Domine')=>s.addElement(textElement(text,{fontSize:size,fontFamily:font}));
  const layer=(direction:number)=>{if(!selected)return;s.change(b=>{const elements=b.pages[s.pageIndex].elements;const i=elements.findIndex(e=>e.id===selected.id);const [element]=elements.splice(i,1);elements.splice(Math.max(0,Math.min(elements.length,i+direction)),0,element);});};
  return <aside className={`editor-panel ${placement?`panel-${placement}`:''} ${paired?'paired-library-panel':''}`}><div className="panel-grabber"/><header><h2>{names[panel]}</h2><IconButton label="关闭面板" onClick={onClose}><X size={17}/></IconButton></header><ErrorMessage message={error}/><div className="panel-body">
    {panel==='photos'&&<><p className="muted">{selected?.type==='image'?'点击任意素材，直接替换当前图框。':'选择本页照片（最多 9 张）'}</p><input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={e=>void upload(e.target.files)}/><div className="asset-batches">{selectedAssets.length>0&&<section className="asset-batch asset-batch-selected"><div className="asset-batch-header"><span><b>本页已选</b></span><small>{selectedAssets.length} 张</small></div><div className="asset-grid">{selectedAssets.map((asset,index)=><AssetTile key={asset.id} asset={asset} selectionIndex={index+1} draggable dragging={dragAssetId===asset.id} dragOver={dragOverAssetId===asset.id&&dragAssetId!==asset.id} onDragStart={e=>{suppressAssetClick.current=true;setDragAssetId(asset.id);setDragOverAssetId(asset.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',asset.id);}} onDragEnter={e=>{e.preventDefault();if(dragAssetId&&dragAssetId!==asset.id)setDragOverAssetId(asset.id);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';}} onDrop={e=>{e.preventDefault();reorderSelectedAsset(asset.id);setDragAssetId(null);setDragOverAssetId(null);window.setTimeout(()=>{suppressAssetClick.current=false;},0);}} onDragEnd={()=>{setDragAssetId(null);setDragOverAssetId(null);window.setTimeout(()=>{suppressAssetClick.current=false;},0);}} onClick={()=>{setError('');chooseAsset(asset.id);}}/>)}</div></section>}{assetBatches.map((batch,index)=><section className="asset-batch" key={batch.id}><div className="asset-batch-header"><span>{batch.legacy?'较早上传':index===0?'最近上传':'上传于'} <b>{batch.legacy?'':formatBatch(batch)}</b></span><small>{batch.assets.length} 张</small></div><div className="asset-grid">{batch.assets.map(asset=><AssetTile key={asset.id} asset={asset} selectionIndex={0} onClick={()=>{setError('');chooseAsset(asset.id);}}/>)}</div></section>)}</div>{!book.assets.length&&<p className="empty-panel">还没有照片<br/>从下方添加照片开始制作。</p>}<div className="photo-selection-actions photo-library-actions"><Button disabled={busy} onClick={()=>input.current?.click()}><Upload size={15}/>{busy?`处理中 ${count}`:'添加照片'}</Button><Button className="danger" disabled={busy||!photoIds.length} onClick={()=>void removeSelectedAssets()}><Trash2 size={15}/>删除</Button><Button className="primary" disabled={busy||!photoIds.length} onClick={()=>{s.setPhotos(photoIds);if(page.type==='cover')onClose();else if(!paired)onPanel('layouts');}}>使用 {photoIds.length} 张</Button></div></>}
    {panel==='layouts'&&<><div className="photo-counts template-count-tabs" role="tablist" aria-label="按照片数量查看模板">{Array.from({length:9},(_,i)=>i+1).map(count=><button key={count} type="button" role="tab" aria-selected={layoutCount===count} className={layoutCount===count?'active':''} disabled={!layoutCounts.has(count)} onClick={()=>setLayoutCount(count)}>{count} 图</button>)}</div><div className="layout-grid all-layout-grid">{variants.map(({layout,preview})=><button key={layout.id} aria-label={`${layout.name}，${layout.slots.length} 图模板`} title={layout.name} className={page.layoutId===layout.id?'chosen':''} disabled={!layoutSourceIds.length} onClick={()=>s.layout(layout.id,layoutSourceIds)}><span className="layout-mini"><PageThumbnail page={preview} scale={.12}/></span><span className="layout-card-meta"><small>{layout.name}</small><em>{layout.slots.length} 图</em></span></button>)}</div>{!variants.length&&<p className="muted">当前分类暂时没有模板，可以切换其他照片数量。</p>}{!layoutSourceIds.length&&<p className="muted">先在左侧素材库选择至少一张照片。模板仍可浏览。</p>}{!paired&&<Button className="full" onClick={()=>onPanel('photos')}>更换本页照片 · {photoIds.length||photoCount} 张</Button>}<Button className="full" disabled={!photoCount} onClick={()=>{setCustomSlots(page.elements.filter(e=>e.type==='image').map(e=>({x:e.x/1200,y:e.y/1696,width:e.width/1200,height:e.height/1696,shape:e.frameShape})));setCustomOpen(true);}}>手动添加模板</Button><p className="muted">模板照片少于已选数量时取前面的照片；模板照片更多时循环重复。图框内直接拖动位置，滚轮缩放。</p></>}
    {panel==='text'&&<>{selected?.type==='text'?<><textarea aria-label="文字内容" value={selected.text} onChange={e=>update({text:e.target.value})} rows={3}/><label className="field">字体<select value={selected.fontFamily} onChange={e=>update({fontFamily:e.target.value})}><option value="Domine">Domine · 杂志衬线</option><option value="Arial">Arial · 现代无衬线</option><option value="Georgia">Georgia · 经典</option><option value="KaiTi">楷体 · 手写</option><option value="sans-serif">黑体</option></select></label><label className="field">字号<input type="range" min={16} max={240} value={selected.fontSize} onChange={e=>update({fontSize:+e.target.value})}/><span>{selected.fontSize}</span></label><label className="field">颜色<input type="color" value={selected.color} onChange={e=>update({color:e.target.value})}/></label><div className="segments"><Button className={selected.fontWeight===700?'primary':''} onClick={()=>update({fontWeight:selected.fontWeight===700?400:700})}><b>B</b></Button>{(['left','center','right'] as const).map((align,i)=><Button key={align} className={selected.align===align?'primary':''} onClick={()=>update({align})}>{['左','中','右'][i]}</Button>)}</div></>:<p className="muted">选择一段文字，或者添加新的文字</p>}<div className="text-presets"><button onClick={()=>addText('写下这一刻',100)}>添加标题 <Plus size={16}/></button><button onClick={()=>addText('一些值得记住的小事',54)}>添加副标题 <Plus size={16}/></button><button onClick={()=>addText('你的段落文字',36,'sans-serif')}>添加正文 <Plus size={16}/></button><button onClick={()=>addText(new Date().toLocaleDateString('zh-CN'),28,'Arial')}>日期 / 注释 <Plus size={16}/></button></div></>}
    {panel==='stickers'&&<><p className="muted">给回忆加一点小装饰</p><div className="sticker-grid">{['★','♡','✿','↗','✦','♥','☀','✈','✽','☻','❀','➜','✉','♫','☁','✧'].map(sticker=><button key={sticker} onClick={()=>s.addElement({...textElement(sticker,{fontSize:180,width:240,height:260,fontFamily:'Arial',color:'#e63457'}),type:'sticker'})}>{sticker}</button>)}</div><Button className="full" onClick={()=>s.addElement({id:uid(),type:'shape',x:280,y:180,width:460,height:90,rotation:-7,opacity:.65,color:'#ddd0a4'})}>添加纸胶带</Button><Button className="full" onClick={()=>s.addElement({id:uid(),type:'shape',x:140,y:250,width:800,height:1050,rotation:3,opacity:1,color:'#fff',shadow:true})}>添加拍立得底纸</Button></>}
    {panel==='background'&&<><label className="field">当前页面背景<input type="color" value={page.background} onChange={e=>s.change(b=>{b.pages[s.pageIndex].background=e.target.value;b.pages[s.pageIndex].templateBackground=undefined;})}/></label><div className="swatches">{colors.map(color=><button key={color} aria-label={`背景 ${color}`} style={{backgroundColor:color}} className={page.background===color?'chosen':''} onClick={()=>s.change(b=>{b.pages[s.pageIndex].background=color;b.pages[s.pageIndex].templateBackground=undefined;})}/>)}</div><p className="field-label">纸张与纹理</p><div className="background-grid">{['','bg-dots.jpg','bg-grid.jpg','bg2.jpg','bg3.jpg','bg4.jpg','bg5.jpg'].map((name,i)=><button key={name} className={page.pattern===name?'chosen':''} onClick={()=>s.change(b=>{b.pages[s.pageIndex].pattern=name||undefined;})} style={name?{backgroundImage:`url(/reference/${name})`}:{}}>{i===0?'纯色':['','波点','格纹','纸张','织物','纹理','牛皮纸'][i]}</button>)}</div><label className="field">画册外底<input type="color" value={book.workspaceBackground} onChange={e=>s.change(b=>{b.workspaceBackground=e.target.value;})}/></label></>}
    {panel==='cover'&&<><p className="field-label">封面模板</p><div className="segments"><Button className={book.coverTemplate==='basic'?'primary':''} onClick={()=>s.change(b=>{b.coverTemplate='basic';const image=b.pages[0].elements.find(e=>e.type==='image');if(image)Object.assign(image,{x:80,y:100,width:1040,height:1300});})}>基础封面</Button><Button className={book.coverTemplate==='cutout'?'primary':''} onClick={()=>s.change(b=>{b.coverTemplate='cutout';const image=b.pages[0].elements.find(e=>e.type==='image');if(image)Object.assign(image,{x:414,y:360,width:372,height:498});})}>镂空笔记本</Button></div><p className="field-label">封皮颜色</p><div className="swatches">{colors.map(color=><button key={color} aria-label={`封皮 ${color}`} style={{backgroundColor:color}} onClick={()=>s.change(b=>{b.pages[0].background=color;})}/>)}</div><label className="field">自定义颜色<input type="color" value={book.pages[0].background} onChange={e=>s.change(b=>{b.pages[0].background=e.target.value;})}/></label><label className="field stack">封面标题<input value={book.pages[0].elements.find(e=>e.type==='text')?.text??''} onChange={e=>s.change(b=>{const text=b.pages[0].elements.find(e=>e.type==='text');if(text)text.text=e.target.value;else b.pages[0].elements.push(textElement(e.target.value));})}/></label><Button className="full" onClick={()=>s.setPage(0)}>回到封面编辑</Button><p className="muted">选择封面照片后，可替换、拖动和裁剪。</p></>}
    {panel==='adjust'&&(selected?fixed?<><p className="muted">图框由模板固定。可以调整照片在框内的位置和缩放。</p>{(['x','y','zoom'] as const).map((key,i)=><label key={key} className="field">{['水平位置','垂直位置','缩放'][i]}<input type="range" min={key==='zoom'?1:0} max={key==='zoom'?4:1} step={.01} value={(selected.crop??{x:.5,y:.5,zoom:1})[key]} onChange={e=>update({crop:{...(selected.crop??{x:.5,y:.5,zoom:1}),[key]:+e.target.value}})}/></label>)}<Button onClick={()=>update({crop:{x:.5,y:.5,zoom:1}})}>重置照片</Button></>:<><label className="field">旋转<input type="range" min={-180} max={180} value={selected.rotation} onChange={e=>update({rotation:+e.target.value})}/><span>{Math.round(selected.rotation)}°</span></label><label className="field">透明度<input type="range" min={.05} max={1} step={.05} value={selected.opacity} onChange={e=>update({opacity:+e.target.value})}/></label><label className="field">锁定<input type="checkbox" checked={!!selected.locked} onChange={e=>update({locked:e.target.checked})}/></label><div className="segments"><Button onClick={()=>layer(-1)}><ArrowDown size={16}/>下移</Button><Button onClick={()=>layer(1)}><ArrowUp size={16}/>上移</Button></div>{selected.type==='image'&&<><label className="field">适配<select value={selected.fit??'cover'} onChange={e=>update({fit:e.target.value as 'cover'|'contain'})}><option value="cover">填充</option><option value="contain">完整显示</option></select></label><label className="field">阴影<input type="checkbox" checked={!!selected.shadow} onChange={e=>update({shadow:e.target.checked})}/></label></>}<div className="segments"><Button onClick={s.duplicateSelected}><Copy size={16}/>复制</Button><Button className="danger" onClick={s.deleteSelected}><Trash2 size={16}/>删除</Button></div></>:<p className="empty-panel">先在页面上选择一个元素</p>)}
  </div><Modal open={customOpen} onClose={()=>setCustomOpen(false)} title="手动添加模板" description="设置图框占页面的百分比，保存后图框固定"><label className="field stack">模板名称<input value={customName} onChange={e=>setCustomName(e.target.value)}/></label>{customSlots.map((slot,index)=><fieldset key={index} className="custom-slot"><legend>图框 {index+1}</legend>{(['x','y','width','height'] as const).map((key,i)=><label key={key}>{['左侧 %','顶部 %','宽度 %','高度 %'][i]}<input type="number" min={key==='width'||key==='height'?1:0} max={100} step={.1} value={Math.round(slot[key]*1000)/10} onChange={e=>setCustomSlots(slots=>slots.map((s,n)=>n===index?{...s,[key]:+e.target.value/100}:s))}/></label>)}<label>圆形图框<input type="checkbox" checked={slot.shape==='ellipse'} onChange={e=>setCustomSlots(slots=>slots.map((s,n)=>n===index?{...s,shape:e.target.checked?'ellipse':undefined}:s))}/></label></fieldset>)}<ErrorMessage message={error}/><Button className="primary full" onClick={()=>{if(customSlots.some(s=>s.width<=0||s.height<=0||s.x<0||s.y<0||s.x+s.width>1.001||s.y+s.height>1.001)){setError('请将所有图框放在页面范围内。');return;}const layout={id:'custom-'+uid(),name:customName.trim()||'我的模板',minImages:photoCount,maxImages:photoCount,slots:customSlots};s.change(b=>{(b.customLayouts??=[]).push(layout);b.pages[s.pageIndex]=applyLayout(b.pages[s.pageIndex],layout);});setError('');setCustomOpen(false);}}>保存并应用模板</Button></Modal></aside>;
}
function AssetTile({asset,selectionIndex,onClick,draggable=false,dragging=false,dragOver=false,onDragStart,onDragEnter,onDragOver,onDrop,onDragEnd}:{asset:Asset;selectionIndex:number;onClick:()=>void;draggable?:boolean;dragging?:boolean;dragOver?:boolean;onDragStart?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDragEnter?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDragOver?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDrop?:(e:ReactDragEvent<HTMLButtonElement>)=>void;onDragEnd?:()=>void}){const [url,setUrl]=useState('');useEffect(()=>{let url='',active=true;void repository.getAsset(asset.id).then(a=>{if(a&&active){url=URL.createObjectURL(a.thumbnail);setUrl(url);}}).catch(()=>{});return()=>{active=false;if(url)URL.revokeObjectURL(url);};},[asset.id]);return <button draggable={draggable} className={`${selectionIndex?'asset-tile-selected':''} ${dragging?'asset-tile-dragging':''} ${dragOver?'asset-tile-drag-over':''}`.trim()} title={selectionIndex?`已选第 ${selectionIndex} 张 · 可拖动排序 · ${asset.name}`:asset.name} aria-pressed={selectionIndex>0} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDrop={onDrop} onDragEnd={onDragEnd} onClick={onClick}><img src={url} alt={asset.name}/>{selectionIndex>0&&<span className="asset-selection-index" aria-label={`第 ${selectionIndex} 张`}>{selectionIndex}</span>}</button>;}
