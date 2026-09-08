import {type Asset,type Page,type Book,blankPage,imageElement,textElement,W,H} from './model';
export interface Slot {x:number;y:number;width:number;height:number}
export interface Layout {id:string;name:string;minImages:number;maxImages:number;slots:Slot[]}
const slot=(x:number,y:number,width:number,height:number):Slot=>({x,y,width,height});
const one=[ [slot(0,0,1,1)], [slot(.07,.06,.86,.82)], [slot(.08,.2,.84,.55)], [slot(.2,.12,.6,.68)], [slot(.06,.04,.88,.62)] ];
const two=[ [slot(.05,.05,.43,.9),slot(.52,.05,.43,.9)], [slot(.05,.05,.9,.43),slot(.05,.52,.9,.43)], [slot(.06,.05,.88,.55),slot(.4,.64,.54,.3)], [slot(.05,.1,.55,.6),slot(.63,.42,.32,.48)], [slot(0,0,1,.5),slot(0,.5,1,.5)], [slot(.07,.14,.86,.34),slot(.07,.55,.86,.34)], [slot(.05,.07,.4,.5),slot(.5,.38,.45,.55)], [slot(.12,.05,.76,.4),slot(.12,.55,.76,.4)] ];
const three=[ [slot(.05,.05,.9,.45),slot(.05,.55,.43,.4),slot(.52,.55,.43,.4)], [slot(.05,.05,.43,.4),slot(.52,.05,.43,.4),slot(.05,.5,.9,.45)], [slot(.05,.05,.54,.9),slot(.64,.05,.31,.43),slot(.64,.52,.31,.43)], [slot(.05,.05,.28,.9),slot(.36,.05,.28,.9),slot(.67,.05,.28,.9)], [slot(.05,.05,.9,.28),slot(.05,.36,.9,.28),slot(.05,.67,.9,.28)], [slot(.07,.04,.55,.38),slot(.38,.34,.55,.38),slot(.07,.64,.55,.32)], [slot(.06,.08,.4,.36),slot(.54,.08,.4,.36),slot(.23,.52,.54,.4)], [slot(.07,.1,.86,.35),slot(.07,.51,.4,.35),slot(.53,.6,.4,.35)] ];
const four=Array.from({length:8},(_,i)=>{const m=.03+(i%4)*.02;const split=i<4?.5:.4;return [slot(m,m,split-m*1.5,.5-m*1.5),slot(split+m/2,m,1-split-m*1.5,.5-m*1.5),slot(m,.5+m/2,split-m*1.5,.5-m*1.5),slot(split+m/2,.5+m/2,1-split-m*1.5,.5-m*1.5)];});
export const layouts:Layout[]=[one,two,three,four].flatMap((group,n)=>group.map((slots,i)=>({id:`${n+1}-${i}`,name:`${n+1} 图 · ${['满版','留白','上下','错落','杂志','画廊','拼贴','日记'][i]}`,minImages:n+1,maxImages:n+1,slots})));
export function applyLayout(page:Page,layout:Layout,assetIds?:string[]):Page {
  const ids=assetIds??page.elements.filter(e=>e.type==='image').map(e=>e.assetId!);
  const nonImages=page.elements.filter(e=>e.type!=='image');
  // Preserve overflow images rather than silently removing user content.
  const images=ids.map((id,i)=>{const s=layout.slots[i%layout.slots.length];const old=page.elements.filter(e=>e.type==='image')[i];return imageElement(id,{id:old?.id??crypto.randomUUID(),x:s.x*W+(i>=layout.slots.length?25:0),y:s.y*H+(i>=layout.slots.length?25:0),width:s.width*W,height:s.height*H});});
  return {...page,layoutId:layout.id,elements:[...images,...nonImages]};
}
export function autoLayout(book:Book,assets:Asset[]):Book {
  const pages:Page[]=[book.pages[0]];
  for(let i=0;i<assets.length;i+=2){const group=assets.slice(i,i+2);const index=pages.length;const colors=['#f4ee30','#e48af5','#d9eb51','#75a4e1','#ff9658','#eeeae3'];let page=blankPage(index,book.themeId==='scrapbook'?colors[(index-1)%colors.length]:'#eeeae3');const variants=layouts.filter(l=>l.minImages===group.length);const pick=group.every(a=>a.orientation==='portrait')?variants[0]:variants[(index+1)%variants.length];page=applyLayout(page,pick,group.map(a=>a.id));page.elements.push(textElement(String(index).padStart(2,'0'),{x:55,y:H-70,width:100,height:40,fontSize:26,fontFamily:'Arial'}));pages.push(page);}
  return {...book,pages};
}
