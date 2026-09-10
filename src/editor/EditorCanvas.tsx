import {useEffect,useRef,useState} from 'react';
import {Stage,Layer,Rect,Text,Image as CanvasImage,Transformer,Line,Group} from 'react-konva';
import Konva from 'konva';
import type {Element,Page} from '../domain/model';
import {W,H,visualPageBackground} from '../domain/model';
import {useEditor} from '../store/editor';
import {dragCrop,centeredCrop,type Crop} from '../domain/crop';
import {frameIsFixed} from '../domain/layouts';
import {elementProps,textProps,photoProps,loadAssetImage,loadStaticImage,frameClip,loadPageFonts} from './renderer';
export function EditorCanvas({page,width,onTextEdit,onCrop,onImageSelect,onBackgroundClick}:{page:Page;width:number;onTextEdit:()=>void;onCrop:()=>void;onImageSelect?:()=>void;onBackgroundClick?:()=>void}){
  const transformer=useRef<Konva.Transformer>(null);const stage=useRef<Konva.Stage>(null);const selected=useEditor(s=>s.selected);const select=useEditor(s=>s.select);const update=useEditor(s=>s.updateElement);const scale=width/W;
  const [guides,setGuides]=useState<{x?:number;y?:number}>({});
  useEffect(()=>{if(!stage.current||!transformer.current)return;const nodes=selected.filter(id=>{const e=page.elements.find(e=>e.id===id);return e&&!e.locked&&!frameIsFixed(page,e);}).map(id=>stage.current!.findOne(`#${id}`)).filter(Boolean) as Konva.Node[];transformer.current.nodes(nodes);transformer.current.getLayer()?.batchDraw();},[selected,page]);
  useEffect(()=>{void loadPageFonts(page).then(()=>stage.current?.batchDraw());},[page]);
  function snap(node:Konva.Node){const element=page.elements.find(e=>e.id===node.id());if(!element)return;const xTargets=[0,W/2,W,...page.elements.filter(e=>e.id!==element.id).flatMap(e=>[e.x,e.x+e.width/2,e.x+e.width])];const yTargets=[0,H/2,H,...page.elements.filter(e=>e.id!==element.id).flatMap(e=>[e.y,e.y+e.height/2,e.y+e.height])];const next:{x?:number;y?:number}={};for(const offset of [0,element.width/2,element.width]){const target=xTargets.find(x=>Math.abs(node.x()+offset-x)<8/scale);if(target!==undefined){node.x(target-offset);next.x=target;break;}}for(const offset of [0,element.height/2,element.height]){const target=yTargets.find(y=>Math.abs(node.y()+offset-y)<8/scale);if(target!==undefined){node.y(target-offset);next.y=target;break;}}setGuides(next);}
  const pageHasImage=page.elements.some(element=>element.type==='image');
  function backgroundClick(){select(null);if(!pageHasImage)onBackgroundClick?.();}
  return <div className="page-canvas" aria-label="画册编辑画布"><Stage ref={stage} width={width} height={H*scale} scaleX={scale} scaleY={scale} onMouseDown={e=>{if(e.target===e.target.getStage()||e.target.name()==='page-background')backgroundClick();}} onTouchStart={e=>{if(e.target===e.target.getStage()||e.target.name()==='page-background')backgroundClick();}}><Layer><Rect name="page-background" width={W} height={H} fill={visualPageBackground(page)}/><Pattern pattern={page.pattern}/>{(page.templateOverlay?[page.elements.filter(e=>e.type==='image'),page.elements.filter(e=>e.type!=='image')]:[page.elements]).map((elements,index)=><Group key={index}>{index===1&&<Overlay url={page.templateOverlay!}/>}{elements.map(element=><CanvasElement key={element.id} fixed={frameIsFixed(page,element)} selected={selected.includes(element.id)} element={element} onClick={multi=>{select(element.id,multi);if(element.type==='text'&&element.templateTextKey&&!multi)onTextEdit();}} onImageSelect={()=>{if(element.type==='image')onImageSelect?.();}} onDoubleClick={()=>{select(element.id);if(element.type==='text')onTextEdit();if(element.type==='image')onCrop();}} onDragMove={snap} onCommit={node=>{update(element.id,{x:node.x(),y:node.y(),width:Math.max(20,element.width*node.scaleX()),height:Math.max(20,element.height*node.scaleY()),rotation:node.rotation()});node.scaleX(1);node.scaleY(1);setGuides({});}}/>)}</Group>)}{guides.x!==undefined&&<Line points={[guides.x,0,guides.x,H]} stroke="#e53478" strokeWidth={1/scale} listening={false}/ >}{guides.y!==undefined&&<Line points={[0,guides.y,W,guides.y]} stroke="#e53478" strokeWidth={1/scale} listening={false}/>}<Transformer ref={transformer} rotateEnabled flipEnabled={false} borderStroke="#3185ff" anchorStroke="#3185ff" anchorFill="#fff" anchorSize={7} padding={2} boundBoxFunc={(oldBox,newBox)=>Math.abs(newBox.width)<12||Math.abs(newBox.height)<12?oldBox:newBox}/></Layer></Stage></div>;
}
function Pattern({pattern}:{pattern?:string}){const [image,setImage]=useState<HTMLImageElement>();useEffect(()=>{let alive=true;setImage(undefined);if(pattern)void loadStaticImage(`/reference/${pattern}`).then(img=>{if(alive)setImage(img);}).catch(()=>{});return()=>{alive=false;};},[pattern]);return image?<CanvasImage image={image} width={W} height={H} opacity={.55} listening={false}/>:null;}
function CanvasElement({element,fixed,selected,onClick,onImageSelect,onDoubleClick,onCommit,onDragMove}:{element:Element;fixed:boolean;selected:boolean;onClick:(multi:boolean)=>void;onImageSelect:()=>void;onDoubleClick:()=>void;onCommit:(node:Konva.Node)=>void;onDragMove:(node:Konva.Node)=>void}){
  const [image,setImage]=useState<HTMLImageElement>();const [failed,setFailed]=useState(false);
  useEffect(()=>{let live=true;setImage(undefined);setFailed(false);if(element.assetId)void loadAssetImage(element.assetId).then(img=>{if(live)setImage(img);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[element.assetId]);
  const movable=element.type==='text'||element.type==='sticker';
  const events={draggable:!element.locked,onClick:(e:Konva.KonvaEventObject<MouseEvent>)=>{onClick(e.evt.shiftKey);onImageSelect();},onTap:()=>{onClick(false);onImageSelect();},onDblClick:onDoubleClick,onDblTap:onDoubleClick,onMouseEnter:(e:Konva.KonvaEventObject<MouseEvent>)=>{if(movable&&!element.locked)setStageCursor(e.target,'move');},onMouseLeave:(e:Konva.KonvaEventObject<MouseEvent>)=>{if(movable)setStageCursor(e.target,'default');},onDragStart:(e:Konva.KonvaEventObject<DragEvent>)=>{onClick(false);if(movable)setStageCursor(e.target,'grabbing');},onDragMove:(e:Konva.KonvaEventObject<DragEvent>)=>onDragMove(e.target),onDragEnd:(e:Konva.KonvaEventObject<DragEvent>)=>{onCommit(e.target);if(movable)setStageCursor(e.target,'move');},onTransformEnd:(e:Konva.KonvaEventObject<Event>)=>onCommit(e.target)};
  if(element.type==='image'&&fixed)return <FixedPhoto element={element} image={image} selected={selected} onSelect={()=>onClick(false)} onActivate={onImageSelect} onDoubleClick={onDoubleClick}/>;
  if(element.type==='image')return image?<CanvasImage {...photoProps(element,image)} {...events}/>:<Rect {...elementProps(element)} fill={failed?'#f9b8b8':'#ddd'} {...events}/>;
  if(element.type==='text'||element.type==='sticker')return <Text {...textProps(element)} {...events}/>;
  return <Rect {...elementProps(element)} cornerRadius={element.cornerRadius??0} {...events}/>;
}
function setStageCursor(node:Konva.Node,cursor:string){const container=node.getStage()?.container();if(container)container.style.cursor=cursor;}
function Overlay({url}:{url:string}){const [image,setImage]=useState<HTMLImageElement>();useEffect(()=>{let alive=true;void loadStaticImage(url).then(img=>{if(alive)setImage(img);});return()=>{alive=false;};},[url]);return image?<CanvasImage image={image} width={W} height={H} listening={false}/>:null;}
function FixedPhoto({element,image,selected,onSelect,onActivate,onDoubleClick}:{element:Element;image?:HTMLImageElement;selected:boolean;onSelect:()=>void;onActivate:()=>void;onDoubleClick:()=>void}){
  const update=useEditor(s=>s.updateElement);const group=useRef<Konva.Group>(null);
  const [preview,setPreview]=useState<Element['crop']>();
  const drag=useRef<{pointerId:number;x:number;y:number;clientX:number;clientY:number;crop:Crop;moved:boolean;target:Konva.Shape}|null>(null);
  const suppressClick=useRef(false);
  const shown={...element,crop:preview??element.crop};
  const point=()=>group.current?.getRelativePointerPosition();
  function begin(e:Konva.KonvaEventObject<PointerEvent>){
    if(e.evt.button!==0||drag.current)return;
    const p=point();if(!p)return;
    suppressClick.current=false;onSelect();
    const target=e.target as Konva.Shape;
    drag.current={...p,pointerId:e.evt.pointerId,clientX:e.evt.clientX,clientY:e.evt.clientY,crop:element.crop??centeredCrop,moved:false,target};
    target.setPointerCapture(e.evt.pointerId);e.cancelBubble=true;
  }
  function nextCrop(e:Konva.KonvaEventObject<PointerEvent>){
    const start=drag.current,p=point();if(!start||start.pointerId!==e.evt.pointerId||!p||!image)return;
    if(Math.hypot(e.evt.clientX-start.clientX,e.evt.clientY-start.clientY)>3)start.moved=true;
    if(!start.moved)return;
    return dragCrop(element,{width:image.naturalWidth,height:image.naturalHeight},start.crop,p.x-start.x,p.y-start.y);
  }
  function move(e:Konva.KonvaEventObject<PointerEvent>){const crop=nextCrop(e);if(crop)setPreview(crop);e.cancelBubble=true;}
  function finish(e:Konva.KonvaEventObject<PointerEvent>){
    const start=drag.current;if(!start||start.pointerId!==e.evt.pointerId)return;
    const crop=nextCrop(e);
    start.target.releaseCapture(e.evt.pointerId);drag.current=null;suppressClick.current=start.moved;
    if(crop&&(crop.x!==start.crop.x||crop.y!==start.crop.y))update(element.id,{crop});
    setPreview(undefined);e.cancelBubble=true;
  }
  function cancel(e:Konva.KonvaEventObject<PointerEvent>){const start=drag.current;if(!start||start.pointerId!==e.evt.pointerId)return;start.target.releaseCapture(e.evt.pointerId);drag.current=null;suppressClick.current=true;setPreview(undefined);}
  function activate(){if(suppressClick.current)return;onSelect();onActivate();}
  return <Group ref={group} id={element.id} x={element.x} y={element.y} clipFunc={frameClip(element)} onPointerDown={begin} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onClick={activate} onTap={activate} onDblClick={onDoubleClick} onDblTap={onDoubleClick} onWheel={e=>{if(!selected)return;e.evt.preventDefault();e.evt.stopPropagation();e.cancelBubble=true;const crop=element.crop??{x:.5,y:.5,zoom:1};update(element.id,{crop:{...crop,zoom:Math.max(1,Math.min(4,crop.zoom-e.evt.deltaY*.002))}});}}>{image?<CanvasImage {...photoProps({...shown,x:0,y:0,rotation:0,id:element.id+'-photo'},image)}/>:<Rect width={element.width} height={element.height} fill="#ddd"/>}{selected&&<Rect width={element.width} height={element.height} stroke="#3185ff" strokeWidth={5} listening={false}/>}</Group>;
}
