import {describe,expect,it} from 'vitest';
import {editorLeafPlan,readerLeafPlan} from './spec';

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
