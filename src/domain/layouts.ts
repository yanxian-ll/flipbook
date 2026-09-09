import {type Asset,type Page,type Book,type ThemeId,blankPage,imageElement,textElement,W,H} from './model';
import catalog from './templates/reference-layouts.json';
export interface Slot {x:number;y:number;width:number;height:number;shape?:'ellipse'}
export interface Layout {id:string;name:string;minImages:number;maxImages:number;slots:Slot[];family?:string;background?:string;overlay?:string;texts?:{x:number;y:number;width:number;height:number;key:string;text:string;fontFamily:string;fontSize:number;fontWeight:number;color:string;align:string;lineHeight:number;letterSpacing:number}[]}
export const layouts=catalog as Layout[];
const hidden=new Set(['empty','textOnly','quad4Zigzag','penta5Cascade','seven7Cascade','nineGrid','nine9GridNum','tpl2_p2_right','tpl2_p5_left']);
export function layoutsForTheme(theme:ThemeId):Layout[]{
  const family=theme==='scrapbook'?'tpl1':'tpl2';
  return layouts.filter(l=>!hidden.has(l.id)).sort((a,b)=>{
    const familyDiff=Number(b.family===family)-Number(a.family===family);
    if(familyDiff)return familyDiff;
    return a.slots.length-b.slots.length||a.name.localeCompare(b.name,'zh-CN');
  });
}
export function layoutsForCount(count:number,theme:ThemeId):Layout[]{
  return layoutsForTheme(theme).filter(l=>l.slots.length===count).sort((a,b)=>{
    if(count===6&&(a.id==='six6Sidebar'||b.id==='six6Sidebar'))return a.id==='six6Sidebar'?-1:1;
    return 0;
  });
}
export function fitAssetIds(ids:string[],slotCount:number):string[]{
  const source=ids.filter(Boolean);
  if(slotCount<=0||!source.length)return [];
  if(source.length>=slotCount)return source.slice(0,slotCount);
  return Array.from({length:slotCount},(_,i)=>source[i%source.length]);
}
export function defaultLayout(count:number):Layout {
  const ids=['empty','imagePadded','dualVertical','triRow','quadGrid','penta5Zigzag','six6Sidebar','seven7Scatter','eight8GridNum','nineGrid'];
  const layout=layouts.find(l=>l.id===ids[count]);if(!layout)throw new Error('每页最多放 9 张照片，请在下一页继续添加。');return layout;
}
export function frameIsFixed(page:Page,element:Page['elements'][number]){return element.type==='image'&&!element.freeImage&&(!!element.frameLocked||!!page.layoutId||page.type==='cover');}
export function applyLayout(page:Page,layout:Layout,assetIds?:string[]):Page {
  if(page.layoutId===layout.id&&!assetIds)return page;
  const oldImages=page.elements.filter(e=>e.type==='image');
  const sourceIds=assetIds??oldImages.map(e=>e.assetId!).filter(Boolean);
  const ids=fitAssetIds(sourceIds,layout.slots.length);
  const images=layout.slots.flatMap((slot,i)=>{
    const id=ids[i];if(!id)return [];
    return [imageElement(id,{id:oldImages[i]?.id??crypto.randomUUID(),x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape})];
  });
  const texts=(layout.texts??[]).map(t=>textElement(t.text,{x:t.x*W,y:t.y*H,width:Math.max(t.width*W,10),height:Math.max(t.height*H+4,10),fontSize:t.fontSize*W,fontFamily:t.fontFamily,fontWeight:t.fontWeight,color:t.color,align:t.align==='center'?'center':t.align==='right'?'right':'left',lineHeight:t.lineHeight,letterSpacing:t.letterSpacing*W/320,templateTextKey:t.key}));
  const background=page.layoutId?page.background:layout.background?.startsWith('rgba(')?'#ffffff':layout.background??page.background;
  return {...page,layoutId:layout.id,templateOverlay:layout.overlay,background,pattern:undefined,elements:[...images,...texts]};
}
export function autoLayout(book:Book,assets:Asset[]):Book {
  const pages:Page[]=[book.pages[0]];
  for(let i=0;i<assets.length;i+=2){const group=assets.slice(i,i+2);const page=applyLayout(blankPage(pages.length),defaultLayout(group.length),group.map(a=>a.id));pages.push(page);}
  return {...book,pages};
}
