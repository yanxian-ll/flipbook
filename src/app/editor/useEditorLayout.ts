import {useMemo} from 'react';
import type {Book} from '../../domain/model';
import {PAGE_ASPECT_RATIO,SINGLE_PAGE_PEEK} from './constants';

export function useEditorLayout({book,pageIndex,wide,viewWidth,viewHeight,spreadRoom}:{book:Book;pageIndex:number;wide:boolean;viewWidth:number;viewHeight:number;spreadRoom:{width:number;height:number}}){
  return useMemo(()=>{
    const page=book.pages[pageIndex]??book.pages[0];
    const pair=pageIndex===0?-1:pageIndex%2===1?pageIndex+1:pageIndex-1;
    const neighborIndex=pair>=0&&pair<book.pages.length?pair:-1;
    const neighborPage=neighborIndex>=0?book.pages[neighborIndex]:undefined;
    const showSingleAdd=pageIndex>0&&!neighborPage;
    const spreadUnitWidth=Math.max(40,Math.min(wide?390:170,((spreadRoom.width||viewWidth)-32)/2,Math.max(60,(spreadRoom.height||viewHeight-215)-20)/PAGE_ASPECT_RATIO));
    const singleWidthRoom=(viewWidth*.94)/(neighborPage||showSingleAdd?1+SINGLE_PAGE_PEEK:1);
    const singleHeightRoom=Math.max(240,viewHeight-174)/PAGE_ASPECT_RATIO;
    const pageCanvasWidth=Math.max(180,Math.min(wide?720:620,singleWidthRoom,singleHeightRoom));
    const pageHeight=pageCanvasWidth*PAGE_ASPECT_RATIO;
    const visualReverse=pageIndex>0&&pageIndex%2===0;
    const activeSide=pageIndex===0?'cover':visualReverse?'right':'left';
    const pairSide=pageIndex===0?'right':visualReverse?'left':'right';
    const focusWindowWidth=pageCanvasWidth*(neighborPage||showSingleAdd?1+SINGLE_PAGE_PEEK:1);
    const focusTrackWidth=pageCanvasWidth*(neighborPage||showSingleAdd?2:1);
    const focusedShift=(neighborPage||showSingleAdd)&&visualReverse?-pageCanvasWidth*(1-SINGLE_PAGE_PEEK):0;
    return {page,neighborIndex,neighborPage,showSingleAdd,spreadUnitWidth,pageCanvasWidth,pageHeight,visualReverse,activeSide,pairSide,focusWindowWidth,focusTrackWidth,focusedShift};
  },[book,pageIndex,wide,viewWidth,viewHeight,spreadRoom.width,spreadRoom.height]);
}
