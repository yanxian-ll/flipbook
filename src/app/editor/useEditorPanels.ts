import {useEffect,useState} from 'react';
import type {Book} from '../../domain/model';
import type {PanelId} from '../../panels/EditorPanel';
import {useEditor} from '../../store/editor';
import {DESKTOP_SIDE_LIBRARY_MIN_WIDTH} from './constants';

export function useEditorPanels({book,pageIndex,wide,viewWidth}:{book:Book|null;pageIndex:number;wide:boolean;viewWidth:number}){
  const [panel,setPanel]=useState<PanelId|null>(null);
  const [photoDraft,setPhotoDraft]=useState<string[]>([]);
  const [photoLibraryOpen,setPhotoLibraryOpen]=useState(false);
  const [templateLibraryOpen,setTemplateLibraryOpen]=useState(false);

  useEffect(()=>{
    const page=book?.pages[pageIndex];if(!page)return;
    setPhotoDraft([...new Set(page.elements.filter(element=>element.type==='image').map(element=>element.assetId).filter((id):id is string=>!!id))]);
  },[pageIndex,book?.pages[pageIndex]?.id]);

  const sideLibraries=wide&&viewWidth>=DESKTOP_SIDE_LIBRARY_MIN_WIDTH;
  function syncCoverPhotos(next:PanelId){
    const state=useEditor.getState(),currentPage=state.book?.pages[state.pageIndex];
    if(next==='photos'&&currentPage?.type==='cover')setPhotoDraft(currentPage.elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!));
  }
  function openTool(next:PanelId){
    syncCoverPhotos(next);
    if(sideLibraries&&next==='photos'){setPanel(null);setPhotoLibraryOpen(true);return;}
    if(sideLibraries&&next==='layouts'){setPanel(null);setTemplateLibraryOpen(true);return;}
    if(next!=='photos'&&next!=='layouts'){setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
    setPanel(next);
  }
  function toggleTool(next:PanelId){
    syncCoverPhotos(next);
    if(sideLibraries&&next==='photos'){setPanel(null);setPhotoLibraryOpen(open=>!open);return;}
    if(sideLibraries&&next==='layouts'){setPanel(null);setTemplateLibraryOpen(open=>!open);return;}
    if(next!=='photos'&&next!=='layouts'){setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
    setPanel(current=>current===next?null:next);
  }
  function closeAllPanels(){setPanel(null);setPhotoLibraryOpen(false);setTemplateLibraryOpen(false);}
  const photoSideOpen=sideLibraries&&(photoLibraryOpen||panel==='photos');
  const templateSideOpen=sideLibraries&&(templateLibraryOpen||panel==='layouts');
  const bothSideOpen=photoSideOpen&&templateSideOpen;
  const compactPanel=sideLibraries?(panel&&panel!=='photos'&&panel!=='layouts'?panel:null):(panel??(photoLibraryOpen?'photos':templateLibraryOpen?'layouts':null));
  return {panel,setPanel,photoDraft,setPhotoDraft,photoLibraryOpen,setPhotoLibraryOpen,templateLibraryOpen,setTemplateLibraryOpen,sideLibraries,photoSideOpen,templateSideOpen,bothSideOpen,compactPanel,openTool,toggleTool,closeAllPanels};
}
