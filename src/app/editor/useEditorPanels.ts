import {useEffect,useRef,useState} from 'react';
import type {Book} from '../../domain/model';
import type {PanelId} from '../../panels/EditorPanel';
import {useEditor} from '../../store/editor';
import {DESKTOP_SIDE_LIBRARY_MIN_WIDTH} from './constants';

export function useEditorPanels({book,pageIndex,wide,viewWidth}:{book:Book|null;pageIndex:number;wide:boolean;viewWidth:number}){
  const [panel,setPanel]=useState<PanelId|null>(null);
  const [photoDraft,setPhotoDraft]=useState<string[]>([]);
  const [photoLibraryOpen,setPhotoLibraryOpen]=useState(false);
  const [templateLibraryOpen,setTemplateLibraryOpen]=useState(false);
  const autoOpenedBook=useRef<string|null>(null);

  useEffect(()=>{
    const page=book?.pages[pageIndex];if(!page)return;
    setPhotoDraft([...new Set(page.elements.filter(element=>element.type==='image').map(element=>element.assetId).filter((id):id is string=>!!id))]);
  },[pageIndex,book?.pages[pageIndex]?.id]);

  const sideLibraries=wide&&viewWidth>=DESKTOP_SIDE_LIBRARY_MIN_WIDTH;
  useEffect(()=>{
    if(!book||!sideLibraries||autoOpenedBook.current===book.id)return;
    let shouldOpen=false;
    try{
      const key=`flipbook:auto-open-libraries:${book.id}`;
      shouldOpen=sessionStorage.getItem(key)==='1';
      if(shouldOpen)sessionStorage.removeItem(key);
    }catch{}
    if(!shouldOpen)return;
    autoOpenedBook.current=book.id;
    setPanel(null);
    setPhotoLibraryOpen(true);
    setTemplateLibraryOpen(true);
  },[book?.id,sideLibraries]);

  useEffect(()=>{
    if(!wide||(panel!=='page-background'&&panel!=='background'))return;
    const root=document.querySelector<HTMLElement>('.studio.expanded');
    if(!root)return;
    const panelNode=root.querySelector<HTMLElement>(':scope > .editor-panel.texture-background-panel');
    const header=panelNode?.querySelector<HTMLElement>('header');
    const spread=root.querySelector<HTMLElement>('.spread-area');
    if(!panelNode||!header||!spread)return;

    panelNode.classList.add('draggable-texture-panel');
    const previousTitle=header.getAttribute('title');
    header.setAttribute('title',panel==='background'?'拖动垫底背景窗口':'拖动底纹窗口');
    let offsetX=0,offsetY=0;
    let drag:null|{pointerId:number;startX:number;startY:number;baseX:number;baseY:number;minX:number;maxX:number;minY:number;maxY:number}=null;
    const clamp=(value:number,min:number,max:number)=>Math.min(Math.max(value,Math.min(min,max)),Math.max(min,max));
    const reset=()=>{offsetX=0;offsetY=0;panelNode.style.transform='';panelNode.classList.remove('is-dragging');drag=null;};
    const pointerDown=(event:PointerEvent)=>{
      if(event.button!==0||!spread.classList.contains('zoom-spread'))return;
      const target=event.target as HTMLElement;
      if(target.closest('button,a,input,select,textarea,label'))return;
      event.preventDefault();
      const rootRect=root.getBoundingClientRect(),panelRect=panelNode.getBoundingClientRect();
      const baseX=offsetX,baseY=offsetY;
      drag={
        pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,baseX,baseY,
        minX:baseX+(rootRect.left+12-panelRect.left),
        maxX:baseX+(rootRect.right-12-panelRect.right),
        minY:baseY+(rootRect.top+70-panelRect.top),
        maxY:baseY+(rootRect.bottom-86-panelRect.bottom),
      };
      panelNode.classList.add('is-dragging');
    };
    const pointerMove=(event:PointerEvent)=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      event.preventDefault();
      offsetX=clamp(drag.baseX+event.clientX-drag.startX,drag.minX,drag.maxX);
      offsetY=clamp(drag.baseY+event.clientY-drag.startY,drag.minY,drag.maxY);
      panelNode.style.transform=`translateX(calc(-50% + ${offsetX}px)) translateY(${offsetY}px)`;
    };
    const pointerEnd=(event:PointerEvent)=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      drag=null;
      panelNode.classList.remove('is-dragging');
    };
    const observer=new MutationObserver(()=>{if(!spread.classList.contains('zoom-spread'))reset();});
    observer.observe(spread,{attributes:true,attributeFilter:['class']});
    header.addEventListener('pointerdown',pointerDown);
    window.addEventListener('pointermove',pointerMove);
    window.addEventListener('pointerup',pointerEnd);
    window.addEventListener('pointercancel',pointerEnd);
    return()=>{
      observer.disconnect();
      header.removeEventListener('pointerdown',pointerDown);
      window.removeEventListener('pointermove',pointerMove);
      window.removeEventListener('pointerup',pointerEnd);
      window.removeEventListener('pointercancel',pointerEnd);
      panelNode.style.transform='';
      panelNode.classList.remove('draggable-texture-panel','is-dragging');
      if(previousTitle===null)header.removeAttribute('title');else header.setAttribute('title',previousTitle);
    };
  },[wide,panel,viewWidth]);

  function syncCoverPhotos(next:PanelId){
    const state=useEditor.getState(),currentPage=state.book?.pages[state.pageIndex];
    if(next==='photos'&&currentPage?.type==='cover')setPhotoDraft(currentPage.elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!));
  }
  function openTool(next:PanelId){
    syncCoverPhotos(next);
    if(sideLibraries&&next==='photos'){setPanel(null);setPhotoLibraryOpen(true);return;}
    if(sideLibraries&&next==='layouts'){setPanel(null);setTemplateLibraryOpen(true);return;}
    const floatingTexture=next==='page-background'||next==='background';
    if(next!=='photos'&&next!=='layouts'&&!floatingTexture){setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
    setPanel(next);
  }
  function toggleTool(next:PanelId){
    syncCoverPhotos(next);
    if(sideLibraries&&next==='photos'){setPanel(null);setPhotoLibraryOpen(open=>!open);return;}
    if(sideLibraries&&next==='layouts'){setPanel(null);setTemplateLibraryOpen(open=>!open);return;}
    const floatingTexture=next==='page-background'||next==='background';
    if(next!=='photos'&&next!=='layouts'&&!floatingTexture){setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
    setPanel(current=>current===next?null:next);
  }
  function closeAllPanels(){setPanel(null);setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
  const photoSideOpen=sideLibraries&&(photoLibraryOpen||panel==='photos');
  const templateSideOpen=sideLibraries&&(templateLibraryOpen||panel==='layouts');
  const bothSideOpen=photoSideOpen&&templateSideOpen;
  const compactPanel=sideLibraries?(panel&&panel!=='photos'&&panel!=='layouts'?panel:null):(panel??(photoLibraryOpen?'photos':templateLibraryOpen?'layouts':null));
  return {panel,setPanel,photoDraft,setPhotoDraft,photoLibraryOpen,setPhotoLibraryOpen,templateLibraryOpen,setTemplateLibraryOpen,sideLibraries,photoSideOpen,templateSideOpen,bothSideOpen,compactPanel,openTool,toggleTool,closeAllPanels};
}
