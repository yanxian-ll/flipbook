import {useWorkspaceBackground} from '../components/useWorkspaceBackground';
import {useEffect,useRef,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {Grid2X2,Images,Palette,Sticker,Type} from 'lucide-react';
import {repository,friendlyError} from '../db/repository';
import {useEditor} from '../store/editor';
import {clearImageCache} from '../editor/renderer';
import {EditorFlipBook,type EditorFlipBookHandle} from '../components/EditorFlipBook';
import {Button,Loading,ErrorMessage} from '../components/ui';
import {EditorPanel,type PanelId} from '../panels/EditorPanel';
import {TextureBackgroundPanel} from '../panels/TextureBackgroundPanel';
import {ExportDialog} from '../export/ExportDialog';
import {VersionHistoryDialog} from '../components/VersionHistoryDialog';
import {frameIsFixed} from '../domain/layouts';
import {EditorHeader,PageDeleteDialog,ViewModeSwitch,WorkspaceToolbar} from './editor/EditorChrome';
import {EditorPreviewRail} from './editor/EditorPreviewRail';
import {EditorContextToolbar} from './editor/EditorContextToolbar';
import {useEditorShortcuts} from './editor/useEditorShortcuts';
import {useEditorLayout} from './editor/useEditorLayout';
import {useEditorPanels} from './editor/useEditorPanels';
import {usePageNavigation} from './editor/usePageNavigation';
import {PAGE_ASPECT_RATIO} from './editor/constants';

const editorTools=([
  ['photos',Images,'素材库'],
  ['layouts',Grid2X2,'模版'],
  ['text',Type,'文字'],
  ['stickers',Sticker,'贴纸'],
  ['page-background',Palette,'底纹'],
] as const);

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
  const [wide,setWide]=useState(true);
  const [exporting,setExporting]=useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const [pageDeleteOpen,setPageDeleteOpen]=useState(false);
  const [viewWidth,setViewWidth]=useState(360);
  const [viewHeight,setViewHeight]=useState(500);
  const [zoomMode,setZoomMode]=useState<'spread'|'page'>('spread');
  const [spreadRoom,setSpreadRoom]=useState({width:0,height:0});

  const spreadStage=useRef<HTMLDivElement>(null);
  const workspace=useRef<HTMLDivElement>(null);
  const flipBook=useRef<EditorFlipBookHandle>(null);
  const focusTrack=useRef<HTMLDivElement>(null);

  const panels=useEditorPanels({book,pageIndex,wide,viewWidth});
  const layout=useEditorLayout({book,pageIndex,wide,viewWidth,viewHeight,spreadRoom});
  const selected=layout?.page.elements.find(element=>selectedIds.includes(element.id));

  function selectPage(index:number){
    if(book&&index>=0&&index<book.pages.length&&index!==useEditor.getState().pageIndex)useEditor.getState().setPage(index);
  }
  function addPageAndOpenPhotos(){
    useEditor.getState().addPage();
    requestAnimationFrame(()=>panels.openTool('photos'));
  }
  function openTextEditor(){
    panels.openTool('text');
    requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('.editor-panel textarea[aria-label="文字内容"]')?.focus()));
  }

  const pageNavigation=usePageNavigation({
    zoomMode,
    pageIndex,
    pageCount:book?.pages.length??0,
    hasSelectedElement:!!selected,
    flipBook,
    focusTrack,
    neighborIndex:layout?.neighborIndex??-1,
    neighborAvailable:!!layout?.neighborPage,
    showSingleAdd:!!layout?.showSingleAdd,
    pageCanvasWidth:layout?.pageCanvasWidth??0,
    visualReverse:!!layout?.visualReverse,
    focusedShift:layout?.focusedShift??0,
    onSelectPage:selectPage,
    onAddPage:addPageAndOpenPhotos,
  });
  useEditorShortcuts(()=>panels.setPanel(null));

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
  },[loading]);

  useEffect(()=>{
    const node=spreadStage.current;if(!node)return;
    const observer=new ResizeObserver(entries=>{
      const {width,height}=entries[0].contentRect;
      setSpreadRoom({width,height});
    });
    observer.observe(node);
    return()=>observer.disconnect();
  },[loading]);

  async function leave(path:string){
    try{await useEditor.getState().flush();navigate(path);}
    catch(cause){setError(friendlyError(cause));}
  }
  function changeViewMode(mode:'spread'|'page'){
    if(mode===zoomMode)return;
    setZoomMode(mode);
    if(mode==='spread')requestAnimationFrame(()=>requestAnimationFrame(()=>flipBook.current?.turnTo(useEditor.getState().pageIndex)));
  }
  function confirmPageDelete(){
    const state=useEditor.getState();
    if(state.pageIndex<=0){setPageDeleteOpen(false);return;}
    state.removePage();
    setPageDeleteOpen(false);
    requestAnimationFrame(()=>requestAnimationFrame(()=>flipBook.current?.turnTo(useEditor.getState().pageIndex)));
  }

  if(loading)return <main className="phone-shell"><Loading/></main>;
  if(!book||!layout||error&&book.id!==bookId)return <main className="phone-shell"><ErrorMessage message={error}/><Button onClick={()=>navigate('/')}>返回书架</Button></main>;

  const {page,neighborPage,showSingleAdd,spreadUnitWidth,pageCanvasWidth,pageHeight,visualReverse,focusWindowWidth,focusedShift}=layout;
  const fixed=selected?frameIsFixed(page,selected):false;

  return <main className={`phone-shell studio ${wide?'expanded':''} ${panels.bothSideOpen?'libraries-open':''} ${panels.photoSideOpen?'photo-library-open':''} ${panels.templateSideOpen?'template-library-open':''} ${panels.compactPanel==='page-background'?'page-background-open':''}`}>
    <EditorHeader wide={wide} onBack={()=>void leave('/')} onToggleWide={()=>setWide(value=>!value)}/>
    <ErrorMessage message={error||editorError}/>

    <div className="editor-workspace" ref={workspace} style={workspaceStyle}>
      <WorkspaceToolbar
        onHistory={()=>setHistoryOpen(true)}
        onBookStyle={()=>panels.toggleTool('book-style')}
        onBackground={()=>panels.toggleTool('background')}
        onPreview={()=>void leave(`/preview/${book.id}`)}
        onExport={()=>setExporting(true)}
      />
      <ViewModeSwitch
        mode={zoomMode}
        top={!wide&&zoomMode==='spread'?`max(46px, calc(50% - ${spreadUnitWidth*PAGE_ASPECT_RATIO/2+52}px))`:undefined}
        onChange={changeViewMode}
      />

      {selected&&<EditorContextToolbar
        element={selected}
        fixed={fixed}
        onReplace={()=>panels.openTool('photos')}
        onEditText={openTextEditor}
        onAdjust={()=>panels.openTool('adjust')}
        onDuplicate={()=>useEditor.getState().duplicateSelected()}
        onDelete={()=>useEditor.getState().deleteSelected()}
      />}

      <div ref={spreadStage} className={`spread-area native-book-stage ${panels.panel||panels.photoSideOpen||panels.templateSideOpen?'panel-open':''} zoom-${zoomMode}`} onWheelCapture={pageNavigation.handlePageWheel}>
        {zoomMode==='spread'
          ?<EditorFlipBook
            ref={flipBook}
            book={book}
            pageWidth={spreadUnitWidth}
            activeIndex={pageIndex}
            onFlip={pageNavigation.handleBookFlip}
            onSelect={selectPage}
            onAddPage={addPageAndOpenPhotos}
            onTextEdit={openTextEditor}
            onCrop={()=>panels.openTool('photos')}
            onImageSelect={()=>panels.openTool('photos')}
            onBlankPage={()=>panels.openTool('photos')}
          />
          :pageIndex===0
            ?<EditorFlipBook
              ref={flipBook}
              book={book}
              pageWidth={spreadUnitWidth}
              activeIndex={0}
              interactionMode="single"
              onFlip={pageNavigation.handleBookFlip}
              onFlipState={pageNavigation.handleFlipState}
              onSelect={pageNavigation.navigateSinglePage}
              onAddPage={addPageAndOpenPhotos}
              onTextEdit={openTextEditor}
              onCrop={()=>panels.openTool('photos')}
              onImageSelect={()=>panels.openTool('photos')}
              onBlankPage={()=>panels.openTool('photos')}
            />
            :<div className="focused-book-shell single-page-editor-shell" style={{width:focusWindowWidth,height:pageHeight}}>
              <div ref={focusTrack} className="book-track focused-book-track single-page-flip-track" style={{width:pageCanvasWidth*2,height:pageHeight,transform:`translateX(${focusedShift}px)`}}>
                <EditorFlipBook
                  ref={flipBook}
                  book={book}
                  pageWidth={pageCanvasWidth}
                  activeIndex={pageIndex}
                  interactionMode="single"
                  onFlip={pageNavigation.handleBookFlip}
                  onFlipState={pageNavigation.handleFlipState}
                  onSelect={pageNavigation.navigateSinglePage}
                  onAddPage={addPageAndOpenPhotos}
                  onTextEdit={openTextEditor}
                  onCrop={()=>panels.openTool('photos')}
                  onImageSelect={()=>panels.openTool('photos')}
                  onBlankPage={()=>panels.openTool('photos')}
                />
              </div>
              {(neighborPage||showSingleAdd)&&<div className={`page-pan-zone ${visualReverse?'previous':'next'}`} style={{width:Math.max(72,pageCanvasWidth*.22)}} onPointerDown={event=>pageNavigation.startPan(visualReverse?'prev':'next',event)} onPointerMove={pageNavigation.movePan} onPointerUp={pageNavigation.endPan} onPointerCancel={pageNavigation.cancelPan} title={showSingleAdd?'拖动添加下一页':visualReverse?'拖动回到同一跨页左页':'拖动到同一跨页右页'}/>}
            </div>
        }
        {pageIndex===0&&<div className="cover-quick-actions editor-cover-actions" style={{top:`calc(50% + ${(zoomMode==='spread'||pageIndex===0?spreadUnitWidth:pageCanvasWidth)*PAGE_ASPECT_RATIO/2+28}px)`}}>
          <button onClick={()=>panels.toggleTool('cover')}><Images size={15}/>换个封面</button><i/><button onClick={()=>panels.toggleTool('background')}><Palette size={15}/>换个背景</button>
        </div>}
      </div>

      <EditorPreviewRail book={book} mode={zoomMode} flipBook={flipBook} onNavigatePage={pageNavigation.navigateSinglePage} onAddPage={addPageAndOpenPhotos} onRequestDelete={()=>setPageDeleteOpen(true)}/>
    </div>

    <nav className="editor-tools">{editorTools.map(([id,Icon,label])=>{
      const selectedTool=id==='photos'?(panels.photoSideOpen||panels.compactPanel==='photos'):id==='layouts'?(panels.templateSideOpen||panels.compactPanel==='layouts'):panels.compactPanel===id;
      return <button key={id} className={selectedTool?'selected':''} onClick={()=>panels.toggleTool(id)}><Icon size={21} strokeWidth={1.6}/><span>{label}</span></button>;
    })}</nav>

    {panels.photoSideOpen&&<EditorPanel key={`${page.id}:photos`} panel="photos" placement="left" paired={panels.bothSideOpen} photoIds={panels.photoDraft} onPhotoIdsChange={panels.setPhotoDraft} onPanel={panels.openTool} onClose={()=>{panels.setPhotoLibraryOpen(false);if(panels.panel==='photos')panels.setPanel(null);}}/>}
    {panels.templateSideOpen&&<EditorPanel key={`${page.id}:layouts`} panel="layouts" placement="right" paired={panels.bothSideOpen} photoIds={panels.photoDraft} onPhotoIdsChange={panels.setPhotoDraft} onPanel={panels.openTool} onClose={()=>{panels.setTemplateLibraryOpen(false);if(panels.panel==='layouts')panels.setPanel(null);}}/>}
    {panels.compactPanel&&(panels.compactPanel==='background'||panels.compactPanel==='page-background'
      ?<TextureBackgroundPanel key={`${page.id}:${panels.compactPanel}`} mode={panels.compactPanel==='background'?'workspace':'page'} onClose={()=>panels.setPanel(null)}/>
      :<EditorPanel key={`${page.id}:${panels.compactPanel}`} panel={page.type!=='cover'&&panels.compactPanel==='cover'?'layouts':panels.compactPanel} photoIds={panels.photoDraft} onPhotoIdsChange={panels.setPhotoDraft} onPanel={panels.openTool} onClose={panels.closeAllPanels}/>)}

    <PageDeleteDialog open={pageDeleteOpen&&pageIndex>0} pageIndex={pageIndex} onClose={()=>setPageDeleteOpen(false)} onConfirm={confirmPageDelete}/>
    <ExportDialog book={book} open={exporting} onClose={()=>setExporting(false)}/>
    <VersionHistoryDialog book={book} open={historyOpen} onClose={()=>setHistoryOpen(false)} onBeforeRestore={async()=>{await useEditor.getState().flush();}} onRestore={restored=>{useEditor.getState().load(restored);panels.closeAllPanels();}}/>
  </main>;
}
