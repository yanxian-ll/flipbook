import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {ChevronLeft,Undo2,Redo2,Eye,Upload,Images,Grid2X2,Type,Sun,Plus,Sticker,Maximize2,Minimize2,Copy,Trash2,BookOpen,Palette,Check} from 'lucide-react';
import {repository,friendlyError} from '../db/repository';
import {useEditor} from '../store/editor';
import {EditorCanvas} from '../editor/EditorCanvas';
import {clearImageCache} from '../editor/renderer';
import {PageThumbnail} from '../components/PageThumbnail';
import {EditorFlipBook,type EditorFlipBookHandle} from '../components/EditorFlipBook';
import {Button,IconButton,Loading,ErrorMessage} from '../components/ui';
import {EditorPanel,type PanelId} from '../panels/EditorPanel';
import {ExportDialog} from '../export/ExportDialog';
import {frameIsFixed} from '../domain/layouts';

export function Editor(){
  const {bookId}=useParams();const navigate=useNavigate();const s=useEditor();
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[panel,setPanel]=useState<PanelId|null>(null),[wide,setWide]=useState(true),[exporting,setExporting]=useState(false),[viewWidth,setViewWidth]=useState(360),[viewHeight,setViewHeight]=useState(500),[zoomMode,setZoomMode]=useState<'spread'|'page'>('spread'),[dragSpread,setDragSpread]=useState<number|null>(null),[dragOverSpread,setDragOverSpread]=useState<number|null>(null),[photoDraft,setPhotoDraft]=useState<string[]>([]);
  const workspace=useRef<HTMLDivElement>(null),flipBook=useRef<EditorFlipBookHandle>(null),focusTrack=useRef<HTMLDivElement>(null),previewStrip=useRef<HTMLDivElement>(null),suppressSpreadClick=useRef(false);
  const panGesture=useRef<{pointerId:number;direction:'next'|'prev';startX:number;lastX:number;lastAt:number;velocity:number;progress:number;started:boolean}|null>(null);
  const wheelAccumulator=useRef(0),wheelLocked=useRef(false),wheelTimer=useRef<number|null>(null);

  useEffect(()=>{let live=true;setLoading(true);void repository.get(bookId!).then(book=>{if(!live)return;s.load(book);setLoading(false);}).catch(e=>{setError(friendlyError(e));setLoading(false);});return()=>{live=false;void useEditor.getState().flush().catch(()=>{});clearImageCache();};},[bookId]);
  useEffect(()=>{if(!workspace.current)return;const observer=new ResizeObserver(entries=>{setViewWidth(entries[0].contentRect.width);setViewHeight(entries[0].contentRect.height);});observer.observe(workspace.current);return()=>observer.disconnect();},[loading,wide,panel]);
  useEffect(()=>{const state=useEditor.getState(),page=state.book?.pages[state.pageIndex];if(!page)return;setPhotoDraft([...new Set(page.elements.filter(element=>element.type==='image').map(element=>element.assetId).filter((id):id is string=>!!id))]);},[s.pageIndex,s.book?.pages[s.pageIndex]?.id]);
  useEffect(()=>()=>{if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);},[]);
  useEffect(()=>{const strip=previewStrip.current;if(!strip)return;const selected=strip.querySelector<HTMLElement>('.selected');if(!selected)return;const left=selected.offsetLeft-(strip.clientWidth-selected.offsetWidth)/2;strip.scrollTo({left:Math.max(0,left),behavior:'smooth'});},[s.pageIndex,zoomMode,s.book?.pages.length]);
  useEffect(()=>{function key(e:KeyboardEvent){if((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')||document.querySelector('[role=dialog]'))return;const state=useEditor.getState();const mod=e.ctrlKey||e.metaKey;const key=e.key.toLowerCase();if(mod&&key==='z'){e.preventDefault();if(e.shiftKey)state.redo();else state.undo();}else if(mod&&['c','v','d'].includes(key)){e.preventDefault();if(key==='c')state.copy();if(key==='v')state.paste();if(key==='d')state.duplicateSelected();}else if(key==='delete'||key==='backspace'){e.preventDefault();state.deleteSelected();}else if(key==='escape'){state.select(null);setPanel(null);}else if(e.key.startsWith('Arrow')&&state.selected.length){e.preventDefault();const d=e.shiftKey?10:1;state.change(b=>{for(const element of b.pages[state.pageIndex].elements){if(state.selected.includes(element.id)&&!element.locked&&!frameIsFixed(b.pages[state.pageIndex],element)){element.x+=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0;element.y+=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0;}}});}}
    function exit(e:BeforeUnloadEvent){if(useEditor.getState().status!=='saved'){void useEditor.getState().flush().catch(()=>{});e.preventDefault();}}
    function visibility(){if(document.visibilityState==='hidden')void useEditor.getState().flush().catch(()=>{});}
    window.addEventListener('keydown',key);window.addEventListener('beforeunload',exit);document.addEventListener('visibilitychange',visibility);return()=>{window.removeEventListener('keydown',key);window.removeEventListener('beforeunload',exit);document.removeEventListener('visibilitychange',visibility);};},[]);

  async function leave(path:string){try{await s.flush();navigate(path);}catch(e){setError(friendlyError(e));}}
  if(loading)return <main className="phone-shell"><Loading/></main>;
  if(!s.book||error&&s.book.id!==bookId)return <main className="phone-shell"><ErrorMessage message={error}/><Button onClick={()=>navigate('/')}>返回书架</Button></main>;

  const book=s.book,page=book.pages[s.pageIndex]??book.pages[0],selected=page.elements.find(e=>s.selected.includes(e.id));
  const thumbnailSpreads=Array.from({length:Math.ceil(Math.max(0,book.pages.length-1)/2)},(_,i)=>1+i*2);
  const pair=s.pageIndex===0?1:s.pageIndex%2===1?s.pageIndex+1:s.pageIndex-1;
  const neighborIndex=pair>=0&&pair<book.pages.length?pair:-1;
  const neighborPage=neighborIndex>=0?book.pages[neighborIndex]:undefined;
  const showSingleAdd=s.pageIndex>0&&!neighborPage;
  const peek=.13;
  const spreadUnitWidth=Math.min(wide?390:170,(viewWidth-54)/2,Math.max(120,viewHeight-215)/1.4133);
  const singleWidthRoom=(viewWidth*.94)/(neighborPage||showSingleAdd?1+peek:1);
  const singleHeightRoom=Math.max(240,viewHeight-174)/1.4133333333;
  const pageCanvasWidth=Math.max(180,Math.min(wide?720:620,singleWidthRoom,singleHeightRoom));
  const pageHeight=pageCanvasWidth*1.4133333333;
  const visualReverse=s.pageIndex>0&&s.pageIndex%2===0;
  const activeSide=s.pageIndex===0?'cover':visualReverse?'right':'left';
  const pairSide=s.pageIndex===0?'right':visualReverse?'left':'right';
  const focusWindowWidth=pageCanvasWidth*(neighborPage||showSingleAdd?1+peek:1);
  const focusTrackWidth=pageCanvasWidth*(neighborPage||showSingleAdd?2:1);
  const focusedShift=(neighborPage||showSingleAdd)&&visualReverse?-pageCanvasWidth*(1-peek):0;
  const tools=([['photos',Images,'素材库'],['layouts',Grid2X2,'模版'],['text',Type,'文字'],['stickers',Sticker,'贴纸'],['adjust',Sun,'调整']] as const).filter(([id])=>page.type!=='cover'||!['layouts','stickers'].includes(id));

  function selectPage(index:number){if(index>=0&&index<book.pages.length&&index!==useEditor.getState().pageIndex)useEditor.getState().setPage(index);}
  function handlePageWheel(e:ReactWheelEvent<HTMLDivElement>){
    if(Math.abs(e.deltaY)<2)return;
    e.preventDefault();
    if(wheelLocked.current)return;
    wheelAccumulator.current+=e.deltaY;
    if(Math.abs(wheelAccumulator.current)<28)return;
    const direction=wheelAccumulator.current>0?'next':'prev';
    wheelAccumulator.current=0;wheelLocked.current=true;
    if(zoomMode==='spread'){
      if(direction==='next')flipBook.current?.flipNext();else flipBook.current?.flipPrev();
    }else{
      const state=useEditor.getState(),step=direction==='next'?1:-1,target=state.pageIndex+step;
      if(target>=0&&target<(state.book?.pages.length??0))state.setPage(target);
    }
    if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);
    wheelTimer.current=window.setTimeout(()=>{wheelLocked.current=false;},360);
  }
  function changeViewMode(mode:'spread'|'page'){
    if(mode===zoomMode)return;
    setZoomMode(mode);
    if(mode==='spread')requestAnimationFrame(()=>requestAnimationFrame(()=>flipBook.current?.turnTo(useEditor.getState().pageIndex)));
  }
  function setTrackShift(shift:number,transition='none'){if(!focusTrack.current)return;focusTrack.current.style.transition=transition;focusTrack.current.style.transform=`translateX(${shift}px)`;}
  function canPan(direction:'next'|'prev'){
    if(zoomMode!=='page'||s.pageIndex===0||(!neighborPage&&!showSingleAdd))return false;
    return direction==='next'?!visualReverse:visualReverse;
  }
  function panTargetShift(direction:'next'|'prev'){return direction==='next'?-pageCanvasWidth*(1-peek):0;}
  function clearPan(){panGesture.current=null;if(focusTrack.current)focusTrack.current.style.transition='';}
  function finishPan(commit:boolean){
    const g=panGesture.current;if(!g)return;
    const duration=commit?230:160,targetShift=panTargetShift(g.direction);
    setTrackShift(commit?targetShift:focusedShift,`transform ${duration}ms ${commit?'cubic-bezier(.2,.76,.18,1)':'cubic-bezier(.3,.72,.24,1)'}`);
    window.setTimeout(()=>{
      if(commit){
        if(neighborIndex>=0)useEditor.getState().setPage(neighborIndex);
        else if(showSingleAdd)useEditor.getState().addPage();
      }
      clearPan();
    },duration+16);
  }
  function startPan(direction:'next'|'prev',e:ReactPointerEvent<HTMLDivElement>){
    if(e.button!==0||!canPan(direction))return;
    const now=performance.now();
    panGesture.current={pointerId:e.pointerId,direction,startX:e.clientX,lastX:e.clientX,lastAt:now,velocity:0,progress:0,started:false};
    e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();
  }
  function movePan(e:ReactPointerEvent<HTMLDivElement>){
    const g=panGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    const now=performance.now(),dt=Math.max(1,now-g.lastAt);g.velocity=(e.clientX-g.lastX)/dt;g.lastX=e.clientX;g.lastAt=now;
    const signed=g.direction==='next'?g.startX-e.clientX:e.clientX-g.startX,travel=Math.max(1,pageCanvasWidth*(1-peek));
    const progress=Math.max(0,Math.min(1,signed/travel));g.progress=progress;
    if(!g.started&&progress>.01)g.started=true;
    if(g.started){setTrackShift(focusedShift+(panTargetShift(g.direction)-focusedShift)*progress);e.preventDefault();}
  }
  function endPan(e:ReactPointerEvent<HTMLDivElement>){
    const g=panGesture.current;if(!g||g.pointerId!==e.pointerId)return;
    const signedVelocity=g.direction==='next'?-g.velocity:g.velocity,commit=g.started&&(g.progress>.22||signedVelocity>.5);
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    if(g.started)finishPan(commit);
    else{
      panGesture.current=null;
      if(neighborIndex>=0)selectPage(neighborIndex);
      else if(showSingleAdd)s.addPage();
    }
  }
  function cancelPan(e:ReactPointerEvent<HTMLDivElement>){const g=panGesture.current;if(!g||g.pointerId!==e.pointerId)return;if(g.started)finishPan(false);else panGesture.current=null;}
  function dropSpread(targetStart:number){
    const from=dragSpread;setDragSpread(null);setDragOverSpread(null);
    if(from===null||from===targetStart)return;
    suppressSpreadClick.current=true;
    s.reorderSpread(from,targetStart);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{flipBook.current?.turnTo(useEditor.getState().pageIndex);window.setTimeout(()=>{suppressSpreadClick.current=false;},0);}));
  }

  const pairedLibraries=wide&&viewWidth>=700&&page.type!=='cover'&&(panel==='photos'||panel==='layouts');
  return <main className={`phone-shell studio ${wide?'expanded':''} ${pairedLibraries?'libraries-open':''}`}><header className="studio-header"><IconButton label="返回书架" onClick={()=>void leave('/')}><ChevronLeft size={21}/></IconButton><input className="editor-title" aria-label="画册名称" value={book.title} onChange={e=>s.change(b=>{b.title=e.target.value;})}/><IconButton label={wide?'收起工作区':'展开工作区'} onClick={()=>setWide(!wide)}>{wide?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</IconButton></header><ErrorMessage message={error||s.error}/>
    <div className="editor-workspace" ref={workspace} style={{backgroundColor:book.workspaceBackground}}>
      <div className="workspace-toolbar"><div className="toolbar-pill"><IconButton label="撤销" disabled={!s.past.length} onClick={s.undo}><Undo2 size={16}/></IconButton><IconButton label="重做" disabled={!s.future.length} onClick={s.redo}><Redo2 size={16}/></IconButton></div><div className="toolbar-pill">{page.type==='cover'&&<IconButton label="封面设置" onClick={()=>setPanel(panel==='cover'?null:'cover')}><BookOpen size={16}/></IconButton>}<IconButton label="垫底背景" onClick={()=>setPanel(panel==='background'?null:'background')}><Palette size={16}/></IconButton><IconButton label="翻页预览" onClick={()=>void leave(`/preview/${book.id}`)}><Eye size={16}/></IconButton><IconButton label="导出 Flipin" onClick={()=>setExporting(true)}><Upload size={16}/></IconButton></div></div>
      <div className="view-mode-switch" role="group" aria-label="页面显示模式"><button type="button" className={zoomMode==='spread'?'active':''} aria-pressed={zoomMode==='spread'} onClick={()=>changeViewMode('spread')}>双页</button><button type="button" className={zoomMode==='page'?'active':''} aria-pressed={zoomMode==='page'} onClick={()=>changeViewMode('page')}>单页</button></div>
      <div className="save-status" role="status">{s.status==='saved'?<><Check size={10}/>已保存</>:s.status==='saving'?'保存中…':<button onClick={()=>void s.flush().catch(()=>{})}>保存失败，点此重试</button>}</div>
      {selected&&!frameIsFixed(page,selected)&&<div className="context-toolbar"><IconButton label="复制元素" onClick={s.duplicateSelected}><Copy size={16}/></IconButton><IconButton label="删除元素" onClick={s.deleteSelected}><Trash2 size={16}/></IconButton></div>}
      <div className={`spread-area native-book-stage ${panel?'panel-open':''} zoom-${zoomMode}`} onWheel={handlePageWheel} title={zoomMode==='spread'?'滚轮切换跨页；点击另一页切换编辑页；拖书角或两侧翻页':'滚轮逐页切换；单页编辑；旁边保留同跨页预览'}>
        {zoomMode==='spread'
          ?<EditorFlipBook
            ref={flipBook}
            book={book}
            pageWidth={spreadUnitWidth}
            activeIndex={s.pageIndex}
            onFlip={index=>{if(index<book.pages.length)s.setPage(index);}}
            onSelect={selectPage}
            onAddPage={()=>s.addPage()}
            onTextEdit={()=>setPanel('text')}
            onCrop={()=>setPanel('photos')}
            onImageSelect={()=>setPanel('photos')}
          />
          :<div className="focused-book-shell single-page-editor-shell" style={{width:focusWindowWidth,height:pageHeight}}>
            <div ref={focusTrack} className="spread book-track focused-book-track" style={{width:focusTrackWidth,flexDirection:visualReverse?'row-reverse':'row',transform:`translateX(${focusedShift}px)`}}>
              <div className={`active-page book-page book-page-${activeSide}`}><EditorCanvas page={page} width={pageCanvasWidth} onTextEdit={()=>setPanel('text')} onCrop={()=>setPanel('photos')} onImageSelect={()=>setPanel('photos')}/></div>
              {neighborPage&&<button className={`paired-page book-page book-page-${pairSide}`} aria-label={`编辑第 ${neighborIndex} 页`} style={{width:pageCanvasWidth}} onClick={()=>selectPage(neighborIndex)}><PageThumbnail page={neighborPage} scale={.5}/></button>}
              {showSingleAdd&&<button className="paired-page book-page book-page-right empty-spread-page" aria-label="添加下一页" style={{width:pageCanvasWidth}} onClick={s.addPage}><Plus size={28}/></button>}
              {(neighborPage||showSingleAdd)&&<div className="spine-shadow"/>}
            </div>
            {(neighborPage||showSingleAdd)&&s.pageIndex>0&&<div className={`page-pan-zone ${visualReverse?'previous':'next'}`} style={{width:Math.max(72,pageCanvasWidth*.22)}} onPointerDown={e=>startPan(visualReverse?'prev':'next',e)} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={cancelPan} title={showSingleAdd?'拖动添加下一页':visualReverse?'拖动回到同一跨页左页':'拖动到同一跨页右页'}/>}
          </div>
        }
        {zoomMode==='spread'&&s.pageIndex===0&&<div className="cover-quick-actions editor-cover-actions" style={{top:`calc(50% + ${spreadUnitWidth*1.4133333333/2+28}px)`}}><button onClick={()=>setPanel(panel==='cover'?null:'cover')}><Images size={15}/>换个封面</button><i/><button onClick={()=>setPanel(panel==='background'?null:'background')}><Palette size={15}/>换个背景</button></div>}
      </div>
      {zoomMode==='spread'&&s.pageIndex!==0&&<div ref={previewStrip} className="page-strip clean-page-strip spread-preview-strip" aria-label="双页预览"><div className="page-strip-track"><button className="cover-spread-thumb" aria-label="封面" onClick={()=>flipBook.current?.flipTo(0)}><PageThumbnail page={book.pages[0]}/></button>{thumbnailSpreads.map(start=>{const left=book.pages[start],right=book.pages[start+1],selectedSpread=s.pageIndex===start||s.pageIndex===start+1;return <button key={left.id} draggable className={`spread-thumb ${selectedSpread?'selected':''} ${dragSpread===start?'dragging':''} ${dragOverSpread===start&&dragSpread!==start?'drag-over':''}`} aria-label={right?`第 ${start}–${start+1} 页，可拖动排序`:`第 ${start} 页，可拖动排序`} onClick={()=>{if(suppressSpreadClick.current)return;flipBook.current?.flipTo(start);s.setPage(start);}} onDragStart={e=>{suppressSpreadClick.current=true;setDragSpread(start);setDragOverSpread(start);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(start));}} onDragEnter={e=>{e.preventDefault();if(dragSpread!==null&&dragSpread!==start)setDragOverSpread(start);}} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move';if(dragSpread!==null&&dragSpread!==start)setDragOverSpread(start);}} onDrop={e=>{e.preventDefault();dropSpread(start);}} onDragEnd={()=>{setDragSpread(null);setDragOverSpread(null);window.setTimeout(()=>{suppressSpreadClick.current=false;},0);}}><div className="spread-thumb-page"><PageThumbnail page={left}/></div><div className={`spread-thumb-page ${right?'':'blank'}`}>{right&&<PageThumbnail page={right}/>}</div></button>;})}<button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={()=>s.addPage()}><Plus size={17}/></button></div></div>}
      {zoomMode==='page'&&<div ref={previewStrip} className="page-strip clean-page-strip single-preview-strip" aria-label="单页预览"><div className="page-strip-track">{book.pages.map((thumb,index)=><button key={thumb.id} className={`single-page-thumb ${s.pageIndex===index?'selected':''}`} aria-label={index===0?'封面':`第 ${index} 页`} onClick={()=>s.setPage(index)}><PageThumbnail page={thumb}/></button>)}<button className="thumbnail-add-page" aria-label="添加新页" title="添加新页" onClick={()=>s.addPage()}><Plus size={17}/></button></div></div>}
    </div>
    <nav className="editor-tools">{tools.map(([id,Icon,label])=><button key={id} className={panel===id?'selected':''} onClick={()=>setPanel(panel===id?null:id)}><Icon size={21} strokeWidth={1.6}/><span>{label}</span></button>)}</nav>
    {pairedLibraries?<><EditorPanel key={`${page.id}:photos`} panel="photos" placement="left" paired photoIds={photoDraft} onPhotoIdsChange={setPhotoDraft} onPanel={setPanel} onClose={()=>setPanel(null)}/><EditorPanel key={`${page.id}:layouts`} panel="layouts" placement="right" paired photoIds={photoDraft} onPhotoIdsChange={setPhotoDraft} onPanel={setPanel} onClose={()=>setPanel(null)}/></>:panel&&<EditorPanel key={`${page.id}:${panel}`} panel={page.type==='cover'&&panel==='layouts'?'cover':page.type!=='cover'&&panel==='cover'?'layouts':panel} photoIds={photoDraft} onPhotoIdsChange={setPhotoDraft} onPanel={setPanel} onClose={()=>setPanel(null)}/>}
    <ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>
  </main>;
}
