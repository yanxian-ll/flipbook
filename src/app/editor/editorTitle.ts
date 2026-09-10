import {produce} from 'immer';
import {useEditor} from '../../store/editor';
import type {Book} from '../../domain/model';

function withTitle(book:Book,title:string){
  if(book.title===title)return book;
  return produce(book,draft=>{draft.title=title;});
}

/**
 * Book titles are metadata, not canvas edits. Commit them without adding an
 * entry to the visual undo stack, and keep existing undo/redo snapshots on the
 * same title so later canvas undo/redo cannot resurrect an older name.
 */
export async function commitEditorTitle(rawTitle:string){
  const state=useEditor.getState();
  const current=state.book;
  if(!current)return;
  const title=rawTitle.trim();
  if(!title||title===current.title)return;
  const updatedAt=Date.now();
  useEditor.setState(previous=>{
    if(!previous.book)return {};
    return {
      book:produce(previous.book,draft=>{draft.title=title;draft.updatedAt=updatedAt;}),
      past:previous.past.map(book=>withTitle(book,title)),
      future:previous.future.map(book=>withTitle(book,title)),
      status:'saving',
      error:'',
      revision:previous.revision+1,
    };
  });
  await useEditor.getState().flush();
}
