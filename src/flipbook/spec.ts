export const flipbookMotion={
  flippingTime:620,
  maxShadowOpacity:.28,
  swipeDistance:28,
  corner:'top' as const,
};

export const sharedViewerSize={
  width:480,
  height:678,
  minWidth:192,
  maxWidth:480,
  minHeight:271,
  maxHeight:678,
};

export function shareViewerSizeForScale(scale:number){
  const safeScale=Number.isFinite(scale)?Math.max(.35,Math.min(3,scale)):1;
  // Keep roughly two exported image pixels per CSS pixel for compact presets.
  // Once the source is dense enough, retain the existing full viewer size.
  const displayScale=Math.min(1,safeScale*1.25);
  const scaled=(value:number)=>Math.max(1,Math.round(value*displayScale));
  return {
    width:scaled(sharedViewerSize.width),
    height:scaled(sharedViewerSize.height),
    minWidth:scaled(sharedViewerSize.minWidth),
    maxWidth:scaled(sharedViewerSize.maxWidth),
    minHeight:scaled(sharedViewerSize.minHeight),
    maxHeight:scaled(sharedViewerSize.maxHeight),
  };
}

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
