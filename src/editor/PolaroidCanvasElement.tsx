import {useEffect,useRef,useState} from 'react';
import {Group,Image as CanvasImage,Rect} from 'react-konva';
import Konva from 'konva';
import type {Element} from '../domain/model';
import {centeredCrop,cropRect,dragCrop,type Crop} from '../domain/crop';
import {polaroidAssetIdFor,polaroidAssetPatch,polaroidPhotoFrame,polaroidTemplateFor,storedPolaroidAssetId} from '../domain/polaroids';
import {loadAssetImage,loadStaticImage} from './renderer';

type Props={
  element:Element;
  image?:HTMLImageElement;
  failed:boolean;
  selected:boolean;
  onSelect:(multi:boolean)=>void;
  onDoubleClick:()=>void;
  onCommit:(node:Konva.Node)=>void;
  onDragStart:(node:Konva.Node)=>void;
  onDragMove:(node:Konva.Node)=>void;
  onUpdate:(patch:Partial<Element>)=>void;
};

export function PolaroidCanvasElement({element,selected,onSelect,onDoubleClick,onCommit,onDragStart,onDragMove,onUpdate}:Props){
  const group=useRef<Konva.Group>(null);
  const photoGroup=useRef<Konva.Group>(null);
  const [overlay,setOverlay]=useState<HTMLImageElement>();
  const [image,setImage]=useState<HTMLImageElement>();
  const [failed,setFailed]=useState(false);
  const [photoHover,setPhotoHover]=useState(false);
  const [preview,setPreview]=useState<Element['crop']>();
  const drag=useRef<{pointerId:number;x:number;y:number;clientX:number;clientY:number;crop:Crop;moved:boolean;target:Konva.Shape}|null>(null);
  const frame=polaroidPhotoFrame(element);
  const template=polaroidTemplateFor(element.polaroidStyle);
  const shownCrop=preview??element.crop??centeredCrop;
  const storedAssetId=storedPolaroidAssetId(element);
  const assetId=polaroidAssetIdFor(element);

  useEffect(()=>{
    let alive=true;
    setOverlay(undefined);
    void loadStaticImage(template.overlay).then(value=>{if(alive)setOverlay(value);}).catch(()=>{});
    return()=>{alive=false;};
  },[template.overlay]);

  useEffect(()=>{
    let alive=true;
    setImage(undefined);
    setFailed(false);
    if(!assetId)return()=>{alive=false;};
    void loadAssetImage(assetId).then(value=>{if(alive)setImage(value);}).catch(()=>{if(alive)setFailed(true);});
    return()=>{alive=false;};
  },[assetId]);

  // Migrate polaroids created by the first implementation. This removes their photo from the
  // legacy assetId field so the page template no longer counts it as one of its own images.
  useEffect(()=>{
    if(!element.polaroidStyle||storedAssetId||!element.assetId)return;
    onUpdate(polaroidAssetPatch(element.assetId,false));
  },[element.id,element.polaroidStyle,element.assetId,storedAssetId]);

  function setCursor(cursor:string){
    const container=group.current?.getStage()?.container();
    if(container)container.style.cursor=cursor;
  }
  function point(){return photoGroup.current?.getRelativePointerPosition();}
  function selectFrame(e?:Konva.KonvaEventObject<MouseEvent>){
    onSelect(!!e&&(e.evt.ctrlKey||e.evt.metaKey||e.evt.shiftKey));
  }
  function activatePhoto(){
    // Keep the polaroid selected while editing its inner photo. The photo group stops pointer
    // propagation, so dragging here edits the crop rather than moving the outer frame. Selection
    // is cleared only by the canvas/background click handling outside this element.
    onSelect(false);
  }
  function beginCrop(e:Konva.KonvaEventObject<PointerEvent>){
    if(e.evt.button!==0||drag.current)return;
    activatePhoto();
    e.cancelBubble=true;
    if(!image)return;
    const p=point();if(!p)return;
    group.current?.draggable(false);
    setCursor('grabbing');
    const target=e.target as Konva.Shape;
    drag.current={...p,pointerId:e.evt.pointerId,clientX:e.evt.clientX,clientY:e.evt.clientY,crop:element.crop??centeredCrop,moved:false,target};
    target.setPointerCapture(e.evt.pointerId);
  }
  function nextCrop(e:Konva.KonvaEventObject<PointerEvent>){
    const start=drag.current,p=point();
    if(!start||start.pointerId!==e.evt.pointerId||!p||!image)return;
    if(Math.hypot(e.evt.clientX-start.clientX,e.evt.clientY-start.clientY)>3)start.moved=true;
    if(!start.moved)return;
    return dragCrop({width:frame.width,height:frame.height},{width:image.naturalWidth,height:image.naturalHeight},start.crop,p.x-start.x,p.y-start.y);
  }
  function moveCrop(e:Konva.KonvaEventObject<PointerEvent>){
    const crop=nextCrop(e);if(crop)setPreview(crop);e.cancelBubble=true;
  }
  function finishCrop(e:Konva.KonvaEventObject<PointerEvent>){
    const start=drag.current;if(!start||start.pointerId!==e.evt.pointerId)return;
    const crop=nextCrop(e);
    start.target.releaseCapture(e.evt.pointerId);
    drag.current=null;
    group.current?.draggable(!element.locked);
    setCursor('grab');
    if(crop&&(crop.x!==start.crop.x||crop.y!==start.crop.y))onUpdate({crop});
    setPreview(undefined);
    e.cancelBubble=true;
  }
  function cancelCrop(e:Konva.KonvaEventObject<PointerEvent>){
    const start=drag.current;if(!start||start.pointerId!==e.evt.pointerId)return;
    start.target.releaseCapture(e.evt.pointerId);
    drag.current=null;
    group.current?.draggable(!element.locked);
    setPreview(undefined);
    setCursor('grab');
    e.cancelBubble=true;
  }
  function zoomPhoto(e:Konva.KonvaEventObject<WheelEvent>){
    if(!image)return;
    activatePhoto();
    e.evt.preventDefault();e.evt.stopPropagation();e.cancelBubble=true;
    const crop=element.crop??centeredCrop;
    onUpdate({crop:{...crop,zoom:Math.max(1,Math.min(4,crop.zoom-e.evt.deltaY*.002))}});
  }

  const source=image?{width:image.naturalWidth,height:image.naturalHeight}:undefined;
  const crop=source?cropRect({width:frame.width,height:frame.height},source,shownCrop):undefined;

  return <Group
    ref={group}
    id={element.id}
    x={element.x}
    y={element.y}
    rotation={element.rotation}
    opacity={element.opacity}
    draggable={!element.locked}
    onDragStart={e=>{onDragStart(e.target);setCursor('grabbing');}}
    onDragMove={e=>onDragMove(e.target)}
    onDragEnd={e=>{onCommit(e.target);setCursor('move');}}
    onTransformEnd={e=>onCommit(e.target)}
  >
    <Rect width={element.width} height={element.height} fill="#faf9f5" shadowEnabled shadowColor="#000" shadowBlur={16} shadowOpacity={.12} shadowOffsetY={8} cornerRadius={10} listening={false}/>
    {/* Transparent hit area: the outer frame itself selects/moves the whole polaroid. */}
    <Rect
      width={element.width}
      height={element.height}
      fill="rgba(0,0,0,0.001)"
      onClick={selectFrame}
      onTap={()=>onSelect(false)}
      onDblClick={onDoubleClick}
      onDblTap={onDoubleClick}
      onMouseEnter={()=>setCursor('move')}
      onMouseLeave={()=>setCursor('default')}
    />
    <Group
      ref={photoGroup}
      x={frame.x}
      y={frame.y}
      clipX={0}
      clipY={0}
      clipWidth={frame.width}
      clipHeight={frame.height}
      onPointerDown={beginCrop}
      onPointerMove={moveCrop}
      onPointerUp={finishCrop}
      onPointerCancel={cancelCrop}
      onWheel={zoomPhoto}
      onClick={e=>{activatePhoto();e.cancelBubble=true;}}
      onTap={e=>{activatePhoto();e.cancelBubble=true;}}
      onDblClick={e=>{onDoubleClick();e.cancelBubble=true;}}
      onDblTap={e=>{onDoubleClick();e.cancelBubble=true;}}
      onMouseEnter={()=>{setPhotoHover(true);setCursor(image?'grab':'pointer');}}
      onMouseLeave={()=>{setPhotoHover(false);setCursor('move');}}
    >
      {image&&crop
        ?<CanvasImage image={image} width={frame.width} height={frame.height} crop={crop}/>
        :<Rect width={frame.width} height={frame.height} fill={failed?'#f5b4b4':'#e7e7e4'}/>} 
      {photoHover&&<Rect width={frame.width} height={frame.height} stroke="#e9933b" strokeWidth={4} listening={false}/>} 
    </Group>
    {overlay?<CanvasImage image={overlay} width={element.width} height={element.height} listening={false}/>:null}
    {selected&&<Rect width={element.width} height={element.height} stroke="#3185ff" strokeWidth={3} dash={[8,6]} listening={false}/>} 
  </Group>;
}
