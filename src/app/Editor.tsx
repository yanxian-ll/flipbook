import {useWorkspaceBackground} from '../components/useWorkspaceBackground';
import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {Copy,Grid2X2,Images,Palette,Plus,Sticker,Sun,Trash2,Type} from 'lucide-react';
import {repository,friendlyError} from '../db/repository';
import {useEditor} from '../store/editor';
import {EditorCanvas} from '../editor/EditorCanvas';
import {clearImageCache} from '../editor/renderer';
import {PageThumbnail} from '../components/PageThumbnail';
import {EditorFlipBook,type EditorFlipBookHandle} from '../components/EditorFlipBook';
import {Button,IconButton,Loading,ErrorMessage} from '../components/ui';
import {EditorPanel,type PanelId} from '../panels/EditorPanel';
import {ExportDialog} from '../export/ExportDialog';
import {VersionHistoryDialog} from '../components/VersionHistoryDialog';
import {frameIsFixed} from '../domain/layouts';
import {EditorHeader,PageDeleteDialog,ViewModeSwitch,WorkspaceToolbar} from './editor/EditorChrome';
import {EditorPreviewRail} from './editor/EditorPreviewRail';
import {useEditorShortcuts} from './editor/useEditorShortcuts';

const editorTools=([
  ['photos',Images,'素材库'],
  ['layouts',Grid2X2,'模版'],
  ['text',Type,'文字'],
  ['stickers',Sticker,'贴纸'],
  ['adjust',Sun,'调整'],
] as const);

type PanGesture={
  pointerId:number;
  direction:'next'|'prev';
  startX:number;
  lastX:number;
  lastAt:number;
  velocity:number;
  progress:number;
  started:boolean;
};

export function Editor(){
  const {bookId}=useParams();
  const navigate=useNavigate();
  const book=useEditor(state=>state.book);
  const pageIndex=useEditor(state=>state.pageIndex);
  const selectedIds=useEditor(state=>state.selected);
  const editorError=useEditor(state=>state.error);
  const workspaceStyle=useWorkspaceBackground(book);

  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [panel,setPanel]=useState<PanelId|null>(null);
  const [wide,setWide]=useState(true);
  const [exporting,setExporting]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [pageDeleteOpen,setPageDeleteOpen]=useState(false);
  const [viewWidth,setViewWidth]=useState(360);
  const [viewHeight,setViewHeight]=useState(500);
  const [zoomMode,setZoomMode]=useState<'spread'|'page'>('spread');
  const [photoDraft,setPhotoDraft]=useState<string[]>([]);
  const [photoLibraryOpen,setPhotoLibraryOpen]=useState(false);
  const [templateLibraryOpen,setTemplateLibraryOpen]=useState(false);
  const [spreadRoom,setSpreadRoom]=useState({width:0,height:0});

  const spreadStage=useRef<HTMLDivElement>(null);
  const workspace=useRef<HTMLDivElement>(null);
  const flipBook=useRef<EditorFlipBookHandle>(null);
  const focusTrack=useRef<HTMLDivElement>(null);
  const panGesture=useRef<PanGesture|null>(null);
  const wheelAccumulator=useRef(0);
  const wheelLocked=useRef(false);
  const wheelTimer=useRef<number|null>(null);

  useEditorShortcuts(()=>setPanel(null));

  useEffect(()=>{
    let live=true;
    setLoading(true);
    void repository.get(bookId!).then(loaded=>{
      if(!live)return;
      useEditor.getState().load(loaded);
      setLoading(false);
    }).catch(cause=>{
      setError(friendlyError(cause));
      setLoading(false);
    });
    return()=>{
      live=false;
      void useEditor.getState().flush().catch(()=>{});
      clearImageCache();
    };
  },[bookId]);

  useEffect(()=>{
    const node=workspace.current;if(!node)return;
    const observer=new ResizeObserver(entries=>{
      setViewWidth(entries[0].contentRect.width);
      setViewHeight(entries[0].contentRect.height);
    });
    observer.observe(node);
    return()=>observer.disconnect();
  },[loading,wide,panel]);

  useEffect(()=>{
    const node=spreadStage.current;if(!node)return;
    const observer=new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;
      setSpreadRoom({width,height});
    });
    observer.observe(node);
    return()=>observer.disconnect();
  },[loading]);

  useEffect(()=>{
    const state=useEditor.getState(),page=state.book?.pages[state.pageIndex];
    if(!page)return;
    setPhotoDraft([...new Set(page.elements.filter(element=>element.type==='image').map(element=>element.assetId).filter((id):id is string=>!!id))]);
  },[pageIndex,book?.pages[pageIndex]?.id]);

  useEffect(()=>()=>{
    if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);
  },[]);

  async function leave(path:string){
    try{
      await useEditor.getState().flush();
      navigate(path);
    }catch(cause){
      setError(friendlyError(cause));
    }
  }

  if(loading)return <main className="phone-shell"><Loading/></main>;
  if(!book||error&&book.id!==bookId)return <main className="phone-shell"><ErrorMessage message={error}/><Button onClick={()=>navigate('/')}>返回书架</Button></main>;

  const page=book.pages[pageIndex]??book.pages[0];
  const selected=page.elements.find(element=>selectedIds.includes(element.id));
  const pair=pageIndex===0?-1:pageIndex%2===1?pageIndex+1:pageIndex-1;
  const neighborIndex=pair>=0&&pair<book.pages.length?pair:-1;
  const neighborPage=neighborIndex>=0?book.pages[neighborIndex]:undefined;
  const showSingleAdd=pageIndex>0&&!neighborPage;
  const peek=.13;
  const spreadUnitWidth=Math.max(40,Math.min(wide?390:170,((spreadRoom.width||viewWidth)-32)/2,Math.max(60,(spreadRoom.height||viewHeight-215)-20)/1.4133333333));
  const singleWidthRoom=(viewWidth*.94)/(neighborPage||showSingleAdd?1+peek:1);
  const singleHeightRoom=Math.max(240,viewHeight-174)/1.4133333333;
  const pageCanvasWidth=Math.max(180,Math.min(wide?720:620,singleWidthRoom,singleHeightRoom));
  const pageHeight=pageCanvasWidth*1.4133333333;
  const visualReverse=pageIndex>0&&pageIndex%2===0;
  const activeSide=pageIndex===0?'cover':visualReverse?'right':'left';
  const pairSide=pageIndex===0?'right':visualReverse?'left':'right';
  const focusWindowWidth=pageCanvasWidth*(neighborPage||showSingleAdd?1+peek:1);
  const focusTrackWidth=pageCanvasWidth*(neighborPage||showSingleAdd?2:1);
  const focusedShift=(neighborPage||showSingleAdd)&&visualReverse?-pageCanvasWidth*(1-peek):0;

  function selectPage(index:number){
    if(index>=0&&index<book.pages.length&&index!==useEditor.getState().pageIndex)useEditor.getState().setPage(index);
  }

  function handlePageWheel(event:ReactWheelEvent<HTMLDivElement>){
    if(Math.abs(event.deltaY)<2)return;
    const target=event.target as HTMLElement;
    const imageConsumesWheel=selected?.type==='image'&&(
      target.closest('.cover-editor-photo-hit')||
      (frameIsFixed(page,selected)&&target.closest('.page-canvas'))
    );
    if(imageConsumesWheel)return;
    event.preventDefault();
    event.stopPropagation();
    if(wheelLocked.current)return;
    wheelAccumulator.current+=event.deltaY;
    if(Math.abs(wheelAccumulator.current)<28)return;
    const direction=wheelAccumulator.current>0?'next':'prev';
    wheelAccumulator.current=0;
    wheelLocked.current=true;
    if(zoomMode==='spread'){
      if(direction==='next')flipBook.current?.flipNext();else flipBook.current?.flipPrev();
    }else{
      const state=useEditor.getState(),step=direction==='next'?1:-1,targetIndex=state.pageIndex+step;
      if(targetIndex>=0&&targetIndex<(state.book?.pages.length??0))state.setPage(targetIndex);
    }
    if(wheelTimer.current!==null)window.clearTimeout(wheelTimer.current);
    wheelTimer.current=window.setTimeout(()=>{wheelLocked.current=false;},360);
  }

  function changeViewMode(mode:'spread'|'page'){
    if(mode===zoomMode)return;
    setZoomMode(mode);
    if(mode==='spread')requestAnimationFrame(()=>requestAnimationFrame(()=>flipBook.current?.turnTo(useEditor.getState().pageIndex)));
  }

  function setTrackShift(shift:number,transition='none'){
    if(!focusTrack.current)return;
    focusTrack.current.style.transition=transition;
    focusTrack.current.style.transform=`translateX(${shift}px)`;
  }

  function canPan(direction:'next'|'prev'){
    if(zoomMode!=='page'||pageIndex===0||(!neighborPage&&!showSingleAdd))return false;
    return direction==='next'?!visualReverse:visualReverse;
  }

  function panTargetShift(direction:'next'|'prev'){
    return direction==='next'?-pageCanvasWidth*(1-peek):0;
  }

  function clearPan(){
    panGesture.current=null;
    if(focusTrack.current)focusTrack.current.style.transition='';
  }

  function finishPan(commit:boolean){
    const gesture=panGesture.current;if(!gesture)return;
    const duration=commit?230:160,targetShift=panTargetShift(gesture.direction);
    setTrackShift(commit?targetShift:focusedShift,`transform ${duration}ms ${commit?'cubic-bezier(.2,.76,.18,1)':'cubic-bezier(.3,.72,.24,1)'}`);
    window.setTimeout(()=>{
      if(commit){
        if(neighborIndex>=0)useEditor.getState().setPage(neighborIndex);
        else if(showSingleAdd)addPageAndOpenPhotos();
      }
      clearPan();
    },duration+16);
  }

  function startPan(direction:'next'|'prev',event:ReactPointerEvent<HTMLDivElement>){
    if(event.button!==0||!canPan(direction))return;
    const now=performance.now();
    panGesture.current={pointerId:event.pointerId,direction,startX:event.clientX,lastX:event.clientX,lastAt:now,velocity:0,progress:0,started:false};
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function movePan(event:ReactPointerEvent<HTMLDivElement>){
    const gesture=panGesture.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    const now=performance.now(),dt=Math.max(1,now-gesture.lastAt);
    gesture.velocity=(event.clientX-gesture.lastX)/dt;
    gesture.lastX=event.clientX;
    gesture.lastAt=now;
    const signed=gesture.direction==='next'?gesture.startX-event.clientX:event.clientX-gesture.startX;
    const travel=Math.max(1,pageCanvasWidth*(1-peek));
    const progress=Math.max(0,Math.min(1,signed/travel));
    gesture.progress=progress;
    if(!gesture.started&&progress>.01)gesture.started=true;
    if(gesture.started){
      setTrackShift(focusedShift+(panTargetShift(gesture.direction)-focusedShift)*progress);
      event.preventDefault();
    }
  }

  function endPan(event:ReactPointerEvent<HTMLDivElement>){
    const gesture=panGesture.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    const signedVelocity=gesture.direction==='next'?-gesture.velocity:gesture.velocity;
    const commit=gesture.started&&(gesture.progress>.22||signedVelocity>.5);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(gesture.started)finishPan(commit);
    else{
      panGesture.current=null;
      if(neighborIndex>=0)selectPage(neighborIndex);
      else if(showSingleAdd)addPageAndOpenPhotos();
    }
  }

  function cancelPan(event:ReactPointerEvent<HTMLDivElement>){
    const gesture=panGesture.current;if(!gesture||gesture.pointerId!==event.pointerId)return;
    if(gesture.started)finishPan(false);else panGesture.current=null;
  }

  function openTool(next:PanelId){
    const state=useEditor.getState(),currentPage=state.book?.pages[state.pageIndex];
    if(next==='photos'&&currentPage?.type==='cover')setPhotoDraft(currentPage.elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!));
    const sideLibraries=wide&&viewWidth>=700;
    if(sideLibraries&&next==='photos'){setPanel(null);setPhotoLibraryOpen(true);return;}
    if(sideLibraries&&next==='layouts'){setPanel(null);setTemplateLibraryOpen(true);return;}
    if(next!=='photos'&&next!=='layouts'){setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
    setPanel(next);
  }

  function toggleTool(next:PanelId){
    const state=useEditor.getState(),currentPage=state.book?.pages[state.pageIndex];
    if(next==='photos'&&currentPage?.type==='cover')setPhotoDraft(currentPage.elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!));
    const sideLibraries=wide&&viewWidth>=700;
    if(sideLibraries&&next==='photos'){
      setPanel(null);
      setPhotoLibraryOpen(open=>!open);
      return;
    }
    if(sideLibraries&&next==='layouts'){
      setPanel(null);
      setTemplateLibraryOpen(open=>!open);
      return;
    }
    if(next!=='photos'&&next!=='layouts'){setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
    setPanel(current=>current===next?null:next);
  }

  function addPageAndOpenPhotos(){
    useEditor.getState().addPage();
    requestAnimationFrame(()=>openTool('photos'));
  }

  function confirmPageDelete(){
    const state=useEditor.getState();
    if(state.pageIndex<=0){setPageDeleteOpen(false);return;}
    state.removePage();
    setPageDeleteOpen(false);
    requestAnimationFrame(()=>requestAnimationFrame(()=>flipBook.current?.turnTo(useEditor.getState().pageIndex)));
  }

  const sideLibraries=wide&&viewWidth>=700;
  const photoSideOpen=sideLibraries&&(photoLibraryOpen||panel==='photos');
  const templateSideOpen=sideLibraries&&(templateLibraryOpen||panel==='layouts');
  const bothSideOpen=photoSideOpen&&templateSideOpen;
  const compactPanel=sideLibraries
    ?(panel&&panel!=='photos'&&panel!=='layouts'?panel:null)
    :(panel??(photoLibraryOpen?'photos':templateLibraryOpen?'layouts':null));

  return <main className={`phone-shell studio ${wide?'expanded':''} ${bothSideOpen?'libraries-open':''} ${photoSideOpen?'photo-library-open':''} ${templateSideOpen?'template-library-open':''}`}>
    <EditorHeader wide={wide} onBack={()=>void leave('/')} onToggleWide={()=>setWide(value=>!value)}/>
    <ErrorMessage message={error||editorError}/>

    <div className="editor-workspace" ref={workspace} style={workspaceStyle}>
      <WorkspaceToolbar
        onHistory={()=>setHistoryOpen(true)}
        onBookStyle={()=>toggleTool('book-style')}
        onBackground={()=>toggleTool('background')}
        onPreview={()=>void leave(`/preview/${book.id}`)}
        onExport={()=>setExporting(true)}
      />
      <ViewModeSwitch
        mode={zoomMode}
        top={!wide&&zoomMode==='spread'?`max(46px, calc(50% - ${spreadUnitWidth*1.4133333333/2+52}px))`:undefined}
        onChange={changeViewMode}
      />

      {selected&&!frameIsFixed(page,selected)&&<div className="context-toolbar">
        <IconButton label="复制元素" onClick={()=>useEditor.getState().duplicateSelected()}><Copy size={16}/></IconButton>
        <IconButton label="删除元素" onClick={()=>useEditor.getState().deleteSelected()}><Trash2 size={16}/></IconButton>
      </div>}

      <div ref={spreadStage} className={`spread-area native-book-stage ${panel||photoSideOpen||templateSideOpen?'panel-open':''} zoom-${zoomMode}`} onWheelCapture={handlePageWheel}>
        {zoomMode==='spread'
          ?<EditorFlipBook
            ref={flipBook}
            book={book}
            pageWidth={spreadUnitWidth}
            activeIndex={pageIndex}
            onFlip={index=>{if(index<book.pages.length)useEditor.getState().setPage(index);}}
            onSelect={selectPage}
            onAddPage={addPageAndOpenPhotos}
            onTextEdit={()=>openTool('text')}
            onCrop={()=>openTool('photos')}
            onImageSelect={()=>openTool('photos')}
            onBlankPage={()=>openTool('photos')}
          />
          :pageIndex===0
            ?<EditorFlipBook
              ref={flipBook}
              book={book}
              pageWidth={spreadUnitWidth}
              activeIndex={0}
              onFlip={index=>{if(index<book.pages.length)useEditor.getState().setPage(index);}}
              onSelect={selectPage}
              onAddPage={addPageAndOpenPhotos}
              onTextEdit={()=>openTool('text')}
              onCrop={()=>openTool('photos')}
              onImageSelect={()=>openTool('photos')}
              onBlankPage={()=>openTool('photos')}
            />
            :<div className="focused-book-shell single-page-editor-shell" style={{width:focusWindowWidth,height:pageHeight}}>
              <div ref={focusTrack} className="spread book-track focused-book-track" style={{width:focusTrackWidth,flexDirection:visualReverse?'row-reverse':'row',transform:`translateX(${focusedShift}px)`}}>
                <div className={`active-page book-page book-page-${activeSide}`}><EditorCanvas page={page} width={pageCanvasWidth} onTextEdit={()=>openTool('text')} onCrop={()=>openTool('photos')} onImageSelect={()=>openTool('photos')} onBackgroundClick={()=>openTool('photos')}/></div>
                {neighborPage&&<button className={`paired-page book-page book-page-${pairSide}`} aria-label={`编辑第 ${neighborIndex} 页`} style={{width:pageCanvasWidth}} onClick={()=>{selectPage(neighborIndex);if(!neighborPage.elements.some(element=>element.type==='image'))requestAnimationFrame(()=>openTool('photos'));}}><PageThumbnail page={neighborPage} scale={.5} immediate/></button>}
                {showSingleAdd&&<button className="paired-page book-page book-page-right empty-spread-page" aria-label="添加下一页" style={{width:pageCanvasWidth}} onClick={addPageAndOpenPhotos}><Plus size={28}/></button>}
                {(neighborPage||showSingleAdd)&&<div className="spine-shadow"/>}
              </div>
              {(neighborPage||showSingleAdd)&&<div className={`page-pan-zone ${visualReverse?'previous':'next'}`} style={{width:Math.max(72,pageCanvasWidth*.22)}} onPointerDown={event=>startPan(visualReverse?'prev':'next',event)} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={cancelPan} title={showSingleAdd?'拖动添加下一页':visualReverse?'拖动回到同一跨页左页':'拖动到同一跨页右页'}/>}
            </div>
        }
        {pageIndex===0&&<div className="cover-quick-actions editor-cover-actions" style={{top:`calc(50% + ${(zoomMode==='spread'||pageIndex===0?spreadUnitWidth:pageCanvasWidth)*1.4133333333/2+28}px)`}}>
          <button onClick={()=>toggleTool('cover')}><Images size={15}/>换个封面</button><i/><button onClick={()=>toggleTool('background')}><Palette size={15}/>换个背景</button>
        </div>}
      </div>

      <EditorPreviewRail
        book={book}
        mode={zoomMode}
        flipBook={flipBook}
        onAddPage={addPageAndOpenPhotos}
        onRequestDelete={()=>setPageDeleteOpen(true)}
      />
    </div>

    <nav className="editor-tools">{editorTools.map(([id,Icon,label])=>{
      const selectedTool=id==='photos'?(photoSideOpen||compactPanel==='photos'):id==='layouts'?(templateSideOpen||compactPanel==='layouts'):compactPanel===id;
      return <button key={id} className={selectedTool?'selected':''} onClick={()=>toggleTool(id)}><Icon size={21} strokeWidth={1.6}/><span>{label}</span></button>;
    })}</nav>

    {photoSideOpen&&<EditorPanel key={`${page.id}:photos`} panel="photos" placement="left" paired={bothSideOpen} photoIds={photoDraft} onPhotoIdsChange={setPhotoDraft} onPanel={openTool} onClose={()=>{setPhotoLibraryOpen(false);if(panel==='photos')setPanel(null);}}/>}
    {templateSideOpen&&<EditorPanel key={`${page.id}:layouts`} panel="layouts" placement="right" paired={bothSideOpen} photoIds={photoDraft} onPhotoIdsChange={setPhotoDraft} onPanel={openTool} onClose={()=>{setTemplateLibraryOpen(false);if(panel==='layouts')setPanel(null);}}/>}
    {compactPanel&&<EditorPanel key={`${page.id}:${compactPanel}`} panel={page.type!=='cover'&&compactPanel==='cover'?'layouts':compactPanel} photoIds={photoDraft} onPhotoIdsChange={setPhotoDraft} onPanel={openTool} onClose={()=>{setPanel(null);setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}}/>}

    <PageDeleteDialog open={pageDeleteOpen&&pageIndex>0} pageIndex={pageIndex} onClose={()=>setPageDeleteOpen(false)} onConfirm={confirmPageDelete}/>
    <ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>
    <VersionHistoryDialog
      book={book}
      open={historyOpen}
      onClose={()=>setHistoryOpen(false)}
      onBeforeRestore={async()=>{await useEditor.getState().flush();}}
      onRestore={restored=>{useEditor.getState().load(restored);setPanel(null);setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}}
    />
  </main>;
}
