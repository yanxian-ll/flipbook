import {describe,it,expect,beforeEach} from 'vitest';
import 'fake-indexeddb/auto';
import {newBook,blankPage,textElement,W,H,backCoverFor,backCoverPage,bookStyleFor,type Asset} from './model';
import {autoLayout,layouts,layoutsForCount,applyLayout,defaultLayout} from './layouts';
import {db,repository} from '../db/repository';
import {useEditor} from '../store/editor';
const assets:Asset[]=Array.from({length:10},(_,i)=>({id:`asset-${i}`,name:`photo-${i}.jpg`,width:1200,height:1600,mimeType:'image/jpeg',orientation:'portrait',storageKey:`asset-${i}`,createdAt:1}));
beforeEach(async()=>{await db.books.clear();await db.assets.clear();});
describe('reference template catalog',()=>{
  it('covers all 54 non-cutout reference definitions and valid frames',()=>{expect(layouts).toHaveLength(54);for(const layout of layouts){expect(layout.slots).toHaveLength(layout.minImages);for(const s of layout.slots){expect(s.x).toBeGreaterThanOrEqual(0);expect(s.y).toBeGreaterThanOrEqual(0);expect(s.x+s.width).toBeLessThanOrEqual(1.001);expect(s.y+s.height).toBeLessThanOrEqual(1.001);}}});
  it('offers both style families with preferred style ordering',()=>{
    expect(Array.from({length:9},(_,i)=>layoutsForCount(i+1,'scrapbook').length)).toEqual([15,10,5,5,2,4,2,1,1]);
    expect(Array.from({length:9},(_,i)=>layoutsForCount(i+1,'editorial').length)).toEqual([15,10,5,5,2,4,2,1,1]);
    expect(layoutsForCount(6,'scrapbook').slice(0,2).map(l=>l.id)).toEqual(['six6Sidebar','tpl1_p3_left']);
    expect(layoutsForCount(2,'editorial')[0].id).toBe('tpl2_p3_left');
  });
  it('replaces template decorations, clears the previous page text, and never stacks overflow images',()=>{
    const ids=assets.slice(0,2).map(a=>a.id);const first=layouts.find(l=>l.id==='tpl1_p5_left')!;
    const page=applyLayout(blankPage(1),first,ids);page.elements.push(textElement('User note'));
    expect(page.templateOverlay).toContain('tpl1');expect(page.elements.filter(e=>e.type==='image').every(e=>e.frameShape==='ellipse')).toBe(true);
    const result=applyLayout(page,defaultLayout(2));expect(result.templateOverlay).toBeUndefined();expect(result.elements.filter(e=>e.type==='image').map(e=>e.assetId)).toEqual(ids);expect(result.elements.filter(e=>e.type==='text').map(e=>e.text)).toEqual([]);
    expect(applyLayout(result,defaultLayout(1)).elements.filter(e=>e.type==='image').map(e=>e.assetId)).toEqual([ids[0]]);
    expect(applyLayout(result,defaultLayout(3)).elements.filter(e=>e.type==='image').map(e=>e.assetId)).toEqual([ids[0],ids[1],ids[0]]);
    expect(()=>defaultLayout(10)).toThrow('最多放 9 张');
  });
  it('retains all photos during generation',()=>{const book=autoLayout(newBook('Test','scrapbook',assets),assets);expect(book.pages).toHaveLength(6);expect(book.pages.slice(1).flatMap(p=>p.elements.filter(e=>e.type==='image').map(e=>e.assetId))).toEqual(assets.map(a=>a.id));});
});
describe('fixed photo frames and persistence',()=>{
  it('ignores frame transforms but saves crop with undo and redo',async()=>{
    const book=autoLayout(newBook('History','scrapbook',assets),assets);useEditor.getState().load(book);useEditor.getState().setPage(1);const original=book.pages[1].elements[0];
    useEditor.getState().updateElement(original.id,{x:900,width:99,rotation:35,freeImage:true,crop:{x:.2,y:.7,zoom:2}});
    let photo=useEditor.getState().book!.pages[1].elements[0];expect([photo.x,photo.width,photo.rotation]).toEqual([original.x,original.width,0]);expect(photo.crop?.zoom).toBe(2);expect(photo.freeImage).toBeUndefined();
    useEditor.getState().undo();expect(useEditor.getState().book!.pages[1].elements[0].crop?.zoom).toBe(1);useEditor.getState().redo();await useEditor.getState().flush();photo=(await repository.get(book.id)).pages[1].elements[0];expect(photo.crop).toEqual({x:.2,y:.7,zoom:2});expect(photo.x).toBe(original.x);
  });
  it('replaces photos while retaining the current template and supports undo',async()=>{const book=autoLayout(newBook('Photos','scrapbook',assets),assets);useEditor.getState().load(book);useEditor.getState().setPage(1);useEditor.getState().setPhotos(assets.slice(0,8).reverse().map(a=>a.id));expect(useEditor.getState().book!.pages[1].layoutId).toBe('dualVertical');expect(useEditor.getState().book!.pages[1].elements.filter(e=>e.type==='image')).toHaveLength(2);expect(useEditor.getState().book!.pages[1].elements[0].assetId).toBe('asset-7');useEditor.getState().undo();expect(useEditor.getState().book!.pages[1].elements.filter(e=>e.type==='image')).toHaveLength(2);await useEditor.getState().flush();});
  it('reorders photos inside an active template without changing its geometry or crop',async()=>{const book=autoLayout(newBook('Order','scrapbook',assets),assets);useEditor.getState().load(book);useEditor.getState().setPage(1);const before=useEditor.getState().book!.pages[1].elements.filter(e=>e.type==='image').map(e=>({id:e.id,x:e.x,y:e.y,width:e.width,height:e.height,assetId:e.assetId}));useEditor.getState().updateElement(before[0].id,{crop:{x:.2,y:.7,zoom:1.8}});const current=useEditor.getState().book!.pages[1].elements.filter(e=>e.type==='image').map(e=>e.assetId!).reverse();useEditor.getState().setPhotos(current);const after=useEditor.getState().book!.pages[1].elements.filter(e=>e.type==='image');expect(after.map(e=>e.assetId)).toEqual(current);expect(after.map(e=>[e.x,e.y,e.width,e.height])).toEqual(before.map(e=>[e.x,e.y,e.width,e.height]));expect(after[0].crop).toEqual({x:.2,y:.7,zoom:1.8});expect(useEditor.getState().book!.pages[1].layoutId).toBe(book.pages[1].layoutId);await useEditor.getState().flush();});
  it('protects fixed images from duplicate and delete shortcuts',async()=>{const book=autoLayout(newBook('Frames','scrapbook',assets),assets);useEditor.getState().load(book);useEditor.getState().setPage(1);useEditor.getState().select(book.pages[1].elements[0].id);useEditor.getState().duplicateSelected();useEditor.getState().deleteSelected();expect(useEditor.getState().book!.pages[1].elements).toHaveLength(2);await useEditor.getState().flush();});
  it('saves manual templates and reapplies their fixed geometry',async()=>{const book=autoLayout(newBook('Custom','scrapbook',assets),assets);book.customLayouts=[{id:'custom-test',name:'Custom',minImages:2,maxImages:2,slots:[{x:.1,y:.1,width:.3,height:.2},{x:.6,y:.4,width:.2,height:.3}]}];useEditor.getState().load(book);useEditor.getState().setPage(1);useEditor.getState().layout('custom-test');await useEditor.getState().flush();const saved=await repository.get(book.id);expect(saved.customLayouts).toEqual(book.customLayouts);expect(saved.pages[1].elements[0]).toMatchObject({x:W*.1,y:H*.1,width:W*.3,height:H*.2,frameLocked:true});});
  it('roundtrips rename and duplication and preserves cover on page operations',async()=>{const book=autoLayout(newBook('Original','editorial',assets),assets);await repository.create(book,[]);await repository.rename(book.id,'Renamed');expect((await repository.get(book.id)).title).toBe('Renamed');const copy=await repository.duplicate(book.id);expect(copy.id).not.toBe(book.id);await repository.remove(copy.id);useEditor.getState().load(book);useEditor.getState().removePage();expect(useEditor.getState().book!.pages).toHaveLength(6);useEditor.getState().setPage(1);useEditor.getState().duplicatePage();expect(useEditor.getState().book!.pages).toHaveLength(7);useEditor.getState().reorderPage(2,3);expect(useEditor.getState().book!.pages[0].id).toBe(book.coverPageId);await useEditor.getState().flush();});
});

describe('book presentation settings',()=>{
  it('provides stable global style defaults for existing books',()=>{
    const book=newBook('Style','editorial',assets);
    expect(bookStyleFor(book)).toEqual({pageBackground:'#eeeae3',textColor:'#252525',fontFamily:'Domine'});
    delete book.bookStyle;
    expect(bookStyleFor(book)).toEqual({pageBackground:'#eeeae3',textColor:'#252525',fontFamily:'Domine'});
  });
  it('builds custom back-cover content without adding it to editable page order',()=>{
    const book=newBook('Back','editorial',assets);
    book.backCover={mode:'custom',background:'#ffffff',assetId:assets[1].id,crop:{x:.2,y:.7,zoom:1.4},text:'THE END',textColor:'#333333'};
    const page=backCoverPage(book);
    expect(backCoverFor(book).mode).toBe('custom');
    expect(page.background).toBe('#ffffff');
    expect(page.elements.find(element=>element.type==='image')).toMatchObject({assetId:assets[1].id,crop:{x:.2,y:.7,zoom:1.4}});
    expect(page.elements.find(element=>element.type==='text')).toMatchObject({text:'THE END',color:'#333333'});
    expect(book.pages).toHaveLength(1);
  });
});

describe('cover and workspace settings',()=>{
  it('adds a replacement to an empty basic cover using its template frame',async()=>{const book=newBook('Cover','scrapbook',assets);book.coverTemplate='basic';book.pages[0].elements=book.pages[0].elements.filter(e=>e.type!=='image');useEditor.getState().load(book);useEditor.getState().setPhotos([assets[2].id]);await useEditor.getState().flush();const saved=await repository.get(book.id);expect(saved.pages[0].elements.find(e=>e.type==='image')).toMatchObject({assetId:assets[2].id,x:80,y:100,width:1040,height:1300,frameLocked:true});});
  it('clears a deleted workspace image without changing cover or inner page colors',async()=>{const book=autoLayout(newBook('Workspace','scrapbook',assets),assets);book.workspaceImageId=assets[9].id;useEditor.getState().load(book);const cover=useEditor.getState().book!.pages[0].background,inner=useEditor.getState().book!.pages[1].background;await useEditor.getState().removeAssets([assets[9].id]);const saved=await repository.get(book.id);expect(saved.workspaceImageId).toBeUndefined();expect(saved.pages[0].background).toBe(cover);expect(saved.pages[1].background).toBe(inner);});
});
