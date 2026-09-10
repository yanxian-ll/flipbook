import {H,W,coverTemplateFor,type Book,type Page} from './model';

/**
 * Return a render-only front-cover page whose image geometry follows the
 * selected cover template. The stored cover image remains the photo choice;
 * the template remains geometry-only.
 */
export function frontCoverRenderPage(book:Book):Page{
  const page=structuredClone(book.pages[0]);
  const template=coverTemplateFor(book,book.coverTemplate);
  const image=page.elements.find(element=>element.type==='image');
  if(!image)return page;
  if(!template.slot){
    image.opacity=0;
    return page;
  }
  image.opacity=1;
  image.x=template.slot.x*W;
  image.y=template.slot.y*H;
  image.width=template.slot.width*W;
  image.height=template.slot.height*H;
  image.frameLocked=true;
  image.frameShape=template.slot.shape;
  return page;
}

export function presentationPage(book:Book,index:number){
  return index===0?frontCoverRenderPage(book):book.pages[index];
}
