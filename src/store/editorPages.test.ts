import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {blankPage,newBook} from '../domain/model';
import {useEditor} from './editor';

function bookWithPages(count:number){
  const book=newBook('Pages','editorial');
  for(let index=1;index<=count;index++)book.pages.push(blankPage(index));
  return book;
}

describe('editor preview page selection',()=>{
  it('keeps the active edit page while ctrl-selecting other preview pages',()=>{
    const book=bookWithPages(4);
    useEditor.getState().load(book);
    useEditor.getState().setPage(2);

    useEditor.getState().selectPreviewPage(4,true);
    expect(useEditor.getState().pageIndex).toBe(2);
    expect(useEditor.getState().selectedPages).toEqual([book.pages[2].id,book.pages[4].id]);

    useEditor.getState().selectPreviewPage(4,true);
    expect(useEditor.getState().selectedPages).toEqual([book.pages[2].id]);
  });

  it('deletes selected pages as one undoable edit and never removes the cover',()=>{
    const book=bookWithPages(5);
    const removedIds=[book.pages[2].id,book.pages[4].id];
    useEditor.getState().load(book);
    useEditor.getState().setPage(2);
    useEditor.getState().selectPreviewPage(4,true);
    const historyBefore=useEditor.getState().past.length;

    useEditor.getState().removePage();

    const state=useEditor.getState();
    expect(state.book?.pages.some(page=>removedIds.includes(page.id))).toBe(false);
    expect(state.book?.pages[0].id).toBe(book.pages[0].id);
    expect(state.past).toHaveLength(historyBefore+1);
    expect(state.selectedPages).toEqual([book.pages[1].id]);

    state.undo();
    expect(useEditor.getState().book?.pages).toHaveLength(book.pages.length);
  });
});
