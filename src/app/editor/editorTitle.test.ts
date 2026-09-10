import 'fake-indexeddb/auto';
import {describe,expect,it} from 'vitest';
import {newBook} from '../../domain/model';
import {useEditor} from '../../store/editor';
import {commitEditorTitle} from './editorTitle';

describe('editor title metadata',()=>{
  it('does not consume visual undo history',async()=>{
    const book=newBook('Original','editorial');
    useEditor.getState().load(book);
    const before=useEditor.getState().past.length;
    await commitEditorTitle('Renamed');
    expect(useEditor.getState().book?.title).toBe('Renamed');
    expect(useEditor.getState().past).toHaveLength(before);
  });

  it('keeps the current title across canvas undo and redo',async()=>{
    const book=newBook('Original','editorial');
    useEditor.getState().load(book);
    useEditor.getState().change(draft=>{draft.workspaceBackground='#ffffff';});
    useEditor.getState().undo();
    const past=useEditor.getState().past.length;
    const future=useEditor.getState().future.length;
    await commitEditorTitle('Renamed');
    expect(useEditor.getState().past).toHaveLength(past);
    expect(useEditor.getState().future).toHaveLength(future);
    useEditor.getState().redo();
    expect(useEditor.getState().book?.title).toBe('Renamed');
    await useEditor.getState().flush();
  });
});
