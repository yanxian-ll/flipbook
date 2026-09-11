import {Images,LayoutTemplate} from 'lucide-react';
import {Button} from '../components/ui';
import {backCoverFor,coverTemplateFor} from '../domain/model';
import {useCoverContext} from '../store/coverContext';
import {useEditor} from '../store/editor';

const colors=['#f5ec30','#eeeae3','#e48af5','#d9eb51','#75a4e1','#ff9658','#f6c9cc','#ffffff','#1a1a1a'];
const PHOTO_BLUR_MAX=20;

function blurToSlider(blur:number){
  const normalized=Math.max(0,Math.min(PHOTO_BLUR_MAX,blur))/PHOTO_BLUR_MAX;
  return Math.round(Math.sqrt(normalized)*100);
}
function sliderToBlur(value:number){
  const normalized=Math.max(0,Math.min(100,value))/100;
  return Math.round(normalized*normalized*PHOTO_BLUR_MAX*10)/10;
}

export function CoverSettingsPanel({onPanel}:{onPanel:(panel:'photos'|'layouts')=>void}){
  const book=useEditor(state=>state.book)!;
  const change=useEditor(state=>state.change);
  const cover=book.pages[0];
  const contextSide=useCoverContext(state=>state.side);
  const setSide=useCoverContext(state=>state.setSide);
  const side=contextSide??'front';
  const frontPhoto=cover.elements.find(element=>element.type==='image');
  const back=backCoverFor(book);
  const templateId=side==='front'?book.coverTemplate:back.templateId;
  const template=coverTemplateFor(book,templateId);
  const assetId=side==='front'?frontPhoto?.assetId:back.assetId;
  const assetName=assetId?(book.assets.find(asset=>asset.id===assetId)?.name??'素材已缺失'):'未选择照片';

  function updateBack(patch:Partial<ReturnType<typeof backCoverFor>>){
    change(draft=>{
      const current=backCoverFor(draft);
      const next={...current,...patch};
      draft.backCover={
        ...draft.backCover,
        backgroundMode:next.backgroundMode,
        background:next.background,
        templateId:next.templateId,
        assetId:next.assetId,
        crop:next.crop,
        text:next.text,
        textColor:next.textColor,
        mode:next.backgroundMode==='match-front'?'match-front':next.templateId==='plain'?'solid':'custom',
      };
    });
  }

  return <>
    <div className="segments back-cover-mode" style={{gridTemplateColumns:'repeat(2,1fr)'}} role="tablist" aria-label="选择封面">
      <button type="button" role="tab" aria-selected={side==='front'} className={side==='front'?'selected':''} onClick={()=>setSide('front')}>前封面</button>
      <button type="button" role="tab" aria-selected={side==='back'} className={side==='back'?'selected':''} onClick={()=>setSide('back')}>后封面</button>
    </div>

    <div className="settings-section-heading" style={{marginTop:14}}><b>当前模板 · {template.name}</b><small title={assetName}>{assetName}</small></div>
    <div className="segments">
      <Button onClick={()=>onPanel('photos')}><Images size={14}/>选择照片</Button>
      <Button onClick={()=>onPanel('layouts')}><LayoutTemplate size={14}/>选择模板</Button>
    </div>
    {!template.slot&&assetId&&<p className="muted">当前模板不显示照片，已选择的照片会保留；切换到带照片窗口的模板后会重新显示。</p>}

    <div className="settings-section-divider"/>
    {side==='front'?<>
      <div className="settings-section-heading"><b>前封面样式</b><small>颜色与照片效果独立于模板</small></div>
      <p className="settings-intro">模板只控制照片窗口的位置和大小；封皮颜色和照片效果不会因为更换模板而被覆盖。封面文字请直接使用底部“文字”工具编辑。</p>
      <p className="field-label">封皮颜色</p>
      <div className="swatches">{colors.map(color=><button key={color} aria-label={`封皮 ${color}`} className={cover.background===color?'chosen':''} style={{backgroundColor:color}} onClick={()=>change(draft=>{draft.pages[0].background=color;draft.pages[0].templateBackground=undefined;})}/>)}</div>
      <label className="field">自定义封皮颜色<input type="color" value={cover.background} onChange={event=>change(draft=>{draft.pages[0].background=event.target.value;draft.pages[0].templateBackground=undefined;})}/></label>
      {frontPhoto&&<label className="field">照片模糊度<input type="range" min={0} max={100} step={1} value={blurToSlider(frontPhoto.blur??0)} aria-valuetext={`${(frontPhoto.blur??0).toFixed(1)} px`} onChange={event=>change(draft=>{const image=draft.pages[0].elements.find(element=>element.type==='image');if(image)image.blur=sliderToBlur(+event.target.value);})}/><span>{(frontPhoto.blur??0).toFixed(1)} px</span></label>}
    </>:<>
      <div className="settings-section-heading"><b>后封面样式</b><small>颜色独立于模板</small></div>
      <p className="settings-intro">模板只决定后封面是否显示照片以及照片窗口的位置。背景颜色在这里控制；后封面文字请翻到后封面后使用底部“文字”工具编辑。</p>
      <div className="segments back-cover-mode" style={{gridTemplateColumns:'repeat(2,1fr)'}} role="group" aria-label="后封面背景方式">
        <button type="button" className={back.backgroundMode==='match-front'?'selected':''} onClick={()=>updateBack({backgroundMode:'match-front'})}>跟随前封面</button>
        <button type="button" className={back.backgroundMode==='custom'?'selected':''} onClick={()=>updateBack({backgroundMode:'custom'})}>自定义颜色</button>
      </div>
      {back.backgroundMode==='custom'&&<>
        <p className="field-label">后封面颜色</p>
        <div className="swatches">{colors.map(color=><button key={color} aria-label={`后封面 ${color}`} className={back.background===color?'chosen':''} style={{backgroundColor:color}} onClick={()=>updateBack({background:color})}/>)}</div>
        <label className="field">自定义颜色<input type="color" value={back.background} onChange={event=>updateBack({background:event.target.value})}/></label>
      </>}
    </>}
  </>;
}
