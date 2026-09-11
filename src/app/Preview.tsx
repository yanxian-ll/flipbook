import {useWorkspaceBackground} from '../components/useWorkspaceBackground';
import {useEffect,useRef,useState} from 'react';
// page-flip 2.0.7 ships its browser bundle without TypeScript declarations.
// @ts-expect-error The runtime export is the same PageFlip constructor used by the exported HTML viewer.
import {PageFlip} from 'page-flip';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ChevronLeft,ChevronRight,Download,Maximize2} from 'lucide-react';
import {backCoverPage,visualPageBackground,type Book} from '../domain/model';
import {presentationPage} from '../domain/coverPresentation';
import {repository,friendlyError} from '../db/repository';
import {renderPage} from '../editor/renderer';
import {IconButton,Loading,ErrorMessage,Button} from '../components/ui';
import {ExportDialog} from '../export/ExportDialog';
import {flipbookMotion,flipPrevSafely,readerLeafPlan,sharedViewerSize} from '../flipbook/spec';
import {useWorkspaceExpansion} from './useWorkspaceExpansion';
import './preview.css';

type SavedEditorView={wide?:boolean;pageIndex?:number};
type PreviewPageCache=Map<number,Promise<Blob>>;

const previewRenderCache=new WeakMap<Book,PreviewPageCache>();

function savedEditorView(bookId:string|undefined):SavedEditorView{
  if(!bookId)return {};
  try{
    const raw=sessionStorage.getItem(`flipbook:editor-view:${bookId}`);
    if(!raw)return {};
    const value=JSON.parse(raw) as {wide?:unknown;pageIndex?:unknown};
    return {
      wide:typeof value.wide==='boolean'?value.wide:undefined,
      pageIndex:typeof value.pageIndex==='number'&&Number.isFinite(value.pageIndex)?Math.max(0,Math.floor(value.pageIndex)):undefined,
    };
  }catch{return {};}
}
function defaultExpanded(){return typeof window==='undefined'?true:window.matchMedia('(min-width:850px)').matches;}

function preparePreviewPage(book:Book,index:number){
  let cache=previewRenderCache.get(book);
  if(!cache){cache=new Map();previewRenderCache.set(book,cache);}
  const hit=cache.get(index);
  if(hit)return hit;
  const options={scale:.6,quality:'preview' as const,mimeType:'image/jpeg' as const};
  const page=index===book.pages.length?backCoverPage(book):presentationPage(book,index);
  const task=renderPage(page,options).catch(error=>{cache?.delete(index);throw error;});
  cache.set(index,task);
  return task;
}

function makePreviewLeaf(root:HTMLElement,label:string,density:'hard'|'soft',kind:'page'|'cover'|'back',background:string){
  const leaf=document.createElement('div');
  leaf.className='flip-page';
  if(kind==='cover')leaf.classList.add('preview-cover-page');
  if(kind==='back')leaf.classList.add('preview-back-cover');
  leaf.dataset.density=density;
  leaf.setAttribute('aria-label',label);

  const host=document.createElement('div');
  host.className='page-thumbnail-host';
  host.style.background=background;
  const image=document.createElement('img');
  image.alt=label;
  image.decoding='async';
  image.draggable=false;
  host.append(image);
  leaf.append(host);

  if(kind==='cover'||kind==='back'){
    const grain=document.createElement('span');
    grain.className='preview-cover-grain';
    const spine=document.createElement('span');
    spine.className='preview-cover-spine';
    leaf.append(grain,spine);
  }
  root.append(leaf);
  return image;
}

function logicalPreviewIndex(physicalIndex:number,pageCount:number,backIndex:number){
  if(physicalIndex>=backIndex)return pageCount;
  return Math.max(0,Math.min(pageCount-1,physicalIndex));
}

export function Preview(){
  const {bookId}=useParams();
  const [query]=useSearchParams();
  const navigate=useNavigate();
  const initialView=savedEditorView(bookId);
  const {wide:expanded}=useWorkspaceExpansion(initialView.wide??defaultExpanded());
  const [book,setBook]=useState<Book>();
  const [error,setError]=useState('');
  const [index,setIndex]=useState(initialView.pageIndex??0);
  const [exporting,setExporting]=useState(query.has('export'));
  const [ready,setReady]=useState(false);
  const workspaceStyle=useWorkspaceBackground(book);
  const flip=useRef<any>(null),shell=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),flipHost=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let live=true;
    const view=savedEditorView(bookId);
    setBook(undefined);setError('');setIndex(view.pageIndex??0);setReady(false);
    void repository.get(bookId!).then(value=>{if(live)setBook(value);}).catch(e=>{if(live)setError(friendlyError(e));});
    return()=>{live=false;};
  },[bookId]);

  useEffect(()=>{
    const host=flipHost.current;
    if(!host||!book)return;
    let live=true;
    let instance:any;
    const urls=new Map<number,string>();
    const images=new Map<number,HTMLImageElement>();
    const plan=readerLeafPlan(book.pages.length);
    const view=savedEditorView(bookId);
    const startPage=Math.max(0,Math.min(view.pageIndex??0,book.pages.length-1));
    setReady(false);
    host.replaceChildren();

    const root=document.createElement('div');
    root.className='preview-pageflip-root';
    book.pages.forEach((_,pageIndex)=>{
      const shown=presentationPage(book,pageIndex);
      images.set(pageIndex,makePreviewLeaf(root,pageIndex===0?'封面':`第 ${pageIndex} 页`,pageIndex===0?'hard':'soft',pageIndex===0?'cover':'page',visualPageBackground(shown)));
    });
    if(plan.needsFiller){
      const blank=document.createElement('div');
      blank.className='flip-page preview-blank-page';
      blank.dataset.density='soft';
      blank.setAttribute('aria-hidden','true');
      root.append(blank);
    }
    const back=backCoverPage(book);
    images.set(book.pages.length,makePreviewLeaf(root,'后封面','hard','back',visualPageBackground(back)));
    host.replaceChildren(root);

    const ensurePage=async(renderIndex:number)=>{
      const image=images.get(renderIndex);
      if(!image||image.src)return;
      try{
        const blob=await preparePreviewPage(book,renderIndex);
        if(!live||image.src)return;
        const url=URL.createObjectURL(blob);
        urls.set(renderIndex,url);
        image.src=url;
      }catch(cause){if(live)setError(friendlyError(cause));}
    };
    const ensureAround=(physicalIndex:number,radius=2)=>{
      const logical=logicalPreviewIndex(physicalIndex,book.pages.length,plan.backIndex);
      const candidates=[logical];
      for(let distance=1;distance<=radius;distance++)candidates.push(logical+distance,logical-distance);
      const unique=[...new Set(candidates.filter(value=>value>=0&&value<=book.pages.length))];
      void (async()=>{for(const value of unique){if(!live)return;await ensurePage(value);}})();
    };

    instance=new PageFlip(root,{
      width:sharedViewerSize.width,
      height:sharedViewerSize.height,
      size:'stretch',
      minWidth:sharedViewerSize.minWidth,
      maxWidth:sharedViewerSize.maxWidth,
      minHeight:sharedViewerSize.minHeight,
      maxHeight:sharedViewerSize.maxHeight,
      drawShadow:true,
      flippingTime:flipbookMotion.flippingTime,
      usePortrait:true,
      startZIndex:0,
      autoSize:true,
      maxShadowOpacity:flipbookMotion.maxShadowOpacity,
      showCover:true,
      mobileScrollSupport:true,
      clickEventForward:true,
      useMouseEvents:true,
      swipeDistance:flipbookMotion.swipeDistance,
      showPageCorners:true,
      disableFlipByClick:false,
      startPage,
    });
    flip.current=instance;
    const sync=(value:unknown)=>{
      const direct=Number(value);
      const next=Number.isFinite(direct)?direct:Number(instance?.getCurrentPageIndex?.()??0)||0;
      setIndex(next);
      ensureAround(next,2);
    };
    instance.on('flip',(event:any)=>sync(event.data));
    instance.on('init',(event:any)=>sync(event.data?.page));
    instance.on('update',(event:any)=>sync(event.data?.page));
    instance.on('changeOrientation',()=>sync(undefined));
    instance.loadFromHTML(root.querySelectorAll<HTMLElement>('.flip-page'));
    setReady(true);
    ensureAround(startPage,2);

    return()=>{
      live=false;
      setReady(false);
      if(flip.current===instance)flip.current=null;
      if(instance){try{instance.destroy();}catch{}}
      host.replaceChildren();
      urls.forEach(url=>URL.revokeObjectURL(url));
    };
  },[book,bookId]);

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(document.querySelector('[role=dialog]'))return;
      const pageFlip=flip.current;
      if(event.key==='ArrowRight')pageFlip?.flipNext?.(flipbookMotion.corner);
      if(event.key==='ArrowLeft')flipPrevSafely(pageFlip);
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[]);

  useEffect(()=>{
    const node=stage.current;
    if(!node||!book)return;
    let wheelSum=0,wheelLocked=false,wheelTimer:number|undefined;
    const wheel=(event:WheelEvent)=>{
      if(document.querySelector('[role=dialog]'))return;
      const delta=Math.abs(event.deltaY)>=Math.abs(event.deltaX)?event.deltaY:event.deltaX;
      if(Math.abs(delta)<2)return;
      event.preventDefault();
      if(wheelLocked)return;
      wheelSum+=delta;
      if(Math.abs(wheelSum)<28)return;
      const forward=wheelSum>0;
      wheelSum=0;
      wheelLocked=true;
      const pageFlip=flip.current;
      forward?pageFlip?.flipNext?.(flipbookMotion.corner):flipPrevSafely(pageFlip);
      if(wheelTimer)window.clearTimeout(wheelTimer);
      wheelTimer=window.setTimeout(()=>{wheelLocked=false;},360);
    };
    node.addEventListener('wheel',wheel,{passive:false});
    return()=>{
      node.removeEventListener('wheel',wheel);
      if(wheelTimer)window.clearTimeout(wheelTimer);
    };
  },[book?.id]);

  const plan=book?readerLeafPlan(book.pages.length):null;
  const lastIndex=plan?.backIndex??0;
  const backCover=!!plan&&index>=plan.backIndex;
  const pageLabel=backCover?'后封面':book?(index===0?'封面':`${Math.min(index+1,book.pages.length)} / ${book.pages.length}`):'';

  return <main ref={shell} className={`phone-shell preview-shell ${expanded?'expanded':''}`} style={workspaceStyle}>
    <header className="studio-header">
      <IconButton label="返回编辑" onClick={()=>navigate(`/editor/${bookId}`)}><ChevronLeft size={21}/></IconButton>
      <span>{book?.title??'FLIPBOOK'}</span>
      <div className="flex">
        <IconButton label="全屏" onClick={()=>{void (document.fullscreenElement?document.exitFullscreen():shell.current?.requestFullscreen())?.catch(e=>setError(friendlyError(e)));}}><Maximize2 size={17}/></IconButton>
        <IconButton label="导出 Flipbook" onClick={()=>setExporting(true)}><Download size={17}/></IconButton>
      </div>
    </header>
    <ErrorMessage message={error}/>
    {error?<Button onClick={()=>navigate('/')}>返回书架</Button>:!book||!plan?<Loading text="正在打开画册…"/>:<>
      <div ref={stage} className={`flip-stage ${index===0?'is-cover':''} ${backCover?'is-back-cover':''}`}>
        <div ref={flipHost} className="flip-book"/>
      </div>
      <div className="preview-navigation">
        <IconButton label="上一页" disabled={!ready||index<=0} onClick={()=>flipPrevSafely(flip.current)}><ChevronLeft/></IconButton>
        <span>{pageLabel}</span>
        <IconButton label="下一页" disabled={!ready||index>=lastIndex} onClick={()=>flip.current?.flipNext?.(flipbookMotion.corner)}><ChevronRight/></IconButton>
      </div>
      <p className="preview-hint">滚动鼠标滚轮，或轻拖书页一角翻页</p>
    </>}
    {book&&<ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>}
  </main>;
}