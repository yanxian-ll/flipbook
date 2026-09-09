import type {Layout} from './layouts';
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
  fontSize?: number; fontWeight?: number; align?: 'left' | 'center' | 'right';
  fit?: 'cover' | 'contain'; crop?: { x: number; y: number; zoom: number };
  border?: number; borderColor?: string; shadow?: boolean; cornerRadius?: number;
  frameLocked?: boolean; frameShape?: 'ellipse'; templateTextKey?: string;
  freeImage?: boolean; lineHeight?: number; letterSpacing?: number;
}
export interface Page {
  id: string; type: 'cover' | 'normal'; background: string; pattern?: string;
  elements: Element[]; layoutId?: string; order: number;
  templateOverlay?: string; templateBackground?: string;
}
export interface Book {
  id: string; title: string; themeId: ThemeId; format: { width: number; height: number };
  coverPageId: string; pages: Page[]; assets: Asset[]; createdAt: number; updatedAt: number;
  version: number; workspaceBackground: string; coverTemplate: 'basic' | 'cutout';
  defaultPageBackground?: string;
  customLayouts?: Layout[];
}
export interface StoredAsset extends Asset { original: Blob; preview: Blob; thumbnail: Blob }
export const W = 1200;
export const H = 1696;
export const uid = () => crypto.randomUUID();
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
  return {id:uid(),title,themeId,format:{width:W,height:H},coverPageId:cover.id,pages:[cover],assets,createdAt:Date.now(),updatedAt:Date.now(),version:1,workspaceBackground:'#e9eaec',coverTemplate:'cutout',defaultPageBackground:'#eeeae3'};
}
export function validateBook(value: unknown): asserts value is Book {
  const b = value as Book;
  if(!b || typeof b.id !== 'string' || typeof b.title !== 'string' || !Array.isArray(b.pages) || b.pages.length === 0 || !Array.isArray(b.assets) || b.format?.width !== W || b.format?.height !== H || b.pages[0].type !== 'cover' || b.pages.some(p=>!Array.isArray(p.elements)||typeof p.background!=='string')) throw new Error('画册数据损坏，无法打开。原数据已保留。');
}

export function visualPageBackground(page:Page){return page.templateBackground??page.background;}


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
  for(const page of book.pages){
    for(const element of page.elements){
      if(element.text)element.text=update(element.text);
    }
  }
  if(book.customLayouts)for(const layout of book.customLayouts)layout.name=update(layout.name);
  return {book,changed};
}
