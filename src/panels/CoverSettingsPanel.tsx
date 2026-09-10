import {useEditor} from '../store/editor';
import {textElement} from '../domain/model';
import {BackCoverSettingsPanel} from './BackCoverSettingsPanel';

export function CoverSettingsPanel(){
  const s=useEditor(),book=s.book!,cover=book.pages[0],photo=cover.elements.find(e=>e.type==='image'),title=cover.elements.find(e=>e.type==='text');
  const colors=['#f5ec30','#eeeae3','#e48af5','#d9eb51','#75a4e1','#ff9658','#f6c9cc','#ffffff','#1a1a1a'];
  function text(value:string,key:'text'|'color'){s.change(b=>{let element=b.pages[0].elements.find(e=>e.type==='text');if(!element){element=textElement('TIME TO FLIPBOOK',{x:180,y:1550,width:840,height:40,fontSize:26,align:'center'});b.pages[0].elements.push(element);}element[key]=value;});}
  return <><div className="settings-section-heading"><b>前封面</b><small>封皮与标题</small></div><p className="settings-intro">设置封皮颜色、照片效果和标题。封面照片在素材库中管理，封面样式在模板库中管理。</p><p className="field-label">封皮颜色</p><div className="swatches">{colors.map(color=><button key={color} aria-label={`封皮 ${color}`} className={cover.background===color?'chosen':''} style={{backgroundColor:color}} onClick={()=>s.change(b=>{b.pages[0].background=color;})}/>)}</div><label className="field">自定义封皮颜色<input type="color" value={cover.background} onChange={e=>s.change(b=>{b.pages[0].background=e.target.value;})}/></label>{photo&&<><p className="muted">封面照片可直接拖动调整位置，滚轮调整缩放。</p><label className="field">照片模糊度<input type="range" min={0} max={20} step={.5} value={photo.blur??0} onChange={e=>s.change(b=>{const image=b.pages[0].elements.find(e=>e.type==='image');if(image)image.blur=+e.target.value;})}/><span>{photo.blur??0}</span></label></>}<label className="field stack">封面标题<input value={title?.text??''} onChange={e=>text(e.target.value,'text')}/></label><label className="field">标题颜色<input type="color" value={title?.color??'#4a3f1a'} onChange={e=>text(e.target.value,'color')}/></label><div className="settings-section-divider"/><BackCoverSettingsPanel/></>;
}
