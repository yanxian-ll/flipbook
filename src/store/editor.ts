import {create} from 'zustand';
import {produce,current} from 'immer';
import {repository,friendlyError} from '../db/repository';
import {type Book,type Element,type StoredAsset,blankPage,uid} from '../domain/model';
import {assetMetadata} from '../domain/assets';
import {applyLayout,layouts,defaultLayout,frameIsFixed} from '../domain/layouts';
type Status='saved'|'saving'|'error';
interface EditorState {
  book:Book|null; pageIndex:number; selected:string[]; past:Book[]; future:Book[];
  status:Status; error:string; revision:number; clipboard:Element[];
  load:(book:Book)=>void; change:(recipe:(b:Book)=>void)=>void; select:(id:string|null,multi?:boolean)=>void;
  setPage:(index:number)=>void; updateElement:(id:string,patch:Partial<Element>)=>void;
  addElement:(element:Element)=>void; deleteSelected:()=>void; duplicateSelected:()=>void;
  copy:()=>void; paste:()=>void; undo:()=>void; redo:()=>void;
  addPage:()=>void; removePage:()=>void; duplicatePage:()=>void; reorderPage:(from:number,to:number)=>void;
  layout:(id:string)=>void; setPhotos:(ids:string[])=>void; addAssets:(assets:StoredAsset[])=>Promise<void>; flush:()=>Promise<void>;
}
let saveTimer:ReturnType<typeof setTimeout>|undefined;
let saveQueue:Promise<void>=Promise.resolve();
function schedule(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{void useEditor.getState().flush().catch(()=>{});},900);}
export const useEditor=create<EditorState>((set,get)=>({
  book:null,pageIndex:0,selected:[],past:[],future:[],status:'saved',error:'',revision:0,clipboard:[],
  load(book){clearTimeout(saveTimer);set({book,pageIndex:0,selected:[],past:[],future:[],status:'saved',error:'',revision:0});},
  change(recipe){const current=get().book;if(!current)return;const next=produce(current,draft=>{recipe(draft);draft.updatedAt=Date.now();});set(s=>({book:next,past:[...s.past.slice(-79),current],future:[],status:'saving',revision:s.revision+1}));schedule();},
  select(id,multi=false){set(s=>({selected:id?(multi?(s.selected.includes(id)?s.selected.filter(x=>x!==id):[...s.selected,id]):[id]):[]}));},
  setPage(index){set({pageIndex:Math.max(0,Math.min(index,(get().book?.pages.length??1)-1)),selected:[]});},
  updateElement(id,patch){get().change(b=>{const page=b.pages[get().pageIndex],e=page?.elements.find(e=>e.id===id);if(!e)return;if(frameIsFixed(page,e)){if(patch.assetId)e.assetId=patch.assetId;if(patch.crop)e.crop={x:Math.max(0,Math.min(1,patch.crop.x)),y:Math.max(0,Math.min(1,patch.crop.y)),zoom:Math.max(1,Math.min(4,patch.crop.zoom))};}else Object.assign(e,patch);});},
  addElement(element){get().change(b=>{b.pages[get().pageIndex].elements.push(element);});set({selected:[element.id]});},
  deleteSelected(){const selected=get().selected;if(!selected.length)return;get().change(b=>{const page=b.pages[get().pageIndex];page.elements=page.elements.filter(e=>!selected.includes(e.id)||e.locked||frameIsFixed(page,e));});set({selected:[]});},
  copy(){const s=get();set({clipboard:structuredClone(s.book?.pages[s.pageIndex].elements.filter(e=>s.selected.includes(e.id))??[])});},
  paste(){const items=get().clipboard.filter(e=>e.type!=='image').map(e=>({...e,id:uid(),x:e.x+30,y:e.y+30,templateTextKey:undefined}));if(!items.length)return;get().change(b=>{b.pages[get().pageIndex].elements.push(...items);});set({selected:items.map(e=>e.id)});},
  duplicateSelected(){get().copy();get().paste();},
  undo(){const s=get();if(!s.past.length||!s.book)return;set({book:s.past.at(-1)!,past:s.past.slice(0,-1),future:[s.book,...s.future],selected:[],status:'saving',pageIndex:Math.min(s.pageIndex,s.past.at(-1)!.pages.length-1),revision:s.revision+1});schedule();},
  redo(){const s=get();if(!s.future.length||!s.book)return;set({book:s.future[0],past:[...s.past,s.book],future:s.future.slice(1),selected:[],status:'saving',revision:s.revision+1});schedule();},
  addPage(){const index=get().pageIndex+1;get().change(b=>{b.pages.splice(index,0,blankPage(index));b.pages.forEach((p,i)=>p.order=i);});get().setPage(index);},
  removePage(){if(get().pageIndex===0)return;const index=get().pageIndex;get().change(b=>{b.pages.splice(index,1);b.pages.forEach((p,i)=>p.order=i);});get().setPage(index-1);},
  duplicatePage(){const index=get().pageIndex;if(index===0)return;get().change(b=>{const page=structuredClone(current(b.pages[index]));page.id=uid();page.elements=page.elements.map(e=>({...e,id:uid()}));b.pages.splice(index+1,0,page);b.pages.forEach((p,i)=>p.order=i);});get().setPage(index+1);},
  reorderPage(from,to){if(from===0||to===0||from===to)return;get().change(b=>{const [page]=b.pages.splice(from,1);b.pages.splice(to,0,page);b.pages.forEach((p,i)=>p.order=i);});get().setPage(to);},
  layout(id){const layout=[...layouts,...(get().book?.customLayouts??[])].find(l=>l.id===id);if(!layout)return;get().change(b=>{b.pages[get().pageIndex]=applyLayout(b.pages[get().pageIndex],layout);});set({selected:[]});},
  setPhotos(ids){const layout=defaultLayout(ids.length);get().change(b=>{const page=b.pages[get().pageIndex];if(page.type==='cover'){const image=page.elements.find(e=>e.type==='image');if(ids[0]){if(image){image.assetId=ids[0];image.crop={x:.5,y:.5,zoom:1};}else page.elements.unshift({id:uid(),type:'image',assetId:ids[0],x:414,y:360,width:372,height:498,rotation:0,opacity:1,frameLocked:true,crop:{x:.5,y:.5,zoom:1}});}return;}b.pages[get().pageIndex]=applyLayout(page,layout,ids);});set({selected:[]});},
  async addAssets(assets){await repository.putAssets(assets);get().change(b=>{b.assets.push(...assets.map(assetMetadata));});},
  async flush(){clearTimeout(saveTimer);const s=get();if(!s.book||s.status==='saved')return;const book=structuredClone(s.book),revision=s.revision;const task=saveQueue.catch(()=>{}).then(()=>repository.save(book));saveQueue=task;try{await task;if(get().book?.id===book.id&&get().revision===revision)set({status:'saved',error:''});}catch(e){set({status:'error',error:friendlyError(e)});throw e;}}
}));

