import type {Layout,Slot} from './layouts';
export type ThemeId = 'scrapbook' | 'editorial';
export interface Asset {
  id: string; name: string; mimeType: string; width: number; height: number;
  orientation: 'portrait' | 'landscape' | 'square'; storageKey: string; createdAt: number;
  uploadBatchId?: string; uploadBatchAt?: number;
}
export interface Element {
  id: string; type: 'image' | 'text' | 'sticker' | 'shape';
  x: number; y: number; width: number; height: number; rotation: number; opacity: number;
  locked?: boolean; assetId?: string; text?: string; color?: string; fontFamily?: string;
  fontSize?: number; fontWeight?: number; fontStyle?: 'normal' | 'italic'; align?: 'left' | 'center' | 'right';
  fit?: 'cover' | 'contain'; crop?: { x: number; y: number; zoom: number };
  border?: number; borderColor?: string; shadow?: boolean; cornerRadius?: number;
  frameLocked?: boolean; frameShape?: 'ellipse'; templateTextKey?: string;
  freeImage?: boolean; lineHeight?: number; letterSpacing?: number; blur?: number;
}
export interface Page {
  id: string; type: 'cover' | 'normal'; background: string; pattern?: string; patternAssetId?: string;
  elements: Element[]; layoutId?: string; layoutSlots?: Slot[]; order: number;
  templateOverlay?: string; templateBackground?: string; templateTextSchema?: number;
}
export interface CoverTemplate {id:string;name:string;slot?:Slot}
export interface BookStyle {
  pageBackground:string;
  textColor:string;
  fontFamily:string;
}
export interface BackCover {
  /** Legacy field kept so existing local books and backups stay readable. */
  mode?:'match-front'|'solid'|'custom';
  /** Background styling is independent from the cover template. */
  backgroundMode?:'match-front'|'custom';
  background:string;
  /** Cover templates only describe whether/where a photo window exists. */
  templateId?:string;
  assetId?:string;
  crop?:{x:number;y:number;zoom:number};
  text?:string;
  textColor?:string;
}
export interface Book {
  id: string; title: string; themeId: ThemeId; format: { width: number; height: number };
  coverPageId: string; pages: Page[]; assets: Asset[]; createdAt: number; updatedAt: number;
  version: number; workspaceBackground: string; coverTemplate: string;
  defaultPageBackground?: string;
  /** Legacy setting kept so older saved books remain compatible. */
  bookStyle?: BookStyle;
  backCover?: BackCover;
  workspacePattern?: string; workspaceImageId?: string; workspaceTextureId?: string;
  textureAssets?: Asset[]; recentTextureIds?: string[];
  customLayouts?: Layout[];
  customCoverTemplates?: CoverTemplate[];
}
export interface StoredAsset extends Asset { original: Blob; preview: Blob; thumbnail: Blob }
export const W = 1200;
export const H = 1696;
export const uid = () => crypto.randomUUID();

export const builtInCoverTemplates:CoverTemplate[]=[
  {id:'plain',name:'纯色封面'},
  {id:'basic',name:'基础大图',slot:{x:80/W,y:100/H,width:1040/W,height:1300/H}},
  {id:'cutout',name:'中间小窗',slot:{x:414/W,y:360/H,width:372/W,height:498/H}},
];

export function coverTemplatesFor(book:Book){return [...builtInCoverTemplates,...(book.customCoverTemplates??[])];}
export function coverTemplateFor(book:Book,id:string|undefined){return coverTemplatesFor(book).find(template=>template.id===id)??builtInCoverTemplates[2];}

export function blankPage(order: number, background = '#eeeae3'): Page {
  return { id: uid(), type: order === 0 ? 'cover' : 'normal', background, elements: [], order };
}
export function textElement(text: string, patch: Partial<Element> = {}): Element {
  return {id: uid(), type:'text', text, x:120,y:140,width:960,height:150, rotation:0,opacity:1,fontFamily:'Domine',fontSize:80,fontWeight:400,color:'#252525',align:'left',...patch};
}
export function imageElement(assetId: string, patch: Partial<Element> = {}): Element {
  return {id:uid(),type:'image',assetId,x:100,y:100,width:1000,height:1300,rotation:0,opacity:1,fit:'cover',crop:{x:0.5,y:0.5,zoom:1},...patch};
}
export function newBook(title: string, themeId: ThemeId, assets: Asset[] = []): Book {
  const cover = blankPage(0, themeId === 'scrapbook' ? '#f5ec30' : '#e8e2cf');
  if(assets[0]) cover.elements.push(imageElement(assets[0].id,{x:414,y:360,width:372,height:498}));
  cover.elements.push(textElement('TIME TO FLIPBOOK',{x:180,y:1550,width:840,height:40,fontSize:26,align:'center',color:'#4a3f1a'}));
  return {id:uid(),title,themeId,format:{width:W,height:H},coverPageId:cover.id,pages:[cover],assets,createdAt:Date.now(),updatedAt:Date.now(),version:1,workspaceBackground:'#e9eaec',coverTemplate:'cutout',defaultPageBackground:'#eeeae3',backCover:{mode:'match-front',backgroundMode:'match-front',background:cover.background,templateId:'plain',text:'',textColor:'#4a3f1a'}};
}
export function validateBook(value: unknown): asserts value is Book {
  const b = value as Book;
  if(!b || typeof b.id !== 'string' || typeof b.title !== 'string' || !Array.isArray(b.pages) || b.pages.length === 0 || !Array.isArray(b.assets) || b.format?.width !== W || b.format?.height !== H || b.pages[0].type !== 'cover' || b.pages.some(p=>!Array.isArray(p.elements)||typeof p.background!=='string')) throw new Error('画册数据损坏，无法打开。原数据已保留。');
}

export function visualPageBackground(page:Page){return page.pattern||page.patternAssetId?page.background:page.templateBackground??page.background;}

export function bookStyleFor(book:Book):BookStyle{
  return {
    pageBackground:book.bookStyle?.pageBackground??book.defaultPageBackground??'#eeeae3',
    textColor:book.bookStyle?.textColor??'#252525',
    fontFamily:book.bookStyle?.fontFamily??'Domine',
  };
}
export function backCoverFor(book:Book){
  const configured=book.backCover;
  const backgroundMode=configured?.backgroundMode??(configured?.mode==='match-front'||!configured?'match-front':'custom');
  const templateId=configured?.templateId??(configured?.mode==='custom'?'cutout':'plain');
  return {
    mode:configured?.mode??(backgroundMode==='match-front'?'match-front':templateId==='plain'?'solid':'custom'),
    backgroundMode,
    background:configured?.background??book.pages[0]?.background??'#f2efe4',
    templateId,
    assetId:configured?.assetId,
    crop:configured?.crop??{x:.5,y:.5,zoom:1},
    text:configured?.text??'',
    textColor:configured?.textColor??'#4a3f1a',
  } as const;
}
export function backCoverPage(book:Book):Page{
  const cover=backCoverFor(book);
  const background=cover.backgroundMode==='match-front'?(book.pages[0]?.background??cover.background):cover.background;
  const template=coverTemplateFor(book,cover.templateId);
  const elements:Element[]=[];
  if(template.slot&&cover.assetId){
    elements.push({
      id:`${book.id}:back-image`,type:'image',assetId:cover.assetId,
      x:template.slot.x*W,y:template.slot.y*H,width:template.slot.width*W,height:template.slot.height*H,
      rotation:0,opacity:1,fit:'cover',crop:cover.crop,frameLocked:true,frameShape:template.slot.shape,
    });
  }
  if(cover.text.trim()){
    elements.push({
      id:`${book.id}:back-text`,type:'text',text:cover.text,
      x:180,y:1480,width:840,height:90,rotation:0,opacity:1,
      fontFamily:bookStyleFor(book).fontFamily,fontSize:30,fontWeight:400,
      color:cover.textColor,align:'center',
    });
  }
  return {id:`${book.id}:back-cover`,type:'normal',background,elements,order:book.pages.length};
}

const LEGACY_BRAND=['FLIP','IN'].join('');
function replaceLegacyBrandText(value:string){
  return value.replace(new RegExp(LEGACY_BRAND,'gi'),match=>{
    if(match===match.toUpperCase())return 'FLIPBOOK';
    if(match===match.toLowerCase())return 'flipbook';
    return 'Flipbook';
  });
}
export function migrateLegacyBrandBook(value:Book){
  const book=structuredClone(value);
  let changed=false;
  const update=(value:string)=>{
    const next=replaceLegacyBrandText(value);
    if(next!==value)changed=true;
    return next;
  };
  book.title=update(book.title);
  for(const asset of book.assets)asset.name=update(asset.name);
  for(const asset of book.textureAssets??[])asset.name=update(asset.name);
  for(const page of book.pages){
    for(const element of page.elements){
      if(element.text)element.text=update(element.text);
    }
  }
  if(book.customLayouts)for(const layout of book.customLayouts)layout.name=update(layout.name);
  if(book.customCoverTemplates)for(const template of book.customCoverTemplates)template.name=update(template.name);
  return {book,changed};
}