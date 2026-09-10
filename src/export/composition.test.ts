import {describe,it,expect,vi} from 'vitest';
import {compositionGeometry,drawComposition} from './composition';
import {W,H} from '../domain/model';

describe('export composition',()=>{
  it('keeps a consistent four-page canvas for incomplete groups',()=>{
    const drawImage=vi.fn();
    const context={fillRect:vi.fn(),scale:vi.fn(),translate:vi.fn(),drawImage};
    const canvas={width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement;
    const images=[{}, {}, {}] as CanvasImageSource[];
    drawComposition(canvas,images,{pagesPerCollage:4},1000);
    expect(drawImage).toHaveBeenCalledTimes(3);
    drawImage.mock.calls[2].slice(1).forEach((value,i)=>expect(value).toBeCloseTo([W/2,H*1.14,W,H][i]));
    const dimensions=[canvas.width,canvas.height];
    drawComposition(canvas,images.slice(0,1),{pagesPerCollage:4},1000);
    expect([canvas.width,canvas.height]).toEqual(dimensions);
  });
  it('supports preset and custom frame proportions regardless of page count',()=>{
    for(const pagesPerCollage of [1,2,4,6,8]){
      const g=compositionGeometry({pagesPerCollage,frame:true,ratio:'3:4'});
      expect(g.width/g.height).toBeCloseTo(.75);
      const custom=compositionGeometry({pagesPerCollage,frame:true,ratio:'custom',frameWidth:1920,frameHeight:1080});
      expect(custom.width/custom.height).toBeCloseTo(16/9);
    }
  });
  it('ignores saved frame transforms when frame is off',()=>{
    const translate=vi.fn();const ctx={fillRect:vi.fn(),scale:vi.fn(),translate,drawImage:vi.fn()};
    const canvas={width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
    drawComposition(canvas,[],{pagesPerCollage:2,frame:false,zoom:2,offsetX:.5},1000);
    expect(translate).toHaveBeenCalledWith(0,0);
  });
});
