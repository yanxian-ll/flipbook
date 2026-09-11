import {describe,expect,it} from 'vitest';
import {editorLeafPlan,readerLeafPlan,shareViewerSizeForScale,sharedViewerSize} from './spec';

describe('readerLeafPlan',()=>{
  it('places the back cover after an even number of content pages',()=>{
    expect(readerLeafPlan(5)).toEqual({
      realPageCount:5,
      contentCount:4,
      needsFiller:false,
      fillerIndex:-1,
      backIndex:5,
    });
  });

  it('adds one filler before the back cover for odd content page counts',()=>{
    expect(readerLeafPlan(4)).toEqual({
      realPageCount:4,
      contentCount:3,
      needsFiller:true,
      fillerIndex:4,
      backIndex:5,
    });
  });
});

describe('editorLeafPlan',()=>{
  it('keeps the add-page leaf and synthetic back cover in stable positions',()=>{
    expect(editorLeafPlan(5)).toEqual({
      realPageCount:5,
      lastReal:4,
      plusIndex:5,
      needsFiller:true,
      fillerIndex:6,
      backIndex:7,
    });
  });

  it('does not insert an extra filler when add-page already balances the spread',()=>{
    expect(editorLeafPlan(4)).toEqual({
      realPageCount:4,
      lastReal:3,
      plusIndex:4,
      needsFiller:false,
      fillerIndex:-1,
      backIndex:5,
    });
  });
});

describe('shareViewerSizeForScale',()=>{
  it('shrinks low-resolution HTML exports instead of enlarging them to the full viewer',()=>{
    expect(shareViewerSizeForScale(.35)).toMatchObject({width:210,height:297,maxWidth:210,maxHeight:297});
    expect(shareViewerSizeForScale(.5)).toMatchObject({width:300,height:424,maxWidth:300,maxHeight:424});
    expect(shareViewerSizeForScale(.75)).toMatchObject({width:450,height:636,maxWidth:450,maxHeight:636});
  });

  it('caps standard and high-resolution exports at the normal viewer size',()=>{
    expect(shareViewerSizeForScale(1)).toEqual(sharedViewerSize);
    expect(shareViewerSizeForScale(3)).toEqual(sharedViewerSize);
  });
});
