import {useWorkspaceBackground} from '../components/useWorkspaceBackground';
import {Children,forwardRef,memo,useEffect,useRef,useState} from 'react';
import HTMLFlipBook from 'react-pageflip';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ChevronLeft,ChevronRight,Download,Maximize2,Pencil} from 'lucide-react';
import {type Book,type Page} from '../domain/model';
import {repository,friendlyError} from '../db/repository';
import {PageThumbnail} from '../components/PageThumbnail';
import {BookBackCoverVisual,BookCoverVisual} from '../components/BookCover';
import {IconButton,Loading,ErrorMessage,Button} from '../components/ui';
import {ExportDialog} from '../export/ExportDialog';
import {flipbookMotion,flipPrevSafely,readerLeafPlan} from '../flipbook/spec';

type PreviewLeafProps={
  book:Book;
  page?:Page;
  nearby:boolean;
  index:number;
  kind:'page'|'blank'|'back';
};

const PreviewLeafBase=forwardRef<HTMLDivElement,PreviewLeafProps>(({book,page,nearby,index,kind},ref)=>{
  if(kind==='back')return <div ref={ref} className="flip-page preview-back-cover" data-density="hard" aria-label="后封面"><BookBackCoverVisual book={book} className="preview-back-cover-visual"/></div>;
  if(kind==='blank')return <div ref={ref} className="flip-page preview-blank-page" aria-hidden/>;
  if(!page)return <div ref={ref} className="flip-page preview-blank-page" aria-hidden/>;
  if(index===0)return <div ref={ref} className="flip-page preview-cover-page" data-density="hard"><BookCoverVisual book={book} className="preview-cover-visual"/></div>;
  return <div ref={ref} className="flip-page" data-density="soft">{nearby?<PageThumbnail page={page} scale={.6} immediate alt={`第 ${index} 页`}/>:<div className="thumbnail-placeholder" style={{background:page.background,width:'100%',height:'100%'}}/>}</div>;
});
PreviewLeafBase.displayName='PreviewLeaf';
const PreviewLeaf=memo(PreviewLeafBase,(prev,next)=>{
  if(prev.kind!==next.kind||prev.index!==next.index||prev.nearby!==next.nearby||prev.page!==next.page)return false;
  if(prev.kind==='back')return prev.book.backCover===next.book.backCover&&prev.book.bookStyle===next.book.bookStyle&&prev.book.pages[0]?.background===next.book.pages[0]?.background;
  if(prev.index===0)return prev.book.coverTemplate===next.book.coverTemplate&&prev.book.pages[0]===next.book.pages[0];
  return true;
});
PreviewLeaf.displayName='MemoPreviewLeaf';

export function Preview(){
  const {bookId}=useParams();
  const [query]=useSearchParams();
  const navigate=useNavigate();
  const [book,setBook]=useState<Book>();
  const [error,setError]=useState('');
  const [index,setIndex]=useState(0);
  const [exporting,setExporting]=useState(query.has('export'));
  const workspaceStyle=useWorkspaceBackground(book);
  const flip=useRef<any>(null),shell=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let live=true;
    setBook(undefined);setError('');setIndex(0);
    void repository.get(bookId!).then(value=>{if(live)setBook(value);}).catch(e=>{if(live)setError(friendlyError(e));});
    return()=>{live=false;};
  },[bookId]);

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if(document.querySelector('[role=dialog]'))return;
      const pageFlip=flip.current?.pageFlip?.();
      if(event.key==='ArrowRight')pageFlip?.flipNext?.(flipbookMotion.corner);
      if(event.key==='ArrowLeft')flipPrevSafely(pageFlip);
    };
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[]);

  const plan=book?readerLeafPlan(book.pages.length):null;
  const lastIndex=plan?.backIndex??0;
  const backCover=!!plan&&index>=plan.backIndex;
  const pageLabel=backCover?'后封面':book?(index===0?'封面':`${Math.min(index+1,book.pages.length)} / ${book.pages.length}`):'';

  return <main ref={shell} className="phone-shell preview-shell" style={workspaceStyle}>
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
      <div className={`flip-stage ${index===0?'is-cover':''} ${backCover?'is-back-cover':''}`}>
        <HTMLFlipBook
          ref={flip}
          width={180}
          height={254}
          size="stretch"
          minWidth={130}
          maxWidth={210}
          minHeight={184}
          maxHeight={297}
          maxShadowOpacity={flipbookMotion.maxShadowOpacity}
          showCover
          mobileScrollSupport
          className="flip-book"
          style={{}}
          startPage={0}
          drawShadow
          flippingTime={flipbookMotion.flippingTime}
          usePortrait
          startZIndex={0}
          autoSize
          clickEventForward
          useMouseEvents
          swipeDistance={flipbookMotion.swipeDistance}
          showPageCorners
          disableFlipByClick={false}
          onFlip={event=>setIndex(Number(event.data)||0)}
        >
          {Children.toArray([
            ...book.pages.map((page,pageIndex)=><PreviewLeaf key={page.id} book={book} page={page} index={pageIndex} nearby={Math.abs(pageIndex-index)<=5} kind="page"/>),
            plan.needsFiller?<PreviewLeaf key="__preview_blank__" book={book} index={plan.fillerIndex} nearby={false} kind="blank"/>:null,
            <PreviewLeaf key="__preview_back__" book={book} index={plan.backIndex} nearby={false} kind="back"/>
          ])}
        </HTMLFlipBook>
      </div>
      <div className="preview-navigation">
        <IconButton label="上一页" disabled={index<=0} onClick={()=>flipPrevSafely(flip.current?.pageFlip?.())}><ChevronLeft/></IconButton>
        <span>{pageLabel}</span>
        <IconButton label="下一页" disabled={index>=lastIndex} onClick={()=>flip.current?.pageFlip?.().flipNext?.(flipbookMotion.corner)}><ChevronRight/></IconButton>
      </div>
      <p className="preview-hint">轻拖书页一角，翻开下一段回忆</p>
      <Button className="back-to-edit" onClick={()=>navigate(`/editor/${bookId}`)}><Pencil size={15}/>继续编辑</Button>
    </>}
    {book&&<ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>}
  </main>;
}
