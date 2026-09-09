import type {Element} from './model';

export type Crop=NonNullable<Element['crop']>;
export type Size={width:number;height:number};
export const centeredCrop:Crop={x:.5,y:.5,zoom:1};
const clamp=(value:number)=>Math.max(0,Math.min(1,value));

export function cropRect(frame:Size,source:Size,crop:Crop=centeredCrop){
  const ratio=frame.width/frame.height;
  let width=source.width,height=source.height;
  if(width/height>ratio)width=height*ratio;else height=width/ratio;
  const zoom=Math.max(1,Math.min(4,crop.zoom));
  width/=zoom;height/=zoom;
  return {x:(source.width-width)*clamp(crop.x),y:(source.height-height)*clamp(crop.y),width,height};
}

// Deltas use the same coordinate space as the displayed frame, not source pixels.
export function dragCrop(frame:Size,source:Size,start:Crop,dx:number,dy:number):Crop{
  const visible=cropRect(frame,source,start);
  const horizontal=source.width-visible.width,vertical=source.height-visible.height;
  return {zoom:start.zoom,
    x:horizontal>1e-6?clamp(start.x-dx*visible.width/frame.width/horizontal):start.x,
    y:vertical>1e-6?clamp(start.y-dy*visible.height/frame.height/vertical):start.y};
}
