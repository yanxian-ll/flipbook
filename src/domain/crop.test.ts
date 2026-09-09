import {describe,it,expect} from 'vitest';
import {centeredCrop,cropRect,dragCrop} from './crop';

describe('photo movement inside fixed frames',()=>{
  it('moves the rendered photo by the pointer distance',()=>{
    const frame={width:300,height:200},source={width:1200,height:1600};
    const start={x:.5,y:.5,zoom:2};
    const before=cropRect(frame,source,start);
    const next=dragCrop(frame,source,start,30,-20),after=cropRect(frame,source,next);
    expect((before.x-after.x)*frame.width/before.width).toBeCloseTo(30);
    expect((before.y-after.y)*frame.height/before.height).toBeCloseTo(-20);
    expect(next.zoom).toBe(2);
  });
  it('leaves an axis unchanged when the photo exactly fills it',()=>{
    const next=dragCrop({width:300,height:200},{width:1200,height:1600},centeredCrop,90,0);
    expect(next).toEqual(centeredCrop);
  });
  it('clamps to the photo edge without exposing blank space',()=>{
    const frame={width:300,height:200},source={width:1200,height:1600};
    const next=dragCrop(frame,source,{x:.5,y:.5,zoom:2},10000,-10000);
    expect(next).toEqual({x:0,y:1,zoom:2});
    const visible=cropRect(frame,source,next);
    expect(visible.x).toBe(0);expect(visible.y+visible.height).toBe(source.height);
  });
  it('uses display coordinates equally in a small or enlarged editor',()=>{
    const source={width:1200,height:1600};
    const a=dragCrop({width:300,height:200},source,{x:.5,y:.5,zoom:2},20,15);
    const b=dragCrop({width:600,height:400},source,{x:.5,y:.5,zoom:2},40,30);
    expect(a).toEqual(b);
  });
});
