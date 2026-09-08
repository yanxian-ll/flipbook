import {describe,it,expect,beforeEach} from 'vitest';
import 'fake-indexeddb/auto';
import {newBook,imageElement,type Asset} from './model';
import {autoLayout,layouts,applyLayout} from './layouts';
import {db,repository} from '../db/repository';
import {useEditor} from '../store/editor';
const assets:Asset[]=Array.from({length:10},(_,i)=>({id:`asset-${i}`,name:`photo-${i}.jpg`,width:1200,height:1600,mimeType:'image/jpeg',orientation:'portrait',storageKey:`asset-${i}`,createdAt:1}));
beforeEach(async()=>{await db.books.clear();await db.assets.clear();});
describe('automatic book generation',()=>{
  it('provides 29 valid templates',()=>{expect(layouts).toHaveLength(29);for(const l of layouts){expect(l.slots.length).toBe(l.minImages);for(const slot of l.slots){expect(slot.x).toBeGreaterThanOrEqual(0);expect(slot.y).toBeGreaterThanOrEqual(0);expect(slot.x+slot.width).toBeLessThanOrEqual(1.001);expect(slot.y+slot.height).toBeLessThanOrEqual(1.001);}}});
  it('distributes ten photos into five inner pages and a cover',()=>{const book=autoLayout(newBook('Test','scrapbook',assets),assets);expect(book.pages).toHaveLength(6);const used=book.pages.slice(1).flatMap(p=>p.elements.filter(e=>e.type==='image').map(e=>e.assetId));expect(used).toEqual(assets.map(a=>a.id));});
  it('changing a layout preserves overflow photos and text',()=>{const page=newBook('Test','scrapbook',assets).pages[0];page.elements.push(imageElement('second'));const result=applyLayout(page,layouts[0]);expect(result.elements.filter(e=>e.type==='image')).toHaveLength(2);expect(result.elements.find(e=>e.type==='text')?.text).toBe('TIME TO FLIPIN');});
});
describe('persistence and history',()=>{
  it('roundtrips book creation, rename and copy',async()=>{const book=autoLayout(newBook('Original','editorial',assets),assets);await repository.create(book,[]);await repository.rename(book.id,'Renamed');expect((await repository.get(book.id)).title).toBe('Renamed');const copy=await repository.duplicate(book.id);expect(copy.id).not.toBe(book.id);await repository.remove(copy.id);expect(await repository.list()).toHaveLength(1);});
  it('undo/redo restores transforms and saves the latest document',async()=>{const book=newBook('History','scrapbook',assets);await repository.save(book);useEditor.getState().load(book);const id=book.pages[0].elements[0].id;useEditor.getState().updateElement(id,{x:900,rotation:35});useEditor.getState().undo();expect(useEditor.getState().book!.pages[0].elements[0].x).toBe(414);useEditor.getState().redo();await useEditor.getState().flush();const persisted=await repository.get(book.id);expect(persisted.pages[0].elements[0].x).toBe(900);expect(persisted.pages[0].elements[0].rotation).toBe(35);expect(useEditor.getState().status).toBe('saved');});
  it('preserves cover when deleting/reordering and supports duplicate pages',async()=>{const book=autoLayout(newBook('Pages','scrapbook',assets),assets);useEditor.getState().load(book);useEditor.getState().removePage();expect(useEditor.getState().book!.pages).toHaveLength(6);useEditor.getState().setPage(1);useEditor.getState().duplicatePage();expect(useEditor.getState().book!.pages).toHaveLength(7);useEditor.getState().reorderPage(2,3);expect(useEditor.getState().book!.pages[0].id).toBe(book.coverPageId);await useEditor.getState().flush();});
});
