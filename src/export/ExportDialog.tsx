import {useEffect,useState} from 'react';
import {AlertTriangle,CheckCircle2,ChevronLeft,FileText,Grid2X2,Share2,Video} from 'lucide-react';
import type {Book} from '../domain/model';
import {Modal,Button,ErrorMessage} from '../components/ui';
import {PageThumbnail} from '../components/PageThumbnail';
import {exportBook,downloadBlob,type ExportFormat} from './exportBook';
import {CompositionPreview} from './CompositionPreview';
import {defaultComposition,type CompositionOptions} from './composition';
import {friendlyError,repository} from '../db/repository';
import {findMissingStoredAssetIds,inspectExport} from './preflight';

const formats=([
  ['collage',Grid2X2,'图片与拼图 · JPG','支持单页、双页与多跨页拼图，多张打包 ZIP'],
  ['mp4',Video,'Live 图 · MP4','按所选排版逐组播放，生成动态视频'],
  ['pdf',FileText,'整本 PDF','每张 PDF 页面使用所选拼页与相框样式'],
  ['share',Share2,'分享网页','生成可直接打开和转发的独立网页']
] as const);

export function ExportDialog({book,open,onClose}:{book:Book;open:boolean;onClose:()=>void}){
  const [format,setFormat]=useState<ExportFormat|null>(null),[quality,setQuality]=useState(1),[selected,setSelected]=useState<number[]>(book.pages.map((_,i)=>i)),[options,setOptions]=useState<CompositionOptions>(defaultComposition),[previewIndex,setPreviewIndex]=useState(0),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[missingStoredAssetIds,setMissingStoredAssetIds]=useState<string[]>([]),[assetCheckBusy,setAssetCheckBusy]=useState(false);
  useEffect(()=>{if(!open)return;setFormat(null);setSelected(book.pages.map((_,i)=>i));setQuality(1);setOptions(defaultComposition);setPreviewIndex(0);setBusy(false);setProgress(0);setError('');setMissingStoredAssetIds([]);setAssetCheckBusy(false);},[open,book.id,book.pages.length]);
  useEffect(()=>{
    if(!open||!format||!selected.length){setMissingStoredAssetIds([]);setAssetCheckBusy(false);return;}
    let live=true;
    setAssetCheckBusy(true);
    void findMissingStoredAssetIds(book,selected,id=>repository.getAsset(id))
      .then(ids=>{if(live)setMissingStoredAssetIds(ids);})
      .catch(()=>{if(live)setMissingStoredAssetIds([]);})
      .finally(()=>{if(live)setAssetCheckBusy(false);});
    return()=>{live=false;};
  },[open,format,book.id,book.updatedAt,selected]);

  function chooseFormat(next:ExportFormat){
    setFormat(next);
    setPreviewIndex(0);
    setError('');
    setProgress(0);

  }
  async function run(){
    if(!format)return;
    setBusy(true);setError('');setProgress(0);
    try{
      const valid=selected.filter(i=>i>=0&&i<book.pages.length);
      const artifact=await exportBook(book,format,valid,quality,setProgress,options);
      const safe=book.title.replace(/[<>:"/\\|?*]/g,'_').trim()||'flipbook';
      const name=`${safe}${artifact.suffix}.${artifact.extension}`;
      if(format==='share'&&typeof navigator.share==='function'&&typeof navigator.canShare==='function'){
        const file=new File([artifact.blob],name,{type:artifact.blob.type});
        if(navigator.canShare({files:[file]})){
          try{
            await navigator.share({title:book.title,text:'Flipbook 分享网页',files:[file]});
            onClose();
            return;
          }catch(e){
            if(e instanceof DOMException&&e.name==='AbortError')return;
          }
        }
      }
      downloadBlob(artifact.blob,name);
      onClose();
    }catch(e){setError(friendlyError(e));}
    finally{setBusy(false);}
  }

  const available=book.pages.map((page,i)=>({page,i}));
  const selectedCount=selected.filter(i=>available.some(item=>item.i===i)).length;
  const pagesPerCollage=options.pagesPerCollage??1;
  const groups=Math.ceil(selectedCount/pagesPerCollage);
  const currentGroup=Math.min(previewIndex,Math.max(0,groups-1));
  const selectedFormat=formats.find(([value])=>value===format);
  const SelectedFormatIcon=selectedFormat?.[1];
  const preflight=format?inspectExport(book,selected,format,quality,missingStoredAssetIds):null;
  return <Modal open={open} onClose={()=>{if(!busy)onClose();}} title="导出 Flipbook" description={format?'选择页面和导出参数':'选一种格式导出'} wide className={format&&format!=='share'?'export-dialog export-dialog-composing':'export-dialog'}>
    <ErrorMessage message={error}/>
    {!format?
      <div className="export-format-list">{formats.map(([value,Icon,label,description])=><button key={value} type="button" className="export-format-card" onClick={()=>chooseFormat(value)}><Icon size={19}/><span><b>{label}</b><small>{description}</small></span></button>)}</div>
      :<>
        <button type="button" className="export-back" disabled={busy} onClick={()=>setFormat(null)}><ChevronLeft size={15}/>返回格式选择</button>
        <div className="export-current-format">{selectedFormat&&SelectedFormatIcon&&<><SelectedFormatIcon size={18}/><div><b>{selectedFormat[2]}</b><small>{selectedFormat[3]}</small></div></>}</div>
        <div className="export-workspace">
          {format!=='share'&&<div className="export-preview-pane"><div className="export-preview-title"><b>作品预览</b><span>第 {currentGroup+1} 组</span></div>
            <CompositionPreview book={book} indices={selected.slice(currentGroup*pagesPerCollage,(currentGroup+1)*pagesPerCollage)} options={options} onChange={setOptions} disabled={busy}/>
            <div className="composition-nav"><Button type="button" disabled={busy||currentGroup===0} onClick={()=>setPreviewIndex(currentGroup-1)}>上一组</Button><span>{groups?currentGroup+1:0} / {groups} 个画面</span><Button type="button" disabled={busy||currentGroup>=groups-1} onClick={()=>setPreviewIndex(currentGroup+1)}>下一组</Button></div>
          </div>}
          <fieldset disabled={busy} className="export-settings-pane">
          {format==='share'&&<p className="export-hint">分享网页固定使用与编辑区一致的模拟书本、书脊、页边与翻页阴影。</p>}
          {format!=='share'&&<>
            <div className="export-collage-count"><div><b>每个画面放几页？</b><small>按书中顺序排列，双页并排，多跨页上下排列</small></div><div className="segments">{[1,2,4,6,8].map(value=><Button key={value} type="button" aria-pressed={pagesPerCollage===value} className={pagesPerCollage===value?'primary':''} onClick={()=>{setOptions({...options,pagesPerCollage:value});setPreviewIndex(0);}}>{value} 页</Button>)}</div></div>
            <div className="composition-toggles"><label><input type="checkbox" checked={!!options.frame} onChange={e=>setOptions({...options,frame:e.target.checked})}/>留白相框</label><label><input type="checkbox" checked={!!options.bookStyle} onChange={e=>setOptions({...options,bookStyle:e.target.checked})}/>模拟书本 · 书脊与阴影</label></div>
            {options.frame&&<label className="field">相框比例<select value={options.ratio} onChange={e=>setOptions({...options,ratio:e.target.value})}>{['1:1','3:4','4:3','9:16','16:9'].map(r=><option key={r}>{r}</option>)}<option value="custom">自定义宽高比例</option></select></label>}
            {options.frame&&options.ratio==='custom'&&<div className="composition-custom">{(['frameWidth','frameHeight'] as const).map((key,i)=><label className="field" key={key}>{i?'高度比例值':'宽度比例值'}<input type="number" min={1} max={10000} value={options[key]} onChange={e=>setOptions({...options,[key]:Math.max(1,Math.min(10000,Number(e.target.value)||1))})}/></label>)}</div>}
            {options.frame&&<div className="composition-adjust">{([['zoom','缩放',.25,2.5],['offsetX','水平位置',-1,1],['offsetY','垂直位置',-1,1]] as const).map(([key,label,min,max])=><label key={key}>{label}<input type="range" min={min} max={max} step={.01} value={options[key]} onChange={e=>setOptions({...options,[key]:Number(e.target.value)})}/><span>{Math.round((options[key]??0)*100)}%</span></label>)}<Button type="button" onClick={()=>setOptions({...options,zoom:1,offsetX:0,offsetY:0})}>重置位置与缩放</Button></div>}
          </>}
          <label className="field">清晰度<select value={quality} onChange={e=>setQuality(Number(e.target.value))}><option value={1}>标准 · 画面长边 1696 px</option><option value={2}>高清 · 画面长边 3392 px</option><option value={3}>超清 · 画面长边 5088 px</option></select></label>
          <div className="export-selection"><button type="button" onClick={()=>setSelected(available.map(({i})=>i))}>全选</button><button type="button" onClick={()=>setSelected(available.filter(({i})=>i>0).map(({i})=>i))}>仅内页</button><button type="button" onClick={()=>setSelected([])}>清空</button><span>已选 {selectedCount} 页</span></div>
          <div className="export-pages">{available.map(({page,i})=><button type="button" key={page.id} className={selected.includes(i)?'chosen':''} aria-label={`选择第 ${i+1} 页`} aria-pressed={selected.includes(i)} onClick={()=>setSelected(selected.includes(i)?selected.filter(x=>x!==i):[...selected,i].sort((a,b)=>a-b))}><PageThumbnail page={page}/><span>{i===0?'封面':i} {selected.includes(i)?'✓':''}</span></button>)}</div>
          {selectedCount>0&&preflight&&<div className={'export-preflight '+(preflight.issues.length?'has-issues':'passed')}>
            <div className="export-preflight-summary">
              {assetCheckBusy?<span className="export-preflight-checking">检查本地素材…</span>:preflight.issues.length
                ?<><AlertTriangle size={15}/><span><b>作品检查发现 {preflight.issues.length} 项提醒</b><small>{preflight.errors?preflight.errors+' 项素材问题 · ':''}{preflight.warnings} 项排版或清晰度提醒 · 不影响继续导出</small></span></>
                :<><CheckCircle2 size={15}/><span><b>作品检查通过</b><small>所选页面没有发现明显的素材、空页或清晰度问题</small></span></>}
            </div>
            {!assetCheckBusy&&preflight.issues.length>0&&<details><summary>查看检查结果</summary><div className="export-preflight-list">{preflight.issues.map(issue=><article key={issue.id} data-severity={issue.severity}><b>{issue.title}</b><p>{issue.detail}</p></article>)}</div></details>}
          </div>}
          {format==='mp4'&&<p className="export-hint">每组拼页作为一个视频画面，组间滑动切换。视频宽度最高 1080 px，保持所选相框比例。</p>}
          {format==='share'&&<p className="export-hint">生成一个完全离线的单文件 HTML，页面图片与翻页组件都会内嵌。支持系统文件分享时会直接调起分享面板，否则下载网页文件。</p>}
          {format==='collage'&&selectedCount>pagesPerCollage&&<p className="export-hint">页数超过单张容量时，会生成多张拼图并打包为 ZIP。</p>}
          </fieldset>
        </div>
        <div className="export-footer"><p role="status">{selectedCount?`已选 ${selectedCount} 页${format==='share'?' · 1 份网页':` · ${groups} 个画面`}`:'请至少选择一页'}</p>
        {busy&&<div className="export-progress" role="progressbar" aria-label="导出进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress*100)}><span style={{transform:`scaleX(${progress})`}}/></div>}
        <Button className="primary full" disabled={busy||!selectedCount} onClick={()=>void run()}>{busy?`正在渲染… ${Math.round(progress*100)}%`:'确认导出'}</Button></div>
      </>}
  </Modal>;
}
