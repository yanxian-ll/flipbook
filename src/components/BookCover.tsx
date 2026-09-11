import {useEffect,useState,type CSSProperties} from 'react';
import {H,W,backCoverFor,backCoverPage,bookStyleFor,coverTemplateFor,type Book,type CoverTemplate,type Element} from '../domain/model';
import {frontCoverRenderPage} from '../domain/coverPresentation';
import {batchUpdateBackCoverElements,updateBackCoverElement} from '../domain/backCoverElements';
import {repository} from '../db/repository';
import {useEditor} from '../store/editor';
import {EditorCanvas} from '../editor/EditorCanvas';

function useAssetImage(assetId:string|undefined,quality:'thumbnail'|'preview'='thumbnail'){
  const [src,setSrc]=useState('');
  useEffect(()=>{
    let url='',disposed=false;
    setSrc('');
    if(assetId)void repository.getAsset(assetId).then(asset=>{
      if(asset&&!disposed){
        url=URL.createObjectURL(asset[quality]);
        setSrc(url);
      }
    }).catch(()=>{});
    return()=>{disposed=true;if(url)URL.revokeObjectURL(url);};
  },[assetId,quality]);
  return src;
}
function useCoverImage(book:Book,quality:'thumbnail'|'preview'='thumbnail'){
  return useAssetImage(book.pages[0].elements.find(element=>element.type==='image')?.assetId,quality);
}

function coverCropStyle(image?:Element){
  const crop=image?.crop??{x:.5,y:.5,zoom:1};
  return {
    objectPosition:`${crop.x*100}% ${crop.y*100}%`,
    transform:`scale(${crop.zoom})`,
    transformOrigin:`${crop.x*100}% ${crop.y*100}%`,
    filter:`blur(${Math.max(0,image?.blur??0)}px)`,
  };
}
function coverTemplateClass(template:CoverTemplate){
  if(template.id==='plain'||!template.slot)return 'plain';
  return template.id==='basic'||template.id==='cutout'?template.id:'custom';
}
function coverFrameStyle(template:CoverTemplate):CSSProperties|undefined{
  const slot=template.slot;
  if(!slot)return undefined;
  return {
    left:`${slot.x*100}%`,
    top:`${slot.y*100}%`,
    width:`${slot.width*100}%`,
    height:`${slot.height*100}%`,
    borderRadius:slot.shape==='ellipse'?'50%':undefined,
  };
}
function coverElementGeometry(element:Element):CSSProperties{
  return {
    position:'absolute',
    left:`${element.x/W*100}%`,
    top:`${element.y/H*100}%`,
    bottom:'auto',
    width:`${element.width/W*100}%`,
    minHeight:`${Math.max(element.height,(element.fontSize??26)*(element.lineHeight??1.2))/H*100}%`,
    transform:`rotate(${element.rotation??0}deg)`,
    transformOrigin:'top left',
    opacity:element.opacity??1,
  };
}
function coverTextStyle(element:Element):CSSProperties{
  return {
    ...coverElementGeometry(element),
    color:element.color??'#4a3f1a',
    fontFamily:element.fontFamily??'Domine',
    fontSize:`${((element.fontSize??26)/W)*100}cqw`,
    fontWeight:element.fontWeight??400,
    fontStyle:element.fontStyle??'normal',
    lineHeight:element.lineHeight??1.2,
    letterSpacing:`${((element.letterSpacing??0)/W)*100}cqw`,
    textAlign:element.align??'center',
    whiteSpace:'pre-wrap',
    overflow:'visible',
    pointerEvents:'none',
    zIndex:element.type==='sticker'?7:6,
  };
}
function CoverFreeElements({elements}:{elements:Element[]}){
  return <>{elements.filter(element=>element.type==='text'||element.type==='sticker').map(element=><span key={element.id} className={element.type==='sticker'?'cover-sticker':'cover-caption'} style={coverTextStyle(element)}>{element.text??''}</span>)}</>;
}

function CoverContents({book,cropOverride,quality='thumbnail'}:{book:Book;cropOverride?:Element['crop'];quality?:'thumbnail'|'preview'}){
  const src=useCoverImage(book,quality);
  const cover=book.pages[0];
  const image=cover.elements.find(element=>element.type==='image');
  const template=coverTemplateFor(book,book.coverTemplate);
  const shownImage=image&&cropOverride?{...image,crop:cropOverride}:image;
  return <>
    <span className="cover-grain"/>
    <span className="cover-spine"/>
    {template.slot&&src&&<span className="cover-window" style={coverFrameStyle(template)}><img className="cover-window-image" src={src} alt="画册封面照片" style={coverCropStyle(shownImage)}/></span>}
    <CoverFreeElements elements={cover.elements}/>
  </>;
}

export function BookCoverVisual({book,className='',cropOverride}:{book:Book;className?:string;cropOverride?:Element['crop']}){
  const cover=book.pages[0],template=coverTemplateFor(book,book.coverTemplate);
  return <div className={`book-cover ${coverTemplateClass(template)} ${className}`.trim()} style={{backgroundColor:cover.background,containerType:'inline-size'}}><CoverContents book={book} cropOverride={cropOverride} quality="preview"/></div>;
}

export function BookCover({book,onClick}:{book:Book;onClick?:()=>void}){
  const cover=book.pages[0],template=coverTemplateFor(book,book.coverTemplate);
  return <button className={`book-cover ${coverTemplateClass(template)}`} style={{backgroundColor:cover.background,containerType:'inline-size'}} onClick={onClick} aria-label={`打开 ${book.title}`}><CoverContents book={book}/></button>;
}

export function BookBackCoverVisual({book,className=''}:{book:Book;className?:string}){
  const back=backCoverFor(book);
  const template=coverTemplateFor(book,back.templateId);
  const background=back.backgroundMode==='match-front'?(book.pages[0]?.background??back.background):back.background;
  const src=useAssetImage(back.assetId,'preview');
  const style=bookStyleFor(book);
  return <div className={`book-back-cover ${coverTemplateClass(template)} ${className}`.trim()} style={{backgroundColor:background,containerType:'inline-size'}}>
    <span className="cover-grain"/>
    <span className="cover-spine"/>
    {template.slot&&src&&<span className="back-cover-window" style={coverFrameStyle(template)}><img src={src} alt="画册后封面照片" style={coverCropStyle({crop:back.crop} as Element)}/></span>}
    {back.text.trim()&&<span className="back-cover-caption" style={{color:back.textColor??style.textColor,fontFamily:style.fontFamily}}>{back.text}</span>}
    <CoverFreeElements elements={back.elements}/>
  </div>;
}

export function BookCoverEditor({
  book,
  width,
  onTextEdit,
  onImageSelect,
  onOpen,
}:{
  book:Book;
  width:number;
  onTextEdit:()=>void;
  onImageSelect:()=>void;
  onOpen:()=>void;
}){
  const page=frontCoverRenderPage(book);
  return <div className="book-cover-editor" style={{position:'relative',width,height:width*H/W,overflow:'hidden'}}>
    <EditorCanvas page={page} width={width} onTextEdit={onTextEdit} onCrop={()=>{}} onImageSelect={onImageSelect} onBackgroundClick={onOpen}/>
    <span className="cover-grain" style={{zIndex:18,pointerEvents:'none'}}/>
    <span className="cover-spine" style={{zIndex:19,pointerEvents:'none'}}/>
  </div>;
}

export function BookBackCoverEditor({book,width,onTextEdit,onImageSelect}:{book:Book;width:number;onTextEdit:()=>void;onImageSelect:()=>void}){
  const page=backCoverPage(book);
  const selected=useEditor(state=>state.selected);
  const select=useEditor(state=>state.select);
  const change=useEditor(state=>state.change);
  const update=(id:string,patch:Partial<Element>)=>change(draft=>updateBackCoverElement(draft,id,patch));
  const updateBatch=(updates:Array<{id:string;patch:Partial<Element>}>)=>change(draft=>batchUpdateBackCoverElements(draft,updates));
  return <div className="book-cover-editor back-cover-editor" style={{position:'relative',width,height:width*H/W,overflow:'hidden'}}>
    <EditorCanvas
      page={page}
      width={width}
      onTextEdit={onTextEdit}
      onCrop={()=>{}}
      onImageSelect={onImageSelect}
      selectedIds={selected}
      onSelectElement={select}
      onUpdateElement={update}
      onBatchUpdate={updateBatch}
    />
    <span className="cover-grain" style={{zIndex:18,pointerEvents:'none'}}/>
    <span className="cover-spine" style={{left:'auto',right:0,zIndex:19,pointerEvents:'none',transform:'scaleX(-1)'}}/>
  </div>;
}