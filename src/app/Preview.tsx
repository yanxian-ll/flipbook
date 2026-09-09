import {useWorkspaceBackground} from '../components/useWorkspaceBackground';
import {forwardRef,useEffect,useRef,useState} from 'react';
import HTMLFlipBook from 'react-pageflip';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ChevronLeft,ChevronRight,Maximize2,Upload,Pencil} from 'lucide-react';
import {type Book} from '../domain/model';
import {repository,friendlyError} from '../db/repository';
import {PageThumbnail} from '../components/PageThumbnail';
import type {Page} from '../domain/model';
import {IconButton,Loading,ErrorMessage,Button} from '../components/ui';
import {ExportDialog} from '../export/ExportDialog';
const FlipPage=forwardRef<HTMLDivElement,{page:Page;nearby:boolean;index:number}>(({page,nearby,index},ref)=><div ref={ref} className="flip-page" data-density={index===0?'hard':'soft'}>{nearby?<PageThumbnail page={page} scale={.6} immediate alt={index===0?'封面':`第 ${index} 页`}/>:<div className="thumbnail-placeholder" style={{background:page.background,width:'100%',height:'100%'}}/>}</div>);
export function Preview(){
  const {bookId}=useParams();const [query]=useSearchParams();const navigate=useNavigate();const [book,setBook]=useState<Book>(),[error,setError]=useState(''),[index,setIndex]=useState(0),[exporting,setExporting]=useState(query.has('export'));
  const workspaceStyle=useWorkspaceBackground(book);
  const flip=useRef<any>(null),shell=useRef<HTMLDivElement>(null);
  useEffect(()=>{let live=true;setBook(undefined);setError('');setIndex(0);void repository.get(bookId!).then(b=>{if(live)setBook(b);}).catch(e=>{if(live)setError(friendlyError(e));});return()=>{live=false;};},[bookId]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(document.querySelector('[role=dialog]'))return;if(e.key==='ArrowRight')flip.current?.pageFlip().flipNext();if(e.key==='ArrowLeft')flip.current?.pageFlip().flipPrev();};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
  return <main ref={shell} className="phone-shell preview-shell" style={workspaceStyle}><header className="studio-header"><IconButton label="返回编辑" onClick={()=>navigate(`/editor/${bookId}`)}><ChevronLeft size={21}/></IconButton><span>{book?.title??'FLIPBOOK'}</span><div className="flex"><IconButton label="全屏" onClick={()=>{void (document.fullscreenElement?document.exitFullscreen():shell.current?.requestFullscreen())?.catch(e=>setError(friendlyError(e)));}}><Maximize2 size={17}/></IconButton><IconButton label="导出 Flipbook" onClick={()=>setExporting(true)}><Upload size={17}/></IconButton></div></header><ErrorMessage message={error}/>{error?<Button onClick={()=>navigate('/')}>返回书架</Button>:!book?<Loading text="正在打开画册…"/>:<><div className={`flip-stage ${index===0?'is-cover':' '}`}><HTMLFlipBook ref={flip} width={180} height={254} size="stretch" minWidth={130} maxWidth={210} minHeight={184} maxHeight={297} maxShadowOpacity={.3} showCover mobileScrollSupport={true} className="flip-book" style={{}} startPage={0} drawShadow flippingTime={750} usePortrait startZIndex={0} autoSize clickEventForward useMouseEvents swipeDistance={25} showPageCorners disableFlipByClick={false} onFlip={e=>setIndex(e.data)}>{book.pages.map((page,i)=><FlipPage key={page.id} page={page} index={i} nearby={Math.abs(i-index)<=3}/>)}</HTMLFlipBook></div><div className="preview-navigation"><IconButton label="上一页" disabled={index===0} onClick={()=>flip.current?.pageFlip().flipPrev()}><ChevronLeft/></IconButton><span>{index+1} / {book.pages.length}</span><IconButton label="下一页" disabled={index===book.pages.length-1} onClick={()=>flip.current?.pageFlip().flipNext()}><ChevronRight/></IconButton></div><p className="preview-hint">轻拖书页一角，翻开下一段回忆</p><Button className="back-to-edit" onClick={()=>navigate(`/editor/${bookId}`)}><Pencil size={15}/>继续编辑</Button></>}{book&&<ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>}</main>;
}

