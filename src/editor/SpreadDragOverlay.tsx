import {useEffect,useState} from 'react';
import {Group,Image as CanvasImage,Layer,Rect,Stage,Text} from 'react-konva';
import type {Element} from '../domain/model';
import {H,W} from '../domain/model';
import {cropRect} from '../domain/crop';
import {isPaperTapeElement} from '../domain/tapeStyles';
import {polaroidAssetIdFor,polaroidPhotoFrame,polaroidTemplateFor} from '../domain/polaroids';
import {loadAssetImage,loadPaperTapeImage,loadStaticImage,paperTapeImageProps,textProps} from './renderer';

export type SpreadDragSide='left'|'right';

type Props={
  side:SpreadDragSide;
  elements:Element[];
  pageWidth:number;
};

export function SpreadDragOverlay({side,elements,pageWidth}:Props){
  const scale=pageWidth/W;
  const sourceOffset=side==='right'?W:0;
  const clipX=side==='left'?W:0;
  return <div
    className="spread-drag-overlay"
    aria-hidden
    style={{position:'absolute',inset:0,zIndex:80,pointerEvents:'none',overflow:'visible'}}
  >
    <Stage width={pageWidth*2} height={H*scale} scaleX={scale} scaleY={scale} listening={false}>
      <Layer listening={false}>
        <Group clipX={clipX} clipY={0} clipWidth={W} clipHeight={H} listening={false}>
          {elements.map(element=><SpreadElement key={element.id} element={element} offsetX={sourceOffset}/>)}
        </Group>
      </Layer>
    </Stage>
  </div>;
}

function SpreadElement({element,offsetX}:{element:Element;offsetX:number}){
  if(element.type==='image'&&element.polaroidStyle)return <SpreadPolaroid element={element} offsetX={offsetX}/>;
  if(isPaperTapeElement(element))return <SpreadTape element={element} offsetX={offsetX}/>;
  if(element.type==='text'||element.type==='sticker'){
    const props=textProps(element);
    return <Text {...props} x={Number(props.x??element.x)+offsetX} listening={false}/>;
  }
  return null;
}

function SpreadTape({element,offsetX}:{element:Element;offsetX:number}){
  const [image,setImage]=useState<HTMLImageElement>();
  useEffect(()=>{
    let live=true;
    setImage(undefined);
    void loadPaperTapeImage(element.tapeStyle,element.color).then(value=>{if(live)setImage(value);}).catch(()=>{});
    return()=>{live=false;};
  },[element.tapeStyle,element.color]);
  if(!image)return <Rect x={element.x+offsetX} y={element.y} width={element.width} height={element.height} rotation={element.rotation} opacity={element.opacity} fill={element.color??'#d9c9a8'} listening={false}/>;
  const props=paperTapeImageProps(element,image);
  return <CanvasImage {...props} x={Number(props.x??element.x)+offsetX} listening={false}/>;
}

function SpreadPolaroid({element,offsetX}:{element:Element;offsetX:number}){
  const [image,setImage]=useState<HTMLImageElement>();
  const [overlay,setOverlay]=useState<HTMLImageElement>();
  const template=polaroidTemplateFor(element.polaroidStyle);
  const frame=polaroidPhotoFrame(element);
  const assetId=polaroidAssetIdFor(element);

  useEffect(()=>{
    let live=true;
    setImage(undefined);
    if(assetId)void loadAssetImage(assetId).then(value=>{if(live)setImage(value);}).catch(()=>{});
    return()=>{live=false;};
  },[assetId]);
  useEffect(()=>{
    let live=true;
    setOverlay(undefined);
    void loadStaticImage(template.overlay).then(value=>{if(live)setOverlay(value);}).catch(()=>{});
    return()=>{live=false;};
  },[template.overlay]);

  const source=image?{width:image.naturalWidth,height:image.naturalHeight}:undefined;
  const crop=source?cropRect({width:frame.width,height:frame.height},source,element.crop):undefined;
  return <Group x={element.x+offsetX} y={element.y} rotation={element.rotation} opacity={element.opacity} listening={false}>
    <Rect width={element.width} height={element.height} fill="#faf9f5" shadowEnabled shadowColor="#000" shadowBlur={16} shadowOpacity={.12} shadowOffsetY={8} cornerRadius={10} listening={false}/>
    <Group x={frame.x} y={frame.y} clipX={0} clipY={0} clipWidth={frame.width} clipHeight={frame.height} listening={false}>
      {image&&crop
        ?<CanvasImage image={image} width={frame.width} height={frame.height} crop={crop} listening={false}/>
        :<Rect width={frame.width} height={frame.height} fill="#e7e7e4" listening={false}/>} 
    </Group>
    {overlay?<CanvasImage image={overlay} width={element.width} height={element.height} listening={false}/>:null}
  </Group>;
}
