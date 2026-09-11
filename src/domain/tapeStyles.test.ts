import {describe,expect,it} from 'vitest';
import {isPaperTapeElement,paperTapeStyleFor,paperTapeStyles} from './tapeStyles';

describe('paper tape styles',()=>{
  it('exposes the four handmade tape choices',()=>{
    expect(paperTapeStyles.map(style=>style.id)).toEqual(['kraft','grid','dots','fiber']);
    expect(new Set(paperTapeStyles.map(style=>style.texture)).size).toBe(4);
  });

  it('keeps old long plain shapes compatible as paper tape',()=>{
    expect(isPaperTapeElement({type:'shape',width:460,height:90,shadow:false})).toBe(true);
    expect(paperTapeStyleFor(undefined).id).toBe('kraft');
  });

  it('does not classify other shapes as paper tape',()=>{
    expect(isPaperTapeElement({type:'shape',width:800,height:1050,shadow:true})).toBe(false);
    expect(isPaperTapeElement({type:'sticker',width:460,height:90})).toBe(false);
  });
});
