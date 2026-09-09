import {useEffect,useState} from 'react';
import {ChevronLeft,FileText,Grid2X2,Image as ImageIcon,Share2,Video} from 'lucide-react';
import type {Book} from '../domain/model';
import {Modal,Button,ErrorMessage} from '../components/ui';
import {PageThumbnail} from '../components/PageThumbnail';
import {exportBook,downloadBlob,type ExportFormat} from './exportBook';
import {friendlyError} from '../db/repository';

const formats=([
  ['collage',Grid2X2,'多跨页拼图 · JPG','把多张内页按跨页拼成分享长图'],
  ['mp4',Video,'Live 图 · MP4','自动翻页生成一段动态视频'],
  ['jpg',ImageIcon,'单页 JPG','单张直出，多张会打包为 ZIP'],
  ['pdf',FileText,'整本 PDF','按所选页生成一份 PDF'],
  ['share',Share2,'分享网页','生成可直接打开和转发的独立网页']
] as const);

export function ExportDialog({book,open,onClose}:{book:Book;open:boolean;onClose:()=>void}){
  const [format,setFormat]=useState<ExportFormat|null>(null),[quality,setQuality]=useState(1),[selected,setSelected]=useState<number[]>(book.pages.map((_,i)=>i)),[pagesPerCollage,setPagesPerCollage]=useState(4),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState('');
  useEffect(()=>{if(!open)return;setFormat(null);setSelected(book.pages.map((_,i)=>i));setQuality(1);setPagesPerCollage(4);setBusy(false);setProgress(0);setError('');},[open,book.id,book.pages.length]);

  function chooseFormat(next:ExportFormat){
    setFormat(next);
    setError('');
    setProgress(0);
    setSelected(next==='collage'?book.pages.map((_,i)=>i).filter(i=>i>0):book.pages.map((_,i)=>i));
  }
  async function run(){
    if(!format)return;
    setBusy(true);setError('');setProgress(0);
    try{
      const valid=selected.filter(i=>i>=0&&i<book.pages.length);
      const artifact=await exportBook(book,format,valid,quality,setProgress,{pagesPerCollage});
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

  const available=book.pages.map((page,i)=>({page,i})).filter(({i})=>format!=='collage'||i>0);
  const selectedCount=selected.filter(i=>available.some(item=>item.i===i)).length;
  const selectedFormat=formats.find(([value])=>value===format);
  return <Modal open={open} onClose={()=>{if(!busy)onClose();}} title="导出 Flipbook" description={format?'选择页面和导出参数':'选一种格式导出'} wide>
    <ErrorMessage message={error}/>
    {!format?
      <div className="export-format-list">{formats.map(([value,Icon,label,description])=><button key={value} type="button" className="export-format-card" onClick={()=>chooseFormat(value)}><Icon size={19}/><span><b>{label}</b><small>{description}</small></span></button>)}</div>
      :<>
        <button type="button" className="export-back" disabled={busy} onClick={()=>setFormat(null)}><ChevronLeft size={15}/>返回格式选择</button>
        <div className="export-current-format">{selectedFormat&&<><selectedFormat.1 size={18}/><div><b>{selectedFormat[2]}</b><small>{selectedFormat[3]}</small></div></>}</div>
        <fieldset disabled={busy}>
          {format==='collage'&&<div className="export-collage-count"><div><b>一张图里放几个页面？</b><small>只导出内页，按选择顺序自动排版</small></div><div className="segments">{[2,4,6,8].map(value=><Button key={value} type="button" className={pagesPerCollage===value?'primary':''} onClick={()=>setPagesPerCollage(value)}>{value} 页</Button>)}</div></div>}
          <label className="field">清晰度<select value={quality} onChange={e=>setQuality(Number(e.target.value))}><option value={1}>标准 · 1200 × 1696</option><option value={2}>高清 · 2400 × 3392</option><option value={3}>超清 · 3600 × 5088</option></select></label>
          <div className="export-selection"><button type="button" onClick={()=>setSelected(available.map(({i})=>i))}>全选</button><button type="button" onClick={()=>setSelected([])}>全不选</button><span>已选 {selectedCount} 页</span></div>
          <div className="export-pages">{available.map(({page,i})=><button type="button" key={page.id} className={selected.includes(i)?'chosen':''} aria-label={`选择第 ${i+1} 页`} onClick={()=>setSelected(selected.includes(i)?selected.filter(x=>x!==i):[...selected,i].sort((a,b)=>a-b))}><PageThumbnail page={page}/><span>{i===0?'封面':i} {selected.includes(i)?'✓':''}</span></button>)}</div>
          {format==='mp4'&&<p className="export-hint">会把所选页面自动串成翻页动画并导出 MP4。</p>}
          {format==='share'&&<p className="export-hint">生成一个自包含 HTML。支持系统文件分享时会直接调起分享面板，否则下载网页文件。</p>}
          {format==='jpg'&&selectedCount>1&&<p className="export-hint">选择多页时会打包成 ZIP，每页仍是独立 JPG。</p>}
          {format==='collage'&&selectedCount>pagesPerCollage&&<p className="export-hint">页数超过单张容量时，会生成多张拼图并打包为 ZIP。</p>}
        </fieldset>
        {busy&&<div className="export-progress"><span style={{width:`${progress*100}%`}}/></div>}
        <Button className="primary full" disabled={busy||!selectedCount} onClick={()=>void run()}>{busy?`正在渲染… ${Math.round(progress*100)}%`:'确认导出'}</Button>
      </>}
  </Modal>;
}
