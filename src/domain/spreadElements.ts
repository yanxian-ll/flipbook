import {W,type Book,type Element,type Page} from './model';
import {isPaperTapeElement} from './tapeStyles';

const borrowPrefix='__spread-borrow__:';
const renderedPages=new WeakMap<Page,WeakMap<Page,Page>>();

export function canSpanSpread(element:Element){
  return element.type==='text'
    ||element.type==='sticker'
    ||isPaperTapeElement(element)
    ||(element.type==='image'&&!!element.polaroidStyle);
}

export function spreadNeighborIndex(index:number,pageCount:number){
  if(index<=0||index>=pageCount)return -1;
  if(index%2===1)return index+1<pageCount?index+1:-1;
  return index-1;
}

function borrowedId(pageId:string,elementId:string){
  return `${borrowPrefix}${encodeURIComponent(pageId)}:${encodeURIComponent(elementId)}`;
}

export function spreadBorrowSource(element:Element){
  if(!element.id.startsWith(borrowPrefix))return null;
  const encoded=element.id.slice(borrowPrefix.length);
  const separator=encoded.indexOf(':');
  if(separator<0)return null;
  try{
    return {
      pageId:decodeURIComponent(encoded.slice(0,separator)),
      elementId:decodeURIComponent(encoded.slice(separator+1)),
    };
  }catch{return null;}
}

export function isSpreadBorrowedElement(element:Element){return spreadBorrowSource(element)!==null;}

/**
 * Build a render-only page that also contains the decorative elements owned by
 * the other half of the same spread. The borrowed element keeps the same
 * geometry and is translated by exactly one page width, so the page canvas
 * itself clips it at the spine. Stored book data is never duplicated.
 */
export function pageWithSpreadOverflow(book:Book,index:number,page:Page=book.pages[index]){
  const neighborIndex=spreadNeighborIndex(index,book.pages.length);
  if(neighborIndex<0)return page;
  const neighbor=book.pages[neighborIndex];
  if(!neighbor)return page;

  let byNeighbor=renderedPages.get(page);
  const cached=byNeighbor?.get(neighbor);
  if(cached)return cached;

  const shift=index%2===1?W:-W;
  const borrowed=neighbor.elements.filter(canSpanSpread).map(element=>({
    ...element,
    id:borrowedId(neighbor.id,element.id),
    x:element.x+shift,
    locked:true,
  }));
  if(!borrowed.length)return page;

  const rendered={...page,elements:[...page.elements,...borrowed]};
  if(!byNeighbor){byNeighbor=new WeakMap<Page,Page>();renderedPages.set(page,byNeighbor);}
  byNeighbor.set(neighbor,rendered);
  return rendered;
}
