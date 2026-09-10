import {backCoverFor} from '../domain/model';
import {useEditor} from '../store/editor';

const colors=['#e8e2cf','#eeeae3','#ffffff','#f5ec30','#e48af5','#75a4e1','#f6c9cc','#1a1a1a'];

export function BackCoverSettingsPanel(){
  const s=useEditor(),book=s.book!,back=backCoverFor(book);
  const change=(patch:Partial<typeof back>)=>s.change(draft=>{
    draft.backCover={...backCoverFor(draft),...patch};
  });
  const custom=back.mode==='custom';

  return <section className="back-cover-settings">
    <div className="settings-section-heading"><b>后封面</b><small>翻到最后一页时显示</small></div>
    <div className="segments back-cover-mode" role="group" aria-label="后封面模式">
      <button type="button" className={back.mode==='match-front'?'selected':''} onClick={()=>change({mode:'match-front'})}>跟随前封面</button>
      <button type="button" className={back.mode==='solid'?'selected':''} onClick={()=>change({mode:'solid'})}>纯色</button>
      <button type="button" className={back.mode==='custom'?'selected':''} onClick={()=>change({mode:'custom'})}>独立编辑</button>
    </div>

    {back.mode!=='match-front'&&<>
      <p className="field-label">后封面颜色</p>
      <div className="swatches">{colors.map(color=><button key={color} aria-label={`后封面 ${color}`} className={back.background===color?'chosen':''} style={{backgroundColor:color}} onClick={()=>change({background:color})}/>)}</div>
      <label className="field">自定义颜色<input type="color" value={back.background} onChange={event=>change({background:event.target.value})}/></label>
    </>}

    {custom&&<>
      <label className="field stack">后封面照片
        <select value={back.assetId??''} onChange={event=>change({assetId:event.target.value||undefined,crop:{x:.5,y:.5,zoom:1}})}>
          <option value="">不放照片</option>
          {book.assets.map(asset=><option key={asset.id} value={asset.id}>{asset.name}</option>)}
        </select>
      </label>
      {back.assetId&&<div className="back-cover-crop">
        {(['x','y','zoom'] as const).map((key,index)=><label key={key} className="field">{['水平位置','垂直位置','照片缩放'][index]}
          <input type="range" min={key==='zoom'?1:0} max={key==='zoom'?4:1} step={.01} value={(back.crop??{x:.5,y:.5,zoom:1})[key]} onChange={event=>change({crop:{...(back.crop??{x:.5,y:.5,zoom:1}),[key]:Number(event.target.value)}})}/>
        </label>)}
      </div>}
      <label className="field stack">后封面文字
        <textarea rows={3} value={back.text??''} placeholder="例如：日期、地点或一句话" onChange={event=>change({text:event.target.value})}/>
      </label>
      <label className="field">文字颜色<input type="color" value={back.textColor??'#4a3f1a'} onChange={event=>change({textColor:event.target.value})}/></label>
    </>}
    {back.mode==='match-front'&&<p className="muted">使用前封面的封皮颜色与材质，保持一本书的前后统一。</p>}
  </section>;
}
