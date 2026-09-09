import {type Asset,type Page,type Book,type ThemeId,blankPage,imageElement,textElement,W,H} from './model';
import catalog from './templates/reference-layouts.json';
import overlayTexts from './templates/overlay-texts.json';
export interface Slot {x:number;y:number;width:number;height:number;shape?:'ellipse'}
export interface LayoutText {x:number;y:number;width:number;height:number;key:string;text:string;fontFamily:string;fontSize:number;fontWeight:number;fontStyle?:'normal'|'italic';color:string;align:string;lineHeight:number;letterSpacing:number}
export interface Layout {id:string;name:string;minImages:number;maxImages:number;slots:Slot[];family?:string;background?:string;overlay?:string;texts?:LayoutText[]}
const auditedOverlayTexts=overlayTexts as Record<string,LayoutText[]>;
export const TEMPLATE_TEXT_SCHEMA=3;
export const singlePhotoTemplateCaptions=[
  'Keep my feelings and memories.',
  'Keep this moment close.',
  'Hold on to this little moment.',
  'Some days deserve to stay.',
  'Keep a piece of today.',
  'This moment is worth keeping.',
  'A quiet memory to keep.',
  'Save a little light from today.',
  'One more moment for the pages.',
  'Let this day stay with me.',
] as const;
function stableTextIndex(value:string,count:number){
  let hash=2166136261;
  for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619);}
  return (hash>>>0)%count;
}
export function singlePhotoTemplateCaption(assetId:string,pageId:string){
  return singlePhotoTemplateCaptions[stableTextIndex(`${pageId}:${assetId}`,singlePhotoTemplateCaptions.length)];
}
export function isSinglePhotoTemplateCaption(value:string){
  return (singlePhotoTemplateCaptions as readonly string[]).includes(value);
}
const hasAuditedOverlay=(id:string)=>Object.prototype.hasOwnProperty.call(auditedOverlayTexts,id);
const cleanedOverlay=(layout:Layout)=>hasAuditedOverlay(layout.id)&&layout.overlay
  ?`/reference/templates-clean/${layout.id}.webp`
  :layout.overlay;
export const layouts=(catalog as Layout[]).map(layout=>{
  const extra=auditedOverlayTexts[layout.id]??[];
  const existing=new Set((layout.texts??[]).map(text=>text.key));
  return {
    ...layout,
    overlay:cleanedOverlay(layout),
    texts:[...(layout.texts??[]),...extra.filter(text=>!existing.has(text.key))]
  };
});
function layoutTextElement(t:LayoutText){
  return textElement(t.text,{
    x:t.x*W,y:t.y*H,width:Math.max(t.width*W,10),height:Math.max(t.height*H+4,10),
    fontSize:t.fontSize*W,fontFamily:t.fontFamily,fontWeight:t.fontWeight,fontStyle:t.fontStyle,
    color:t.color,align:t.align==='center'?'center':t.align==='right'?'right':'left',
    lineHeight:t.lineHeight,letterSpacing:t.letterSpacing*W/320,templateTextKey:t.key
  });
}
export function migrateBookTemplateTexts(value:Book){
  let book=value,changed=false;
  const writable=()=>{if(!changed){book=structuredClone(value);changed=true;}return book;};
  for(let index=0;index<value.pages.length;index++){
    const source=value.pages[index];
    if(!source.layoutId||!hasAuditedOverlay(source.layoutId))continue;
    const layout=layouts.find(item=>item.id===source.layoutId);
    if(!layout)continue;
    const needsSchema=(source.templateTextSchema??0)<TEMPLATE_TEXT_SCHEMA;
    const needsOverlay=!!layout.overlay&&source.templateOverlay!==layout.overlay;
    if(!needsSchema&&!needsOverlay)continue;
    const page=writable().pages[index];
    if(needsSchema){
      if(source.layoutId==='tpl2_p1_left'){
        const title=page.elements.find(element=>element.type==='text'&&element.templateTextKey==='title');
        if(title&&['FLIPBOOK\nMOMENTS','FLIP IN\nMOMENTS'].includes(title.text??''))title.text='LIFE IN\nPAGES';
      }
      if(source.layoutId==='tpl2_p3_right'){
        const caption=page.elements.find(element=>element.type==='text'&&element.templateTextKey==='caption');
        const image=page.elements.find(element=>element.type==='image'&&!element.freeImage);
        if(caption&&image?.assetId&&isSinglePhotoTemplateCaption(caption.text??''))caption.text=singlePhotoTemplateCaption(image.assetId,page.id);
      }
      const existing=new Set(page.elements.filter(element=>element.type==='text'&&element.templateTextKey).map(element=>element.templateTextKey!));
      for(const text of layout.texts??[])if(!existing.has(text.key))page.elements.push(layoutTextElement(text));
      page.templateTextSchema=TEMPLATE_TEXT_SCHEMA;
    }
    if(needsOverlay)page.templateOverlay=layout.overlay;
  }
  return {book,changed};
}
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
function layoutVisualBackground(layout:Layout){
  return layout.background?.startsWith('rgba(')?'#ffffff':layout.background;
}
export function applyLayout(page:Page,layout:Layout,assetIds?:string[]):Page {
  if(page.layoutId===layout.id&&!assetIds)return page;
  const oldImages=page.elements.filter(e=>e.type==='image');
  const sourceIds=assetIds??oldImages.map(e=>e.assetId!).filter(Boolean);
  const ids=fitAssetIds(sourceIds,layout.slots.length);
  const images=layout.slots.flatMap((slot,i)=>{
    const id=ids[i];if(!id)return [];
    return [imageElement(id,{id:oldImages[i]?.id??crypto.randomUUID(),x:slot.x*W,y:slot.y*H,width:slot.width*W,height:slot.height*H,frameLocked:true,frameShape:slot.shape})];
  });
  const texts=(layout.texts??[]).map(text=>{
    if(layout.id==='tpl2_p3_right'&&text.key==='caption'&&ids[0])return layoutTextElement({...text,text:singlePhotoTemplateCaption(ids[0],page.id)});
    return layoutTextElement(text);
  });
  return {...page,layoutId:layout.id,templateOverlay:layout.overlay,templateBackground:layoutVisualBackground(layout),templateTextSchema:TEMPLATE_TEXT_SCHEMA,pattern:undefined,elements:[...images,...texts]};
}
export function autoLayout(book:Book,assets:Asset[]):Book {
  const pages:Page[]=[book.pages[0]];
  for(let i=0;i<assets.length;i+=2){const group=assets.slice(i,i+2);const page=applyLayout(blankPage(pages.length),defaultLayout(group.length),group.map(a=>a.id));pages.push(page);}
  return {...book,pages};
}
