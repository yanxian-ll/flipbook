import {useEffect,useRef,useState,type WheelEvent,type PointerEvent as ReactPointerEvent} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {ChevronLeft,Undo2,Redo2,Eye,Upload,Images,Grid2X2,Type,Sun,Plus,Sticker,Maximize2,Minimize2,Copy,Trash2,Crop,Replace,BookOpen,Palette,Check} from 'lucide-react';
import {repository,friendlyError} from '../db/repository';
import {useEditor} from '../store/editor';
import {EditorCanvas} from '../editor/EditorCanvas';
import {clearImageCache} from '../editor/renderer';
import {PageThumbnail,preloadPageThumbnail} from '../components/PageThumbnail';
import {Button,IconButton,Loading,ErrorMessage,Modal} from '../components/ui';
import {EditorPanel,type PanelId} from '../panels/EditorPanel';
import {ExportDialog} from '../export/ExportDialog';
import {frameIsFixed} from '../domain/layouts';
import {prepareAsset} from '../domain/assets';
export function Editor(){
  const {bookId}=useParams();const navigate=useNavigate();const s=useEditor();const [loading,setLoading]=useState(true),[error,setError]=useState(''),[panel,setPanel]=useState<PanelId|null>(null),[wide,setWide]=useState(true),[exporting,setExporting]=useState(false),[cropOpen,setCropOpen]=useState(false),[crop,setCrop]=useState({x:.5,y:.5,zoom:1}),[viewWidth,setViewWidth]=useState(360),[viewHeight,setViewHeight]=useState(500),[zoomMode,setZoomMode]=useState<'spread'|'page'>('spread'),[turnDirection,setTurnDirection]=useState<'next'|'prev'|null>(null);
  const workspace=useRef<HTMLDivElement>(null);const bookWindow=useRef<HTMLDivElement>(null);const bookTrack=useRef<HTMLDivElement>(null);const turnSheet=useRef<HTMLDivElement>(null);const replaceInput=useRef<HTMLInputElement>(null);const dragged=useRef<number|null>(null);const wheelAccumulator=useRef(0),wheelTimer=useRef<number|null>(null),turnTimer=useRef<number|null>(null),turnLocked=useRef(false);const turnGesture=useRef<{pointerId:number;direction:'next'|'prev';startX:number;lastX:number;lastAt:number;velocity:number;progress:number;originY:number;started:boolean}|null>(null);const panGesture=useRef<{pointerId:number;direction:'next'|'prev';startX:number;lastX:number;lastAt:number;velocity:number;progress:number;started:boolean}|null>(null);
  useEffect(()=>{let live=true;setLoading(true);void repository.get(bookId!).then(book=>{if(live){s.load(book);setLoading(false);}}).catch(e=>{setError(friendlyError(e));setLoading(false);});return()=>{live=false;void useEditor.getState().flush().catch(()=>{});clearImageCache();};},[bookId]);
  useEffect(()=>{if(!workspace.current)return;const observer=new ResizeObserver(entries=>{setViewWidth(entries[0].contentRect.width);setViewHeight(entries[0].contentRect.height);});observer.observe(workspace.current);return()=>observer.disconnect();},[loading,wide,panel]);
  useEffect(()=>()=>{if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);if(turnTimer.current!==null)window.clearTimeout(turnTimer.current);},[]);
  useEffect(()=>{const b=s.book;if(!b)return;const i=s.pageIndex;const left=i===0?0:(i%2===1?i:i-1);const indices=i===0?[0,1,2]:[left-2,left-1,left,left+1,left+2,left+3];for(const n of indices){if(n>=0&&n<b.pages.length)void preloadPageThumbnail(b.pages[n],.12);}},[s.book,s.pageIndex]);
  useEffect(()=>{function key(e:KeyboardEvent){if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')||document.querySelector('[role=dialog]'))return;const state=useEditor.getState();const mod=e.ctrlKey||e.metaKey;const key=e.key.toLowerCase();if(mod&&key==='z'){e.preventDefault();if(e.shiftKey)state.redo();else state.undo();}else if(mod&&['c','v','d'].includes(key)){e.preventDefault();if(key==='c')state.copy();if(key==='v')state.paste();if(key==='d')state.duplicateSelected();}else if(key==='delete'||key==='backspace'){e.preventDefault();state.deleteSelected();}else if(key==='escape'){state.select(null);setPanel(null);}else if(e.key.startsWith('Arrow')&&state.selected.length){e.preventDefault();const d=e.shiftKey?10:1;state.change(b=>{for(const element of b.pages[state.pageIndex].elements){if(state.selected.includes(element.id)&&!element.locked&&!frameIsFixed(b.pages[state.pageIndex],element)){element.x+=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0;element.y+=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0;}}});}}
    function exit(e:BeforeUnloadEvent){if(useEditor.getState().status!=='saved'){void useEditor.getState().flush().catch(()=>{});e.preventDefault();}}
    function visibility(){if(document.visibilityState==='hidden')void useEditor.getState().flush().catch(()=>{});}
    window.addEventListener('keydown',key);window.addEventListener('beforeunload',exit);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('beforeunload',exit);document.removeEventListener('visibilitychange',visibility);};},[]);
  async function leave(path:string){try{await s.flush();navigate(path);}catch(e){setError(friendlyError(e));}}
  async function replace(files:FileList|null){if(!files?.[0]||!s.selected[0])return;try{const asset=await prepareAsset(files[0]);await s.addAssets([asset]);s.updateElement(s.selected[0],{assetId:asset.id,crop:{x:.5,y:.5,zoom:1}});}catch(e){setError(friendlyError(e));}finally{if(replaceInput.current)replaceInput.current.value='';}}
  if(loading)return <main className="phone-shell"><Loading/></main>;if(!s.book||error&&s.book.id!==bookId)return <main className="phone-shell"><ErrorMessage message={error}/><Button onClick={()=>navigate('/')}>返回书架</Button></main>;
  const book=s.book,page=book.pages[s.pageIndex],selected=page.elements.find(e=>s.selected.includes(e.id));const pair=s.pageIndex===0?-1:s.pageIndex%2===1?s.pageIndex+1:s.pageIndex-1;const spreadPairPage=pair>=0?book.pages[pair]:undefined;const showAddPageSlot=zoomMode==='spread'&&s.pageIndex>0&&s.pageIndex===book.pages.length-1&&s.pageIndex%2===1&&!spreadPairPage;const spreadHasRightPage=!!spreadPairPage||showAddPageSlot;const neighborIndex=s.pageIndex===0&&book.pages[1]?1:pair;const neighborPage=neighborIndex>=0?book.pages[neighborIndex]:undefined;const pairPage=zoomMode==='page'?neighborPage:spreadPairPage;const pairIndex=zoomMode==='page'?neighborIndex:pair;const spreadCanvasWidth=Math.min(wide?390:170,(viewWidth-54)/(spreadHasRightPage?2:1),Math.max(120,viewHeight-215)/1.4133);const pageCanvasWidth=Math.min(wide?560:viewWidth*.86,viewWidth*.86,Math.max(170,viewHeight-(panel?390:165))/1.4133);const canvasWidth=zoomMode==='page'?pageCanvasWidth:spreadCanvasWidth;const pageHeight=canvasWidth*1.4133333333;const peek=.115;const visualReverse=s.pageIndex>0&&s.pageIndex%2===0;const activeSide=s.pageIndex===0?'cover':visualReverse?'right':'left';const pairSide=s.pageIndex===0?'right':visualReverse?'left':'right';const bookWindowWidth=canvasWidth*(zoomMode==='page'&&pairPage?1+peek:spreadHasRightPage?2:1);const spreadWidth=canvasWidth*(zoomMode==='page'?(pairPage?2:1):(spreadHasRightPage?2:1));const focusedShift=zoomMode==='page'&&pairPage&&visualReverse?-canvasWidth*(1-peek):0;
  const tools=([['photos',Images,'素材库'],['layouts',Grid2X2,'模版'],['text',Type,'文字'],['stickers',Sticker,'贴纸'],['adjust',Sun,'调整']] as const).filter(([id])=>page.type!=='cover'||!['layouts','stickers'].includes(id));
  function openCrop(){if(selected?.type==='image'){setCrop(selected.crop??{x:.5,y:.5,zoom:1});setCropOpen(true);}}
  function turnPages(direction:'next'|'prev'){
    const last=book.pages.length-1;
    if(direction==='next'){
      if(s.pageIndex===0){
        if(last<1)return null;
        return {front:0,back:1,under:Math.min(2,last),target:1,side:'cover' as const};
      }
      const left=s.pageIndex%2===1?s.pageIndex:s.pageIndex-1;
      const right=Math.min(last,left+1),back=right+1;
      if(back>last)return null;
      return {front:right,back,under:Math.min(last,back+1),target:back,side:'right' as const};
    }
    if(s.pageIndex===0)return null;
    const left=s.pageIndex%2===1?s.pageIndex:s.pageIndex-1;
    if(left<=1)return {front:left,back:0,under:0,target:0,side:'left' as const};
    return {front:left,back:left-1,under:left-2,target:left-1,side:'left' as const};
  }
  function pageTurnTarget(direction:'next'|'prev'){return turnPages(direction)?.target??s.pageIndex;}
  function turnSheetLeft(direction:'next'|'prev'){
    const turn=turnPages(direction);if(!turn)return 0;
    if(turn.side==='cover')return 0;
    return (turn.side==='right'?canvasWidth:0)+focusedShift;
  }
  function canPan(direction:'next'|'prev'){
    if(zoomMode!=='page'||s.pageIndex===0||!pairPage||pairIndex<0)return false;
    return direction==='next'?!visualReverse:visualReverse;
  }
  function panTargetShift(direction:'next'|'prev'){
    if(!canPan(direction))return focusedShift;
    return direction==='next'?-canvasWidth*(1-peek):0;
  }
  function setTrackShift(shift:number,transition='none'){
    const track=bookTrack.current;if(!track)return;
    track.style.transition=transition;
    track.style.transform=`translateX(${shift}px)`;
  }
  function clearPan(){
    panGesture.current=null;turnLocked.current=false;
    bookWindow.current?.classList.remove('is-panning');
    if(bookTrack.current)bookTrack.current.style.transition='';
  }
  function finishPan(commit:boolean){
    const g=panGesture.current;if(!g)return;
    const targetShift=panTargetShift(g.direction),duration=commit?240:170;
    setTrackShift(commit?targetShift:focusedShift,`transform ${duration}ms ${commit?'cubic-bezier(.2,.76,.18,1)':'cubic-bezier(.3,.72,.24,1)'}`);
    const targetIndex=pairIndex;
    if(turnTimer.current!==null)window.clearTimeout(turnTimer.current);
    turnTimer.current=window.setTimeout(()=>{if(commit&&targetIndex>=0&&targetIndex!==s.pageIndex)s.setPage(targetIndex);clearPan();},duration+16);
  }
  function startPan(direction:'next'|'prev',e:ReactPointerEvent<HTMLDivElement>){
    if(e.button!==0||turnLocked.current||!canPan(direction)||!bookTrack.current)return;
    const now=performance.now();
    panGesture.current={pointerId:e.pointerId,direction,startX:e.clientX,lastX:e.clientX,lastAt:now,velocity:0,progress:0,started:false};
    e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
  }
  function movePan(e:ReactPointerEvent<HTMLDivElement>){
    const g=panGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    const now=performance.now(),dt=Math.max(1,now-g.lastAt);g.velocity=(e.clientX-g.lastX)/dt;g.lastX=e.clientX;g.lastAt=now;
    const signed=g.direction==='next'?g.startX-e.clientX:e.clientX-g.startX;
    const travel=Math.max(1,canvasWidth*(1-peek));const progress=Math.max(0,Math.min(1,signed/travel));g.progress=progress;
    if(!g.started&&progress>.01){g.started=true;turnLocked.current=true;bookWindow.current?.classList.add('is-panning');}
    if(g.started)setTrackShift(focusedShift+(panTargetShift(g.direction)-focusedShift)*progress);
    if(g.started)e.preventDefault();
  }
  function endPan(e:ReactPointerEvent<HTMLDivElement>){
    const g=panGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    const signedVelocity=g.direction==='next'?-g.velocity:g.velocity;
    const commit=g.started&&(g.progress>.22||signedVelocity>.5);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(g.started)finishPan(commit);else{panGesture.current=null;if(pairIndex>=0)zoomToPage(pairIndex);}
  }
  function cancelPan(e:ReactPointerEvent<HTMLDivElement>){
    const g=panGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    if(g.started)finishPan(false);else panGesture.current=null;
  }
  function canPhysicalTurn(direction:'next'|'prev'){
    if(!turnPages(direction))return false;
    if(zoomMode==='spread')return true;
    if(s.pageIndex===0)return direction==='next';
    return visualReverse?direction==='next':direction==='prev';
  }
  function applyTurnVisual(progress:number,direction:'next'|'prev',originY:number,transition='none'){
    const sheet=turnSheet.current,host=bookWindow.current;if(!sheet||!host)return;
    const wave=Math.sin(Math.PI*progress),vertical=originY-.5;
    const rotateY=(direction==='next'?-178:178)*progress;
    const rotateX=vertical*13*wave;
    const rotateZ=vertical*(direction==='next'?-6:6)*wave;
    const lift=-5*wave;
    sheet.style.transition=transition;
    sheet.style.transformOrigin=`${direction==='next'?'left':'right'} ${originY*100}%`;
    sheet.style.transform=`perspective(1800px) translateY(${lift}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg)`;
    host.style.setProperty('--turn-progress',String(progress));
    host.style.setProperty('--turn-origin',`${originY*100}%`);
  }
  function clearTurn(){
    turnGesture.current=null;setTurnDirection(null);turnLocked.current=false;
    if(bookWindow.current){bookWindow.current.style.setProperty('--turn-progress','0');bookWindow.current.style.setProperty('--turn-origin','50%');}
  }
  function finishTurn(commit:boolean){
    const g=turnGesture.current;if(!g||!g.started){turnGesture.current=null;return;}
    const target=turnPages(g.direction)?.target??s.pageIndex,duration=commit?310:190;
    applyTurnVisual(commit?1:0,g.direction,g.originY,`transform ${duration}ms ${commit?'cubic-bezier(.18,.72,.18,1)':'cubic-bezier(.3,.75,.25,1)'}`);
    if(turnTimer.current!==null)window.clearTimeout(turnTimer.current);
    turnTimer.current=window.setTimeout(()=>{if(commit&&target!==s.pageIndex)s.setPage(target);clearTurn();},duration+18);
  }
  function startTurn(direction:'next'|'prev',e:ReactPointerEvent<HTMLDivElement>){
    if(e.button!==0||turnLocked.current||!canPhysicalTurn(direction)||!bookWindow.current)return;
    const rect=bookWindow.current.getBoundingClientRect(),now=performance.now();
    const originY=Math.max(.06,Math.min(.94,(e.clientY-rect.top)/rect.height));
    turnGesture.current={pointerId:e.pointerId,direction,startX:e.clientX,lastX:e.clientX,lastAt:now,velocity:0,progress:0,originY,started:false};
    setTurnDirection(direction);bookWindow.current.style.setProperty('--turn-origin',`${originY*100}%`);
    e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
  }
  function moveTurn(e:ReactPointerEvent<HTMLDivElement>){
    const g=turnGesture.current;if(!g||g.pointerId!==e.pointerId||!bookWindow.current)return;
    const now=performance.now(),dt=Math.max(1,now-g.lastAt);g.velocity=(e.clientX-g.lastX)/dt;g.lastX=e.clientX;g.lastAt=now;
    const distance=g.direction==='next'?g.startX-e.clientX:e.clientX-g.startX;
    const progress=Math.max(0,Math.min(1,distance/(bookWindow.current.getBoundingClientRect().width*.72)));g.progress=progress;
    if(!g.started&&progress>.012){g.started=true;turnLocked.current=true;requestAnimationFrame(()=>applyTurnVisual(g.progress,g.direction,g.originY));}
    else if(g.started)applyTurnVisual(progress,g.direction,g.originY);
    if(g.started)e.preventDefault();
  }
  function endTurn(e:ReactPointerEvent<HTMLDivElement>){
    const g=turnGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    const signedVelocity=g.direction==='next'?-g.velocity:g.velocity;
    const commit=g.started&&(g.progress>.24||signedVelocity>.55);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(g.started)finishTurn(commit);else{turnGesture.current=null;setTurnDirection(null);turnPage(g.direction);}
  }
  function cancelTurn(e:ReactPointerEvent<HTMLDivElement>){
    const g=turnGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    if(g.started)finishTurn(false);else{turnGesture.current=null;setTurnDirection(null);}
  }
  function turnPage(direction:'next'|'prev'){
    if(turnLocked.current||pageTurnTarget(direction)===s.pageIndex)return;
    turnLocked.current=true;setTurnDirection(direction);
    const originY=.5;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{applyTurnVisual(0,direction,originY);requestAnimationFrame(()=>{applyTurnVisual(1,direction,originY,'transform 310ms cubic-bezier(.18,.72,.18,1)');if(turnTimer.current!==null)window.clearTimeout(turnTimer.current);const target=turnPages(direction)?.target??s.pageIndex;turnTimer.current=window.setTimeout(()=>{if(target!==s.pageIndex)s.setPage(target);clearTurn();},328);});}));
  }
  function handleWheel(e:WheelEvent<HTMLDivElement>){
    if(turnLocked.current||Math.abs(e.deltaY)<1)return;
    e.preventDefault();wheelAccumulator.current+=e.deltaY;
    if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);
    wheelTimer.current=window.setTimeout(()=>{wheelAccumulator.current=0;},150);
    if(Math.abs(wheelAccumulator.current)<28)return;
    const nextMode=wheelAccumulator.current<0?'page':'spread';wheelAccumulator.current=0;
    if(nextMode!==zoomMode)setZoomMode(nextMode);
  }
  function zoomToPage(index:number){if(index>=0&&index!==s.pageIndex)s.setPage(index);setZoomMode('page');}
  return <main className={`phone-shell studio ${wide?'expanded':''}`}><header className="studio-header"><IconButton label="返回书架" onClick={()=>void leave('/')}><ChevronLeft size={21}/></IconButton><input className="editor-title" aria-label="画册名称" value={book.title} onChange={e=>s.change(b=>{b.title=e.target.value;})}/><IconButton label={wide?'收起工作区':'展开工作区'} onClick={()=>setWide(!wide)}>{wide?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</IconButton></header><ErrorMessage message={error||s.error}/>
  <div className="editor-workspace" ref={workspace} style={{backgroundColor:book.workspaceBackground}}><div className="workspace-toolbar"><div className="toolbar-pill"><IconButton label="撤销" disabled={!s.past.length} onClick={s.undo}><Undo2 size={16}/></IconButton><IconButton label="重做" disabled={!s.future.length} onClick={s.redo}><Redo2 size={16}/></IconButton></div><div className="toolbar-pill">{page.type==='cover'&&<IconButton label="封面设置" onClick={()=>setPanel(panel==='cover'?null:'cover')}><BookOpen size={16}/></IconButton>}<IconButton label="垫底背景" onClick={()=>setPanel(panel==='background'?null:'background')}><Palette size={16}/></IconButton><IconButton label="翻页预览" onClick={()=>void leave(`/preview/${book.id}`)}><Eye size={16}/></IconButton><IconButton label="导出 Flipin" onClick={()=>setExporting(true)}><Upload size={16}/></IconButton></div></div>
    <div className="save-status" role="status">{s.status==='saved'?<><Check size={10}/>已保存</>:s.status==='saving'?'保存中…':<button onClick={()=>void s.flush().catch(()=>{})}>保存失败，点此重试</button>}</div>
    {selected&&<div className="context-toolbar">{selected.type==='image'&&<><IconButton label="替换图片" onClick={()=>replaceInput.current?.click()}><Replace size={16}/></IconButton><IconButton label="裁剪图片" onClick={openCrop}><Crop size={16}/></IconButton></>}{!frameIsFixed(page,selected)&&<><IconButton label="复制元素" onClick={s.duplicateSelected}><Copy size={16}/></IconButton><IconButton label="删除元素" onClick={s.deleteSelected}><Trash2 size={16}/></IconButton></>}</div>}
    <input ref={replaceInput} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={e=>void replace(e.target.files)}/>
    <div className={`spread-area ${panel?'panel-open':''} zoom-${zoomMode}`} onWheel={handleWheel} title="滚轮：单页/双页缩放；单页内侧拖动：左右移动；跨页外侧拖动：翻页"><div ref={bookWindow} className={`book-window zoom-${zoomMode} ${turnDirection?`is-turning turn-${turnDirection}`:''}`} style={{width:bookWindowWidth,height:pageHeight}}><div ref={bookTrack} className="spread book-track" style={{width:spreadWidth,flexDirection:visualReverse?'row-reverse':'row',transform:`translateX(${focusedShift}px)`}}><div className={`active-page book-page book-page-${activeSide}`} onClick={()=>{if(zoomMode==='spread')setZoomMode('page');}}><EditorCanvas page={page} width={Math.max(90,canvasWidth)} onTextEdit={()=>setPanel('text')} onCrop={openCrop}/></div>{pairPage&&<button className={`paired-page book-page book-page-${pairSide}`} aria-label={`放大并编辑第 ${pairIndex} 页`} style={{width:canvasWidth}} onClick={()=>zoomToPage(pairIndex)}><PageThumbnail page={pairPage} scale={.5}/></button>}{showAddPageSlot&&<button className="paired-page book-page book-page-right empty-spread-page" aria-label="添加下一页" style={{width:canvasWidth}} onClick={s.addPage}><Plus size={28}/></button>}{(pairPage||showAddPageSlot)&&<div className="spine-shadow"/>}</div>{turnDirection&&turnPages(turnDirection)&&(()=>{const turn=turnPages(turnDirection)!;return <><div className={`turn-underlay turn-${turnDirection}`} style={{left:turnSheetLeft(turnDirection),width:canvasWidth}} aria-hidden><PageThumbnail page={book.pages[turn.under]} scale={.12} immediate/></div><div ref={turnSheet} className={`turning-sheet turn-${turnDirection}`} style={{left:turnSheetLeft(turnDirection),width:canvasWidth}} aria-hidden><div className="turn-face turn-front"><PageThumbnail page={book.pages[turn.front]} scale={.12} immediate/></div><div className="turn-face turn-back"><PageThumbnail page={book.pages[turn.back]} scale={.12} immediate/></div></div></>;})()}<div className={`page-turn-zone previous ${canPhysicalTurn('prev')?'':'disabled'}`} onPointerDown={e=>startTurn('prev',e)} onPointerMove={moveTurn} onPointerUp={endTurn} onPointerCancel={cancelTurn} aria-hidden/><div className={`page-turn-zone next ${canPhysicalTurn('next')?'':'disabled'}`} onPointerDown={e=>startTurn('next',e)} onPointerMove={moveTurn} onPointerUp={endTurn} onPointerCancel={cancelTurn} aria-hidden/>{zoomMode==='page'&&s.pageIndex>0&&pairPage&&<div className={`page-pan-zone ${visualReverse?'previous':'next'}`} style={{width:Math.max(76,canvasWidth*.24)}} onPointerDown={e=>startPan(visualReverse?'prev':'next',e)} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={cancelPan} title={visualReverse?'拖动回到同一跨页左页':'拖动到同一跨页右页'}/>} </div></div>
    <div className="page-strip clean-page-strip">{book.pages.map((p,i)=><button key={p.id} draggable={i!==0} aria-label={i===0?'封面':`第 ${i} 页`} className={i===s.pageIndex?'selected':''} onClick={()=>s.setPage(i)} onDragStart={()=>dragged.current=i} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged.current!==null)s.reorderPage(dragged.current,i);dragged.current=null;}}><PageThumbnail page={p}/></button>)}<button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={()=>{s.setPage(book.pages.length-1);s.addPage();}}><Plus size={17}/></button></div>
  </div><nav className="editor-tools">{tools.map(([id,Icon,label])=><button key={id} className={panel===id?'selected':''} onClick={()=>setPanel(panel===id?null:id)}><Icon size={21} strokeWidth={1.6}/><span>{label}</span></button>)}</nav>{panel&&<EditorPanel key={`${page.id}:${panel}`} panel={page.type==='cover'&&panel==='layouts'?'cover':page.type!=='cover'&&panel==='cover'?'layouts':panel} onPanel={setPanel} onClose={()=>setPanel(null)}/>}
  <ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>
  <Modal open={cropOpen} onClose={()=>setCropOpen(false)} title="裁剪图片" description="调整照片在画框中的位置"><label className="field">水平<input type="range" min={0} max={1} step={.01} value={crop.x} onChange={e=>setCrop({...crop,x:+e.target.value})}/></label><label className="field">垂直<input type="range" min={0} max={1} step={.01} value={crop.y} onChange={e=>setCrop({...crop,y:+e.target.value})}/></label><label className="field">缩放<input type="range" min={1} max={4} step={.05} value={crop.zoom} onChange={e=>setCrop({...crop,zoom:+e.target.value})}/></label><div className="actions"><Button onClick={()=>setCropOpen(false)}>取消</Button><Button className="primary" onClick={()=>{if(selected)s.updateElement(selected.id,{crop});setCropOpen(false);}}>确定</Button></div></Modal>
  </main>;
}



