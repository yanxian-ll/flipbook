import {describe,it,expect} from 'vitest';
import {resizeSlot} from './VisualTemplateEditor';
import {createWorkQueue} from '../domain/workQueue';
describe('visual template controls',()=>{
  it('moves a frame while preserving its size and shape',()=>{const next=resizeSlot({x:.2,y:.2,width:.3,height:.4,shape:'ellipse'},'move',.1,-.1);expect(next.x).toBeCloseTo(.3);expect(next).toMatchObject({y:.1,width:.3,height:.4,shape:'ellipse'});});
  it('resizes from the correct corner and clamps to page edges',()=>{const slot={x:.2,y:.2,width:.3,height:.4};const next=resizeSlot(slot,'nw',-.8,-.8);expect(next.x).toBe(0);expect(next.y).toBe(0);expect(next.width).toBeCloseTo(.5);expect(next.height).toBeCloseTo(.6);const edge=resizeSlot(slot,'se',2,2);expect(edge.x+edge.width).toBe(1);expect(edge.y+edge.height).toBe(1);});
  it('keeps a minimum frame size instead of flipping the frame',()=>{const next=resizeSlot({x:.2,y:.2,width:.3,height:.4},'nw',1,1);expect(next.width).toBeCloseTo(.04);expect(next.height).toBeCloseTo(.04);});
});
describe('bounded rendering work',()=>{
  it('keeps at most two jobs active and continues after failure',async()=>{const queue=createWorkQueue(2);let active=0,peak=0;const jobs=Array.from({length:30},(_,i)=>queue(async()=>{active++;peak=Math.max(peak,active);await Promise.resolve();active--;if(i===4)throw new Error('bad image');return i;}));const results=await Promise.allSettled(jobs);expect(peak).toBe(2);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(29);expect(results[29]).toEqual({status:'fulfilled',value:29});});
});
