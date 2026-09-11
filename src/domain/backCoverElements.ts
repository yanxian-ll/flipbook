import {backCoverFor,uid,type BackCover,type Book,type Element} from './model';

export function ensureBackCover(book:Book):BackCover{
  const current=backCoverFor(book);
  if(!book.backCover){
    book.backCover={
      mode:current.mode,
      backgroundMode:current.backgroundMode,
      background:current.background,
      templateId:current.templateId,
      assetId:current.assetId,
      crop:current.crop,
      text:current.text,
      textColor:current.textColor,
      elements:[],
    };
  }
  book.backCover.elements??=[];
  return book.backCover;
}

export function addBackCoverElement(book:Book,element:Element){
  ensureBackCover(book).elements!.push(element);
}

export function updateBackCoverElement(book:Book,id:string,patch:Partial<Element>){
  const back=ensureBackCover(book);
  if(id===`${book.id}:back-image`){
    if(patch.crop)back.crop=patch.crop;
    return;
  }
  if(id===`${book.id}:back-text`){
    if(typeof patch.text==='string')back.text=patch.text;
    if(patch.color)back.textColor=patch.color;
    return;
  }
  const element=back.elements!.find(item=>item.id===id);
  if(element&&!element.locked)Object.assign(element,patch);
}

export function batchUpdateBackCoverElements(book:Book,updates:Array<{id:string;patch:Partial<Element>}>){
  for(const update of updates)updateBackCoverElement(book,update.id,update.patch);
}

export function deleteBackCoverElements(book:Book,ids:string[]){
  const back=ensureBackCover(book),selected=new Set(ids);
  back.elements=back.elements!.filter(element=>!selected.has(element.id)||element.locked);
}

export function copyBackCoverElements(book:Book,ids:string[]){
  const selected=new Set(ids);
  return structuredClone((book.backCover?.elements??[]).filter(element=>selected.has(element.id)));
}

export function pasteBackCoverElements(book:Book,items:Element[]){
  const pasted=items.filter(element=>element.type!=='image').map(element=>({...element,id:uid(),x:element.x+30,y:element.y+30,templateTextKey:undefined}));
  if(pasted.length)ensureBackCover(book).elements!.push(...pasted);
  return pasted;
}