import {useEffect,useRef,useState} from 'react';
import {Stage,Layer,Rect,Text,Image as CanvasImage,Transformer,Line,Group} from 'react-konva';
import Konva from 'konva';
import type {Element,Page} from '../domain/model';
import {W,H,visualPageBackground} from '../domain/model';
import {effectiveTemplateOverlay,pageTemplateDecorations} from '../domain/templateDecorations';
import {useEditor} from '../store/editor';
import {dragCrop,centeredCrop,type Crop} from '../domain/crop';
import {frameIsFixed} from '../domain/layouts';
import {elementProps,textLayout,textProps,photoProps,pageTextureProps,loadAssetImage,loadStaticImage,frameClip,loadPageFonts,templateDecorationProps} from './renderer';

export function EditorCanvas({page,width,onTextEdit,onCrop,onImageSelect,onBackgroundClick}:{page:Page;width:number;onTextEdit:()=>void;onCrop:()=>void;onImageSelect?:()=>void;onBackgroundClick?:()=>void}){
  const transformer=useRef<Konva.Transformer>(null);
  const stage=useRef<Konva.Stage>(null);
  const knownElementIds=useRef(new Set(page.elements.map(element=>element.id)));
  const selected=useEditor(s=>s.selected);
  const select=useEditor(s=>s.select);
  const update=useEditor(s=>s.updateElement);
  const scale=width/W;
  const [guides,setGuides]=useState<{x?:number;y?:number}>({});
  const [editingTextId,setEditingTextId]=useState<string|null>(null);
  const [selectAllText,setSelectAllText]=useState(false);
  const editingText=editingTextId?page.elements.find(element=>element.id===editingTextId&&element.type==='text'):undefined;

  useEffect(()=>{
    if(!stage.current||!transformer.current)return;
    const nodes=selected.filter(id=>{
      if(id===editingTextId)return false;
      const e=page.elements.find(element=>element.id===id);
      return e&&!e.locked&&!frameIsFixed(page,e);
    }).map(id=>stage.current!.findOne(`#${id}`)).filter(Boolean) as Konva.Node[];
    transformer.current.nodes(nodes);
    transformer.current.getLayer()?.batchDraw();
  },[selected,page,editingTextId]);
  useEffect(()=>{void loadPageFonts(page).then(()=>stage.current?.batchDraw());},[page]);
  useEffect(()=>{
    setEditingTextId(null);
    setSelectAllText(false);
    knownElementIds.current=new Set(page.elements.map(element=>element.id));
  },[page.id]);
  useEffect(()=>{
    const previous=knownElementIds.current;
    const next=new Set(page.elements.map(element=>element.id));
    const addedText=page.elements.find(element=>element.type==='text'&&selected.includes(element.id)&&!previous.has(element.id));
    knownElementIds.current=next;
    if(!addedText)return;
    setSelectAllText(true);
    setEditingTextId(addedText.id);
  },[page.elements,selected]);

  function snap(node:Konva.Node){
    const element=page.elements.find(e=>e.id===node.id());if(!element)return;
    const nodeWidth=node.width(),nodeHeight=node.height();
    const xTargets=[0,W/2,W,...page.elements.filter(e=>e.id!==element.id).flatMap(e=>[e.x,e.x+e.width/2,e.x+e.width])];
    const yTargets=[0,H/2,H,...page.elements.filter(e=>e.id!==element.id).flatMap(e=>[e.y,e.y+e.height/2,e.y+e.height])];
    const next:{x?:number;y?:number}={};
    for(const offset of [0,nodeWidth/2,nodeWidth]){const target=xTargets.find(x=>Math.abs(node.x()+offset-x)<8/scale);if(target!==undefined){node.x(target-offset);next.x=target;break;}}
    for(const offset of [0,nodeHeight/2,nodeHeight]){const target=yTargets.find(y=>Math.abs(node.y()+offset-y)<8/scale);if(target!==undefined){node.y(target-offset);next.y=target;break;}}
    setGuides(next);
  }
  const pageHasImage=page.elements.some(element=>element.type==='image');
  const rotateIconPx=14;
  const rotateOffset=32/scale;
  const templateOverlay=effectiveTemplateOverlay(page);
  const templateDecorations=pageTemplateDecorations(page);
  const hasTemplateLayer=!!templateOverlay||templateDecorations.length>0;
  function backgroundClick(){setEditingTextId(null);setSelectAllText(false);select(null);if(!pageHasImage)onBackgroundClick?.();}
  function editText(element:Element){
    select(element.id);
    setSelectAllText(false);
    setEditingTextId(element.id);
    onTextEdit();
  }

  return <div className="page-canvas" aria-label="画册编辑画布">
    <Stage
      ref={stage}
      width={width}
      height={H*scale}
      scaleX={scale}
      scaleY={scale}
      onMouseDown={e=>{if(e.target===e.target.getStage()||e.target.name()==='page-background')backgroundClick();}}
      onTouchStart={e=>{if(e.target===e.target.getStage()||e.target.name()==='page-background')backgroundClick();}}
    >
      <Layer>
        <Rect name="page-background" width={W} height={H} fill={visualPageBackground(page)}/>
        <Pattern pattern={page.pattern} assetId={page.patternAssetId}/>
        {(hasTemplateLayer?[page.elements.filter(e=>e.type==='image'),page.elements.filter(e=>e.type!=='image')]:[page.elements]).map((elements,index)=><Group key={index}>
          {index===1&&templateOverlay&&<Overlay url={templateOverlay}/>} 
          {index===1&&templateDecorations.map(decoration=><Rect key={decoration.id} {...templateDecorationProps(decoration)}/>)}
          {elements.map(element=><CanvasElement
            key={element.id}
            fixed={frameIsFixed(page,element)}
            selected={selected.includes(element.id)}
            editing={editingTextId===element.id}
            element={element}
            onClick={multi=>{select(element.id,multi);}}
            onImageSelect={()=>{if(element.type==='image')onImageSelect?.();}}
            onDoubleClick={()=>{
              if(element.type==='text'){editText(element);return;}
              select(element.id);
              if(element.type==='sticker')onTextEdit();
              if(element.type==='image')onCrop();
            }}
            onDragMove={snap}
            onCommit={node=>{
              const fittedText=element.type==='text';
              const baseWidth=fittedText?node.width():element.width;
              const baseHeight=fittedText?node.height():element.height;
              update(element.id,{x:node.x(),y:node.y(),width:Math.max(20,baseWidth*node.scaleX()),height:Math.max(20,baseHeight*node.scaleY()),rotation:node.rotation()});
              node.scaleX(1);node.scaleY(1);setGuides({});
            }}
          />)}
        </Group>)}
        {guides.x!==undefined&&<Line points={[guides.x,0,guides.x,H]} stroke="#e53478" strokeWidth={1/scale} listening={false}/ >}
        {guides.y!==undefined&&<Line points={[0,guides.y,W,guides.y]} stroke="#e53478" strokeWidth={1/scale} listening={false}/>} 
        <Transformer
          ref={transformer}
          rotateEnabled
          rotationSnaps={[0,90,180,270,360]}
          rotationSnapTolerance={8}
          rotateAnchorOffset={rotateOffset}
          flipEnabled={false}
          borderStroke="#3185ff"
          anchorStroke="#3185ff"
          anchorFill="#fff"
          anchorSize={7}
          padding={2}
          anchorStyleFunc={anchor=>{
            if(!anchor.hasName('rotater'))return;
            const factor=rotateIconPx/Math.max(1,anchor.width()*scale);
            anchor.scale({x:factor,y:factor});
            anchor.opacity(1);
            anchor.fill('#fff');
            anchor.stroke('#3185ff');
            anchor.strokeWidth(.65);
            anchor.cornerRadius(0);
            anchor.sceneFunc((context,shape)=>{
              const w=shape.width(),h=shape.height(),cx=w/2,cy=h/2,r=Math.min(w,h)*.31,start=.58,end=5.54,ex=cx+r*Math.cos(end),ey=cy+r*Math.sin(end),direction=end+Math.PI/2,head=Math.min(w,h)*.17;
              context.beginPath();
              context.arc(cx,cy,r,start,end,false);
              context.moveTo(ex,ey);
              context.lineTo(ex+head*Math.cos(direction+2.48),ey+head*Math.sin(direction+2.48));
              context.moveTo(ex,ey);
              context.lineTo(ex+head*Math.cos(direction-2.48),ey+head*Math.sin(direction-2.48));
              context.strokeShape(shape);
            });
          }}
          boundBoxFunc={(oldBox,newBox)=>Math.abs(newBox.width)<12||Math.abs(newBox.height)<12?oldBox:newBox}
        />
      </Layer>
    </Stage>
    {editingText&&<InlineTextEditor element={editingText} scale={scale} selectAll={selectAllText} onChange={value=>update(editingText.id,{text:value})} onClose={()=>{setEditingTextId(null);setSelectAllText(false);}}/>} 
  </div>;
}

function InlineTextEditor({element,scale,selectAll,onChange,onClose}:{element:Element;scale:number;selectAll:boolean;onChange:(value:string)=>void;onClose:()=>void}){
  const input=useRef<HTMLTextAreaElement>(null);
  const layout=textLayout(element);
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      const node=input.current;if(!node)return;
      node.focus();
      if(selectAll)node.select();
      else node.setSelectionRange(node.value.length,node.value.length);
    },80);
    return()=>window.clearTimeout(timer);
  },[selectAll]);
  return <textarea
    ref={input}
    className="canvas-inline-text-editor"
    aria-label="画布文字编辑"
    value={element.text??''}
    spellCheck={false}
    onChange={event=>onChange(event.target.value)}
    onBlur={onClose}
    onPointerDown={event=>event.stopPropagation()}
    onMouseDown={event=>event.stopPropagation()}
    onKeyDown={event=>{
      if(event.key==='Escape'||(event.key==='Enter'&&(event.metaKey||event.ctrlKey))){event.preventDefault();event.stopPropagation();event.currentTarget.blur();}
    }}
    style={{
      position:'absolute',
      zIndex:20,
      left:layout.x*scale,
      top:layout.y*scale,
      width:Math.max(80,layout.width*scale+8),
      height:Math.max(30,layout.height*scale+8),
      margin:0,
      padding:'3px 4px',
      resize:'none',
      overflow:'hidden',
      boxSizing:'border-box',
      border:'1px solid #3185ff',
      borderRadius:2,
      outline:'none',
      background:'rgba(255,255,255,.96)',
      color:element.color??'#252525',
      fontFamily:element.fontFamily??'Domine',
      fontSize:Math.max(12,(element.fontSize??60)*scale),
      fontWeight:element.fontWeight??400,
      fontStyle:element.fontStyle??'normal',
      lineHeight:element.lineHeight??1.2,
      letterSpacing:`${(element.letterSpacing??0)*scale}px`,
      textAlign:element.align??'left',
      transform:`rotate(${element.rotation??0}deg)`,
      transformOrigin:'top left',
      whiteSpace:'pre-wrap',
      wordBreak:'break-word',
    }}
  />;
}

function Pattern({pattern,assetId}:{pattern?:string;assetId?:string}){const [image,setImage]=useState<HTMLImageElement>();useEffect(()=>{let alive=true;setImage(undefined);const task=assetId?loadAssetImage(assetId):pattern?loadStaticImage(`/reference/${pattern}`):null;if(task)void task.then(img=>{if(alive)setImage(img);}).catch(()=>{});return()=>{alive=false;};},[pattern,assetId]);return image?<CanvasImage {...pageTextureProps(image)} />:null;}
function CanvasElement({element,fixed,selected,editing,onClick,onImageSelect,onDoubleClick,onCommit,onDragMove}:{element:Element;fixed:boolean;selected:boolean;editing:boolean;onClick:(multi:boolean)=>void;onImageSelect:()=>void;onDoubleClick:()=>void;onCommit:(node:Konva.Node)=>void;onDragMove:(node:Konva.Node)=>void}){
  const [image,setImage]=useState<HTMLImageElement>();const [failed,setFailed]=useState(false);
  useEffect(()=>{let live=true;setImage(undefined);setFailed(false);if(element.assetId)void loadAssetImage(element.assetId).then(img=>{if(live)setImage(img);}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[element.assetId]);
  const movable=element.type==='text'||element.type==='sticker';
  const events={draggable:!element.locked,onClick:(e:Konva.KonvaEventObject<MouseEvent>)=>{onClick(e.evt.shiftKey);onImageSelect();},onTap:()=>{onClick(false);onImageSelect();},onDblClick:onDoubleClick,onDblTap:onDoubleClick,onMouseEnter:(e:Konva.KonvaEventObject<MouseEvent>)=>{if(movable&&!element.locked)setStageCursor(e.target,'move');},onMouseLeave:(e:Konva.KonvaEventObject<MouseEvent>)=>{if(movable)setStageCursor(e.target,'default');},onDragStart:(e:Konva.KonvaEventObject<DragEvent>)=>{onClick(false);if(movable)setStageCursor(e.target,'grabbing');},onDragMove:(e:Konva.KonvaEventObject<DragEvent>)=>onDragMove(e.target),onDragEnd:(e:Konva.KonvaEventObject<DragEvent>)=>{onCommit(e.target);if(movable)setStageCursor(e.target,'move');},onTransformEnd:(e:Konva.KonvaEventObject<Event>)=>onCommit(e.target)};
  if(element.type==='image'&&fixed)return <FixedPhoto element={element} image={image} selected={selected} onSelect={()=>onClick(false)} onActivate={onImageSelect} onDoubleClick={onDoubleClick}/>;
  if(element.type==='image')return image?<CanvasImage {...photoProps(element,image)} {...events}/>:<Rect {...elementProps(element)} fill={failed?'#f9b8b8':'#ddd'} {...events}/>;
  if(element.type==='text'||element.type==='sticker')return <Text {...textProps(element)} {...events} visible={!editing}/>;
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
