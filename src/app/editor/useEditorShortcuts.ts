import {useEffect,useRef} from 'react';
import {frameIsFixed} from '../../domain/layouts';
import {copyBackCoverElements,deleteBackCoverElements,pasteBackCoverElements,updateBackCoverElement} from '../../domain/backCoverElements';
import {useCoverContext} from '../../store/coverContext';
import {useEditor} from '../../store/editor';

export function useEditorShortcuts(onEscape:()=>void){
  const escapeRef=useRef(onEscape);
  escapeRef.current=onEscape;

  useEffect(()=>{
    function keydown(event:KeyboardEvent){
      const target=event.target as HTMLElement|null;
      if(target?.closest('input,textarea,select,[contenteditable=true]')||document.querySelector('[role=dialog]'))return;

      const state=useEditor.getState();
      const editingBack=useCoverContext.getState().side==='back';
      const mod=event.ctrlKey||event.metaKey;
      const key=event.key.toLowerCase();

      if(mod&&key==='z'){
        event.preventDefault();
        if(event.shiftKey)state.redo();else state.undo();
        return;
      }
      if(mod&&['c','v','d'].includes(key)){
        event.preventDefault();
        if(!editingBack){
          if(key==='c')state.copy();
          if(key==='v')state.paste();
          if(key==='d')state.duplicateSelected();
          return;
        }
        if(!state.book)return;
        if(key==='c'){
          useEditor.setState({clipboard:copyBackCoverElements(state.book,state.selected)});
          return;
        }
        const source=key==='d'?copyBackCoverElements(state.book,state.selected):state.clipboard;
        if(!source.length)return;
        let pastedIds:string[]=[];
        state.change(book=>{pastedIds=pasteBackCoverElements(book,source).map(element=>element.id);});
        useEditor.setState({selected:pastedIds});
        return;
      }
      if(key==='delete'||key==='backspace'){
        event.preventDefault();
        if(state.selected.length){
          if(editingBack){
            state.change(book=>deleteBackCoverElements(book,state.selected));
            state.select(null);
          }else state.deleteSelected();
          return;
        }
        if(!editingBack)document.querySelector<HTMLButtonElement>('[data-page-delete-trigger]')?.click();
        return;
      }
      if(key==='escape'){
        state.select(null);
        escapeRef.current();
        return;
      }
      if(event.key.startsWith('Arrow')&&state.selected.length){
        event.preventDefault();
        const distance=event.shiftKey?10:1;
        if(editingBack){
          state.change(book=>{
            const selected=new Set(state.selected);
            for(const element of book.backCover?.elements??[]){
              if(!selected.has(element.id)||element.locked)continue;
              updateBackCoverElement(book,element.id,{
                x:element.x+(event.key==='ArrowLeft'?-distance:event.key==='ArrowRight'?distance:0),
                y:element.y+(event.key==='ArrowUp'?-distance:event.key==='ArrowDown'?distance:0),
              });
            }
          });
          return;
        }
        state.change(book=>{
          const page=book.pages[state.pageIndex];
          for(const element of page.elements){
            if(!state.selected.includes(element.id)||element.locked||frameIsFixed(page,element))continue;
            element.x+=event.key==='ArrowLeft'?-distance:event.key==='ArrowRight'?distance:0;
            element.y+=event.key==='ArrowUp'?-distance:event.key==='ArrowDown'?distance:0;
          }
        });
      }
    }

    function beforeUnload(event:BeforeUnloadEvent){
      if(useEditor.getState().status==='saved')return;
      void useEditor.getState().flush().catch(()=>{});
      event.preventDefault();
    }
    function visibilityChange(){
      if(document.visibilityState==='hidden')void useEditor.getState().flush().catch(()=>{});
    }

    window.addEventListener('keydown',keydown);
    window.addEventListener('beforeunload',beforeUnload);
    document.addEventListener('visibilitychange',visibilityChange);
    return()=>{
      window.removeEventListener('keydown',keydown);
      window.removeEventListener('beforeunload',beforeUnload);
      document.removeEventListener('visibilitychange',visibilityChange);
    };
  },[]);
}
