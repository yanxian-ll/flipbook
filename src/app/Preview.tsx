import {useWorkspaceBackground} from '../components/useWorkspaceBackground';
import {useEffect,useRef,useState} from 'react';
import {PageFlip} from 'page-flip';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ChevronLeft,ChevronRight,Download,Maximize2} from 'lucide-react';
import {backCoverPage,type Book} from '../domain/model';
import {presentationPage} from '../domain/coverPresentation';
import {repository,friendlyError} from '../db/repository';
import {renderPage} from '../editor/renderer';
import {IconButton,Loading,ErrorMessage,Button} from '../components/ui';
import {ExportDialog} from '../export/ExportDialog';
import {flipbookMotion,flipPrevSafely,readerLeafPlan,sharedViewerSize} from '../flipbook/spec';
import './preview.css';

type SavedEditorView={wide?:boolean;pageIndex?:number};
type PreviewRender={pages:Blob[];back:Blob};

const previewRenderCache=new WeakMap<Book,Promise<PreviewRender>>();

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

function preparePreviewRender(book:Book){
  const cached=previewRenderCache.get(book);
  if(cached)return cached;
  const task=(async()=>{
    const pages=new Array<Blob>(book.pages.length);
    const options={scale:.6,quality:'preview' as const,mimeType:'image/jpeg' as const};
    let cursor=0;
    const workers=Array.from({length:Math.min(2,Math.max(1,book.pages.length))},async()=>{
      while(true){
        const index=cursor++;
        if(index>=book.pages.length)return;
        const page=presentationPage(book,index);
        if(!page)throw new Error(`无法渲染第 ${index+1} 页`);
        pages[index]=await renderPage(page,options);
      }
    });
    const backPromise=renderPage(backCoverPage(book),options);
    await Promise.all(workers);
    return {pages,back:await backPromise};
  })();
  previewRenderCache.set(book,task);
  void task.catch(()=>previewRenderCache.delete(book));
  return task;
}

function makePreviewLeaf(root:HTMLElement,blob:Blob,label:string,density:'hard'|'soft',kind:'page'|'cover'|'back',urls:string[]){
  const leaf=document.createElement('div');
  leaf.className='flip-page';
  if(kind==='cover')leaf.classList.add('preview-cover-page');
  if(kind==='back')leaf.classList.add('preview-back-cover');
  leaf.dataset.density=density;
  leaf.setAttribute('aria-label',label);

  const host=document.createElement('div');
  host.className='page-thumbnail-host';
  const image=document.createElement('img');
  const url=URL.createObjectURL(blob);
  urls.push(url);
  image.src=url;
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

export function Preview(){
  const {bookId}=useParams();
  const [query]=useSearchParams();
  const navigate=useNavigate();
  const initialView=savedEditorView(bookId);
  const [book,setBook]=useState<Book>();
  const [error,setError]=useState('');
  const [index,setIndex]=useState(initialView.pageIndex??0);
  const [expanded,setExpanded]=useState(initialView.wide??defaultExpanded());
  const [exporting,setExporting]=useState(query.has('export'));
  const [ready,setReady]=useState(false);
  const workspaceStyle=useWorkspaceBackground(book);
  const flip=useRef<any>(null),shell=useRef<HTMLDivElement>(null),stage=useRef<HTMLDivElement>(null),flipHost=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let live=true;
    const view=savedEditorView(bookId);
    setBook(undefined);setError('');setIndex(view.pageIndex??0);setExpanded(view.wide??defaultExpanded());setReady(false);
    void repository.get(bookId!).then(value=>{if(live)setBook(value);}).catch(e=>{if(live)setError(friendlyError(e));});
    return()=>{live=false;};
  },[bookId]);

  useEffect(()=>{
    const host=flipHost.current;
    if(!host||!book)return;
    let live=true;
    let instance:PageFlip|undefined;
    const urls:string[]=[];
    const plan=readerLeafPlan(book.pages.length);
    const view=savedEditorView(bookId);
    const startPage=Math.max(0,Math.min(view.pageIndex??0,book.pages.length-1));
    setReady(false);
    host.replaceChildren();

    void preparePreviewRender(book).then(async rendered=>{
      if(!live)return;
      const root=document.createElement('div');
      root.className='preview-pageflip-root';
      const images=rendered.pages.map((blob,pageIndex)=>makePreviewLeaf(root,blob,pageIndex===0?'封面':`第 ${pageIndex} 页`,pageIndex===0?'hard':'soft',pageIndex===0?'cover':'page',urls));
      if(plan.needsFiller){
        const blank=document.createElement('div');
        blank.className='flip-page preview-blank-page';
        blank.dataset.density='soft';
        blank.setAttribute('aria-hidden','true');
        root.append(blank);
      }
      images.push(makePreviewLeaf(root,rendered.back,'后封面','hard','back',urls));
      await Promise.all(images.map(image=>image.decode().catch(()=>undefined)));
      if(!live)return;

      host.replaceChildren(root);
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
      };
      instance.on('flip',event=>sync(event.data));
      instance.on('init',event=>sync(event.data?.page));
      instance.on('update',event=>sync(event.data?.page));
      instance.on('changeOrientation',()=>sync(undefined));
      instance.loadFromHTML(root.querySelectorAll<HTMLElement>('.flip-page'));
      setReady(true);
    }).catch(cause=>{if(live)setError(friendlyError(cause));});

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
      <div ref={stage} className={`flip-stage ${index===0?'is-cover':''} ${backCover?'is-back-cover':''}`} style={{position:'relative'}}>
        <div ref={flipHost} className="flip-book" style={{width:'min(960px,100%)',height:'100%',minWidth:0,minHeight:0,display:'flex',alignItems:'center',justifyContent:'center'}}/>
        {!ready&&<span aria-live="polite" style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',padding:'8px 12px',borderRadius:999,background:'#ffffffd9',boxShadow:'0 3px 12px #0001',fontSize:10,color:'#777',pointerEvents:'none'}}>正在准备翻页预览…</span>}
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
