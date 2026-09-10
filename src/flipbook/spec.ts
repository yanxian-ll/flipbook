export const flipbookMotion={
  flippingTime:620,
  maxShadowOpacity:.28,
  swipeDistance:28,
  corner:'top' as const,
};

export const flipbookBrowserBundle={
  version:'2.0.7',
  cdn:'https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js',
};

export const sharedViewerSize={
  width:480,
  height:678,
  minWidth:192,
  maxWidth:480,
  minHeight:271,
  maxHeight:678,
};

export function readerLeafPlan(pageCount:number){
  const realPageCount=Math.max(0,Math.floor(pageCount));
  const contentCount=Math.max(0,realPageCount-1);
  const needsFiller=contentCount%2===1;
  const fillerIndex=needsFiller?realPageCount:-1;
  const backIndex=realPageCount+(needsFiller?1:0);
  return {realPageCount,contentCount,needsFiller,fillerIndex,backIndex};
}

export function editorLeafPlan(pageCount:number){
  const realPageCount=Math.max(0,Math.floor(pageCount));
  const lastReal=Math.max(0,realPageCount-1);
  const plusIndex=realPageCount;
  const needsFiller=lastReal%2===0;
  const fillerIndex=needsFiller?plusIndex+1:-1;
  const backIndex=plusIndex+(needsFiller?2:1);
  return {realPageCount,lastReal,plusIndex,needsFiller,fillerIndex,backIndex};
}

/**
 * page-flip@2.0.7 calculates programmatic previous turns from x=10
 * instead of rect.left+10. Centered books can therefore animate from a point
 * outside the rendered book. Pointer-driven turns already use global coords.
 */
export function flipPrevSafely(pageFlip:any){
  const rect=pageFlip?.getBoundsRect?.();
  const controller=pageFlip?.getFlipController?.();
  if(controller?.flip&&rect&&Number.isFinite(rect.left)){
    controller.flip({x:rect.left+10,y:1});
    return;
  }
  pageFlip?.flipPrev?.(flipbookMotion.corner);
}

export function flipToSafely(pageFlip:any,page:number){
  if(!pageFlip)return;
  const collection=pageFlip.getPageCollection?.();
  const currentSpread=collection?.getCurrentSpreadIndex?.();
  const targetSpread=collection?.getSpreadIndexByPage?.(page);
  if(Number.isFinite(currentSpread)&&Number.isFinite(targetSpread)&&targetSpread<currentSpread){
    try{
      collection.setCurrentSpreadIndex(targetSpread+1);
      flipPrevSafely(pageFlip);
      return;
    }catch{
      // Fall back to the public API if page-flip's internal spread state changed.
    }
  }
  pageFlip.flip?.(page,flipbookMotion.corner);
}
