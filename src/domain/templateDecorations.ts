import type {Page} from './model';

export interface TemplateDecoration {
  id:string;
  type:'frame';
  x:number;
  y:number;
  width:number;
  height:number;
  stroke:string;
  strokeWidth:number;
}

type SlotLike={decorations?:TemplateDecoration[]};

// These line frames were previously baked into the cleaned raster overlay.
// Keeping them as vectors lets the template editor move, resize, recolor and
// delete them without affecting the editable template text or image slots.
const BUILTIN_DECORATIONS:Record<string,TemplateDecoration[]>={
  tpl1_p3_left:[
    {id:'frame-large',type:'frame',x:.051,y:.0504,width:.4617,height:.4129,stroke:'#111111',strokeWidth:4},
    {id:'frame-top-pair',type:'frame',x:.5533,y:.0517,width:.3951,height:.1266,stroke:'#111111',strokeWidth:4},
    {id:'frame-middle-right',type:'frame',x:.6867,y:.468,width:.2589,height:.1834,stroke:'#111111',strokeWidth:4},
    {id:'frame-bottom-pair',type:'frame',x:.051,y:.7644,width:.5535,height:.1824,stroke:'#111111',strokeWidth:4},
  ],
};

const clone=(items:TemplateDecoration[])=>(items??[]).map(item=>({...item}));

export function builtinTemplateDecorations(layoutId:string|undefined){
  return clone(layoutId?BUILTIN_DECORATIONS[layoutId]??[]:[]);
}

export function hasVectorTemplateDecorations(layoutId:string|undefined){
  return !!layoutId&&Object.prototype.hasOwnProperty.call(BUILTIN_DECORATIONS,layoutId);
}

export function decorationsFromSlots(slots:SlotLike[]|undefined){
  return clone(slots?.[0]?.decorations??[]);
}

export function pageTemplateDecorations(page:Page|undefined){
  if(!page)return [];
  const local=decorationsFromSlots(page.layoutSlots);
  if(page.layoutSlots?.[0]?.decorations)return local;
  if(page.templateDecorations)return clone(page.templateDecorations);
  return builtinTemplateDecorations(page.layoutId);
}

export function effectiveTemplateOverlay(page:Page|undefined){
  if(!page)return undefined;
  return hasVectorTemplateDecorations(page.layoutId)?undefined:page.templateOverlay;
}

export function attachDecorationsToSlots<T extends SlotLike>(slots:T[],decorations:TemplateDecoration[]):T[]{
  if(!slots.length)return slots;
  return slots.map((slot,index)=>index===0?({...slot,decorations:clone(decorations)} as T):slot);
}
