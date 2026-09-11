import {describe,expect,it} from 'vitest';
import type {Book,Element,Page} from './model';
import {W} from './model';
import {canSpanSpread,pageWithSpreadOverflow,spreadBorrowSource,spreadNeighborIndex} from './spreadElements';

const element=(patch:Partial<Element>):Element=>({
  id:'e',type:'sticker',x:0,y:0,width:100,height:100,rotation:0,opacity:1,
  ...patch,
});
const page=(id:string,order:number,elements:Element[]=[]):Page=>({id,type:order===0?'cover':'normal',background:'#fff',elements,order});
const book=(pages:Page[]):Book=>({
  id:'book',title:'Book',themeId:'scrapbook',format:{width:1200,height:1696},coverPageId:pages[0].id,pages,assets:[],createdAt:0,updatedAt:0,version:1,
  workspaceBackground:'#fff',coverTemplate:'plain',
});

describe('spread decorative elements',()=>{
  it('pairs normal pages as left and right spread leaves',()=>{
    expect(spreadNeighborIndex(0,5)).toBe(-1);
    expect(spreadNeighborIndex(1,5)).toBe(2);
    expect(spreadNeighborIndex(2,5)).toBe(1);
    expect(spreadNeighborIndex(3,4)).toBe(-1);
  });

  it('allows text, stickers, paper tape and polaroids to span a spread',()=>{
    expect(canSpanSpread(element({type:'text'}))).toBe(true);
    expect(canSpanSpread(element({type:'sticker'}))).toBe(true);
    expect(canSpanSpread(element({type:'shape',tapeStyle:'kraft',width:300,height:80}))).toBe(true);
    expect(canSpanSpread(element({type:'image',polaroidStyle:'classic'}))).toBe(true);
    expect(canSpanSpread(element({type:'image'}))).toBe(false);
  });

  it('borrows the opposite page decoration with a one-page coordinate shift',()=>{
    const leftSticker=element({id:'left-sticker',x:W-80});
    const rightText=element({id:'right-text',type:'text',x:-40});
    const pages=[page('cover',0),page('left',1,[leftSticker]),page('right',2,[rightText])];
    const value=book(pages);

    const leftRender=pageWithSpreadOverflow(value,1);
    const leftBorrow=leftRender.elements.find(item=>spreadBorrowSource(item)?.elementId==='right-text');
    expect(leftBorrow?.x).toBe(W-40);
    expect(leftBorrow?.locked).toBe(true);

    const rightRender=pageWithSpreadOverflow(value,2);
    const rightBorrow=rightRender.elements.find(item=>spreadBorrowSource(item)?.elementId==='left-sticker');
    expect(rightBorrow?.x).toBe(-80);
    expect(rightBorrow?.locked).toBe(true);

    expect(pages[1].elements).toHaveLength(1);
    expect(pages[2].elements).toHaveLength(1);
  });
});
