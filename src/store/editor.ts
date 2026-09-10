import {create} from 'zustand';
import {produce,current} from 'immer';
import {repository,friendlyError} from '../db/repository';
import {type Book,type Element,type StoredAsset,blankPage,imageElement,textElement,uid,W,H} from '../domain/model';
import {assetMetadata} from '../domain/assets';
import {applyLayout,layouts,defaultLayout,fitAssetIds,frameIsFixed,isSinglePhotoTemplateCaption,singlePhotoTemplateCaption} from '../domain/layouts';
type Status='saved'|'saving'|'error';
interface EditorState {
  book:Book|null; pageIndex:number; selected:string[]; selectedPages:string[]; past:Book[]; future:Book[];
  status:Status; error:string; revision:number; clipboard:Element[];
  load:(book:Book)=>void; change:(recipe:(b:Book)=>void)=>void; select:(id:string|null,multi?:boolean)=>void;
  setPage:(index:number)=>void; selectPreviewPage:(index:number,multi?:boolean)=>void; updateElement:(id:string,patch:Partial<Element>)=>void;
  addElement:(element:Element)=>void; deleteSelected:()=>void; duplicateSelected:()=>void;
  copy:()=>void; paste:()=>void; undo:()=>void; redo:()=>void;
  addPage:()=>void; removePage:()=>void; removePages:(pageIds:string[])=>void; duplicatePage:()=>void; reorderPage:(from:number,to:number)=>void; reorderSpread:(fromStart:number,toStart:number)=>void;
  layout:(id:string,assetIds?:string[])=>void; setPhotos:(ids:string[])=>void; addAssets:(assets:StoredAsset[])=>Promise<void>; removeAssets:(ids:string[])=>Promise<void>; flush:()=>Promise<void>;
}
let saveTimer:ReturnType<typeof setTimeout>|undefined;
let saveQueue:Promise<void>=Promise.resolve();
function schedule(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{void useEditor.getState().flush().catch(()=>{});},900);}
function checkpoint(book:Book|null,reason:string){if(book)void repository.createSnapshot(book,reason).catch(()=>{});}
export const useEditor=create<EditorState>((set,get)=>({
  book:null,pageIndex:0,selected:[],selectedPages:[],past:[],future:[],status:'saved',error:'',revision:0,clipboard:[],
  load(book){
    clearTimeout(saveTimer);
    const normalized=structuredClone(book);
    normalized.defaultPageBackground??=normalized.pages.find(page=>page.type==='normal'&&!page.layoutId)?.background??'#eeeae3';
    let migratedTemplateTexts=false;
    for(const page of normalized.pages){
      if(page.type!=='normal'||!page.layoutId)continue;
      const layout=[...layouts,...(normalized.customLayouts??[])].find(item=>item.id===page.layoutId);
      if(!page.templateBackground){
        const templateBg=layout?.background?.startsWith('rgba(')?'#ffffff':layout?.background;
        if(templateBg&&page.background===templateBg){
          page.background=normalized.defaultPageBackground;
          page.templateBackground=templateBg;
        }
      }
      for(const text of layout?.texts??[]){
        if(page.elements.some(element=>element.type==='text'&&element.templateTextKey===text.key))continue;
        page.elements.push(textElement(text.text,{
          x:text.x*W,y:text.y*H,width:Math.max(text.width*W,10),height:Math.max(text.height*H+4,10),
          fontSize:text.fontSize*W,fontFamily:text.fontFamily,fontWeight:text.fontWeight,fontStyle:text.fontStyle,
          color:text.color,align:text.align==='center'?'center':text.align==='right'?'right':'left',
          lineHeight:text.lineHeight,letterSpacing:text.letterSpacing*W/320,templateTextKey:text.key
        }));
        migratedTemplateTexts=true;
      }
    }
    set({book:normalized,pageIndex:0,selected:[],selectedPages:normalized.pages[0]?[normalized.pages[0].id]:[],past:[],future:[],status:migratedTemplateTexts?'saving':'saved',error:'',revision:migratedTemplateTexts?1:0});
    if(migratedTemplateTexts)schedule();
  },
  change(recipe){const current=get().book;if(!current)return;const next=produce(current,draft=>{recipe(draft);draft.updatedAt=Date.now();});set(s=>({book:next,past:[...s.past.slice(-79),current],future:[],status:'saving',revision:s.revision+1}));schedule();},
  select(id,multi=false){set(s=>({selected:id?(multi?(s.selected.includes(id)?s.selected.filter(x=>x!==id):[...s.selected,id]):[id]):[]}));},
  setPage(index){
    const book=get().book;
    const pageIndex=Math.max(0,Math.min(index,(book?.pages.length??1)-1));
    const pageId=book?.pages[pageIndex]?.id;
    set({pageIndex,selected:[],selectedPages:pageId?[pageId]:[]});
  },
  selectPreviewPage(index,multi=false){
    const state=get(),book=state.book;
    if(!book?.pages.length)return;
    const pageIndex=Math.max(0,Math.min(index,book.pages.length-1));
    const pageId=book.pages[pageIndex].id;
    if(!multi||pageIndex===0){
      set({pageIndex,selected:[],selectedPages:[pageId]});
      return;
    }
    const contentIds=new Set(book.pages.slice(1).map(page=>page.id));
    const activeId=book.pages[state.pageIndex]?.id;
    const selectedPages=[...new Set(state.selectedPages.filter(id=>contentIds.has(id)))];
    if(activeId&&contentIds.has(activeId)&&!selectedPages.includes(activeId))selectedPages.unshift(activeId);
    if(pageId===activeId){set({selected:[]});return;}
    if(selectedPages.includes(pageId)){
      set({selected:[],selectedPages:selectedPages.filter(id=>id!==pageId)});
      return;
    }
    set({selected:[],selectedPages:[...selectedPages,pageId]});
  },
  updateElement(id,patch){get().change(b=>{const page=b.pages[get().pageIndex],e=page?.elements.find(e=>e.id===id);if(!e)return;if(frameIsFixed(page,e)){if(patch.assetId)e.assetId=patch.assetId;if(patch.crop)e.crop={x:Math.max(0,Math.min(1,patch.crop.x)),y:Math.max(0,Math.min(1,patch.crop.y)),zoom:Math.max(1,Math.min(4,patch.crop.zoom))};}else Object.assign(e,patch);});},
  addElement(element){get().change(b=>{b.pages[get().pageIndex].elements.push(element);});set({selected:[element.id]});},
  deleteSelected(){const selected=get().selected;if(!selected.length)return;get().change(b=>{const page=b.pages[get().pageIndex];page.elements=page.elements.filter(e=>!selected.includes(e.id)||e.locked||frameIsFixed(page,e));});set({selected:[]});},
  copy(){const s=get();set({clipboard:structuredClone(s.book?.pages[s.pageIndex].elements.filter(e=>s.selected.includes(e.id))??[])});},
  paste(){const items=get().clipboard.filter(e=>e.type!=='image').map(e=>({...e,id:uid(),x:e.x+30,y:e.y+30,templateTextKey:undefined}));if(!items.length)return;get().change(b=>{b.pages[get().pageIndex].elements.push(...items);});set({selected:items.map(e=>e.id)});},
  duplicateSelected(){get().copy();get().paste();},
  undo(){const s=get();if(!s.past.length||!s.book)return;const previous=s.past.at(-1)!;const pageIndex=Math.min(s.pageIndex,previous.pages.length-1);set({book:previous,past:s.past.slice(0,-1),future:[s.book,...s.future],selected:[],selectedPages:previous.pages[pageIndex]?[previous.pages[pageIndex].id]:[],status:'saving',pageIndex,revision:s.revision+1});schedule();},
  redo(){const s=get();if(!s.future.length||!s.book)return;const next=s.future[0];const pageIndex=Math.min(s.pageIndex,next.pages.length-1);set({book:next,past:[...s.past,s.book],future:s.future.slice(1),selected:[],selectedPages:next.pages[pageIndex]?[next.pages[pageIndex].id]:[],status:'saving',pageIndex,revision:s.revision+1});schedule();},
  addPage(){
    const index=get().pageIndex+1;
    get().change(b=>{
      const background=b.defaultPageBackground??'#eeeae3';
      b.defaultPageBackground=background;
      b.pages.splice(index,0,blankPage(index,background));
      b.pages.forEach((p,i)=>p.order=i);
    });
    get().setPage(index);
  },
  removePage(){
    const state=get(),book=state.book;
    if(!book||state.pageIndex===0)return;
    const selectedPages=state.selectedPages.filter(id=>book.pages.findIndex(page=>page.id===id)>0);
    get().removePages(selectedPages.length?selectedPages:[book.pages[state.pageIndex].id]);
  },
  removePages(pageIds){
    const state=get(),book=state.book;
    if(!book)return;
    const removableIds=new Set(book.pages.slice(1).map(page=>page.id));
    const removeSet=new Set(pageIds.filter(id=>removableIds.has(id)));
    if(!removeSet.size)return;
    const activeIndex=state.pageIndex,activeId=book.pages[activeIndex]?.id;
    let fallbackId:string|undefined=activeId;
    if(!fallbackId||removeSet.has(fallbackId)){
      fallbackId=undefined;
      for(let index=activeIndex-1;index>=0;index--){
        const id=book.pages[index]?.id;
        if(id&&!removeSet.has(id)){fallbackId=id;break;}
      }
      if(!fallbackId){
        for(let index=activeIndex+1;index<book.pages.length;index++){
          const id=book.pages[index]?.id;
          if(id&&!removeSet.has(id)){fallbackId=id;break;}
        }
      }
    }
    checkpoint(book,removeSet.size>1?'删除多个页面前':'删除页面前');
    get().change(b=>{
      b.pages=b.pages.filter((page,index)=>index===0||!removeSet.has(page.id));
      b.pages.forEach((page,index)=>page.order=index);
    });
    const next=get().book;
    if(!next)return;
    let nextIndex=fallbackId?next.pages.findIndex(page=>page.id===fallbackId):-1;
    if(nextIndex<0)nextIndex=Math.max(0,Math.min(activeIndex-1,next.pages.length-1));
    get().setPage(nextIndex);
  },
  duplicatePage(){const index=get().pageIndex;if(index===0)return;get().change(b=>{const page=structuredClone(current(b.pages[index]));page.id=uid();page.elements=page.elements.map(e=>({...e,id:uid()}));b.pages.splice(index+1,0,page);b.pages.forEach((p,i)=>p.order=i);});get().setPage(index+1);},
  reorderPage(from,to){if(from===0||to===0||from===to)return;checkpoint(get().book,'调整页面顺序前');get().change(b=>{const [page]=b.pages.splice(from,1);b.pages.splice(to,0,page);b.pages.forEach((p,i)=>p.order=i);});get().setPage(to);},
  reorderSpread(fromStart,toStart){
    if(fromStart<1||toStart<1||fromStart===toStart)return;
    const book=get().book;if(!book)return;
    const groupCount=Math.ceil(Math.max(0,book.pages.length-1)/2);
    const fromGroup=Math.max(0,Math.min(groupCount-1,Math.floor((fromStart-1)/2)));
    const toGroup=Math.max(0,Math.min(groupCount-1,Math.floor((toStart-1)/2)));
    if(fromGroup===toGroup)return;
    checkpoint(book,'调整跨页顺序前');
    get().change(b=>{
      const content=b.pages.slice(1);
      const groups=[] as typeof content[];
      for(let i=0;i<content.length;i+=2)groups.push(content.slice(i,i+2));
      const [moved]=groups.splice(fromGroup,1);
      groups.splice(toGroup,0,moved);
      b.pages.splice(1,b.pages.length-1,...groups.flat());
      b.pages.forEach((p,i)=>p.order=i);
    });
    get().setPage(1+toGroup*2);
  },
  layout(id,assetIds){const layout=[...layouts,...(get().book?.customLayouts??[])].find(l=>l.id===id);if(!layout)return;checkpoint(get().book,'应用排版前');get().change(b=>{b.pages[get().pageIndex]=applyLayout(b.pages[get().pageIndex],layout,assetIds);});set({selected:[]});},
  setPhotos(ids){
    get().change(b=>{
      const page=b.pages[get().pageIndex];
      if(page.type==='cover'){
        const image=page.elements.find(e=>e.type==='image');
        if(!ids[0]){
          page.elements=page.elements.filter(e=>e.type!=='image');
          return;
        }
        if(image){
          if(image.assetId!==ids[0])image.assetId=ids[0];
        }else{
          const custom=b.customCoverTemplates?.find(template=>template.id===b.coverTemplate);
          const slot=custom?.slot??(b.coverTemplate==='basic'
            ?{x:80/W,y:100/H,width:1040/W,height:1300/H}
            :{x:414/W,y:360/H,width:372/W,height:498/H});
          page.elements.unshift(imageElement(ids[0],{x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape}));
        }
        return;
      }

      if(page.layoutId){
        const layout=[...layouts,...(b.customLayouts??[])].find(item=>item.id===page.layoutId);
        const existingFrames=page.elements.filter(element=>element.type==='image'&&!element.freeImage);
        const targetCount=layout?.slots.length??existingFrames.length;
        const fitted=fitAssetIds(ids,targetCount);
        const frames=fitted.map((assetId,index)=>{
          const existing=existingFrames[index];
          if(existing){
            existing.assetId=assetId;
            return existing;
          }
          const slot=layout?.slots[index];
          return slot
            ?imageElement(assetId,{x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape})
            :imageElement(assetId,{frameLocked:true});
        });
        const nonTemplateElements=page.elements.filter(element=>element.type!=='image'||element.freeImage);
        page.elements=[...frames,...nonTemplateElements];
        if(page.layoutId==='tpl2_p3_right'&&fitted[0]){
          const caption=page.elements.find(element=>element.type==='text'&&element.templateTextKey==='caption');
          if(caption&&isSinglePhotoTemplateCaption(caption.text??''))caption.text=singlePhotoTemplateCaption(fitted[0],page.id);
        }
        return;
      }

      const layout=defaultLayout(ids.length);
      b.pages[get().pageIndex]=applyLayout(page,layout,ids);
    });
    set({selected:[]});
  },
  async addAssets(assets){await repository.putAssets(assets);get().change(b=>{b.assets.push(...assets.map(assetMetadata));});},
  async removeAssets(ids){
    const currentBook=get().book;
    if(!currentBook)return;
    const removing=[...new Set(ids)].filter(id=>currentBook.assets.some(asset=>asset.id===id));
    if(!removing.length)return;
    checkpoint(currentBook,'删除素材前');
    clearTimeout(saveTimer);
    const removeSet=new Set(removing);
    const next=produce(currentBook,draft=>{
      draft.assets=draft.assets.filter(asset=>!removeSet.has(asset.id));
      if(draft.workspaceImageId&&removeSet.has(draft.workspaceImageId))draft.workspaceImageId=undefined;
      if(draft.backCover?.assetId&&removeSet.has(draft.backCover.assetId)){
        draft.backCover.assetId=undefined;
        draft.backCover.crop={x:.5,y:.5,zoom:1};
      }
      for(const page of draft.pages){
        page.elements=page.elements.filter(element=>!(element.type==='image'&&element.assetId&&removeSet.has(element.assetId)));
      }
      draft.updatedAt=Date.now();
    });
    set(s=>({book:next,selected:[],past:[],future:[],status:'saving',error:'',revision:s.revision+1}));
    await get().flush();
    await repository.removeAssets(removing);
  },
  async flush(){clearTimeout(saveTimer);const s=get();if(!s.book||s.status==='saved')return;const book=structuredClone(s.book),revision=s.revision;const task=saveQueue.catch(()=>{}).then(()=>repository.save(book));saveQueue=task;try{await task;if(get().book?.id===book.id&&get().revision===revision)set({status:'saved',error:''});}catch(e){set({status:'error',error:friendlyError(e)});throw e;}}
}));
