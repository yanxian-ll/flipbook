import {bookStyleFor} from '../domain/model';
import {useEditor} from '../store/editor';
import {Button} from '../components/ui';

const pageColors=['#ffffff','#eeeae3','#f7f4ec','#f1efe8','#e9eaec','#f6c9cc','#d8e6dd','#252525'];
const textColors=['#252525','#444444','#6a6258','#8b765d','#ffffff','#1a1a1a'];
const fonts=[
  ['Domine','Domine'],
  ['Arial','Arial'],
  ['Georgia','Georgia'],
  ['KaiTi','楷体（系统字体）'],
  ['sans-serif','系统无衬线'],
] as const;

export function BookStylePanel(){
  const book=useEditor(state=>state.book)!;
  const change=useEditor(state=>state.change);
  const style=bookStyleFor(book);
  const changeStyle=(patch:Partial<typeof style>)=>change(draft=>{
    const current=bookStyleFor(draft);
    draft.bookStyle={...current,...patch};
    if(patch.pageBackground)draft.defaultPageBackground=patch.pageBackground;
  });

  function applyPageBackground(){
    change(draft=>{
      const current=bookStyleFor(draft);
      draft.defaultPageBackground=current.pageBackground;
      for(const page of draft.pages){
        if(page.type==='cover'||page.layoutId)continue;
        page.background=current.pageBackground;
      }
    });
  }

  function applyTextStyle(){
    change(draft=>{
      const current=bookStyleFor(draft);
      for(const page of draft.pages){
        if(page.type==='cover')continue;
        for(const element of page.elements){
          if(element.type!=='text')continue;
          element.fontFamily=current.fontFamily;
          element.color=current.textColor;
        }
      }
    });
  }

  return <>
    <p className="settings-intro">设置整本画册的新页面与新文字默认风格。已有内容不会自动改变，需要手动同步。</p>

    <div className="settings-section-heading"><b>页面底色</b><small>新建内页默认使用</small></div>
    <div className="swatches">{pageColors.map(color=><button key={color} aria-label={`页面底色 ${color}`} className={style.pageBackground===color?'chosen':''} style={{backgroundColor:color}} onClick={()=>changeStyle({pageBackground:color})}/>)}</div>
    <label className="field">自定义底色<input type="color" value={style.pageBackground} onChange={event=>changeStyle({pageBackground:event.target.value})}/></label>
    <Button className="full" onClick={applyPageBackground}>同步到全部普通内页</Button>
    <p className="muted">带模板背景的页面保持原样，避免破坏已经选好的版式。</p>

    <div className="settings-section-divider"/>
    <div className="settings-section-heading"><b>文字风格</b><small>新添加文字默认使用</small></div>
    <label className="field">默认字体<select value={style.fontFamily} onChange={event=>changeStyle({fontFamily:event.target.value})}>{!fonts.some(([value])=>value===style.fontFamily)&&<option value={style.fontFamily}>{style.fontFamily} · 当前作品字体</option>}{fonts.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <p className="field-label">默认文字颜色</p>
    <div className="swatches">{textColors.map(color=><button key={color} aria-label={`文字颜色 ${color}`} className={style.textColor===color?'chosen':''} style={{backgroundColor:color}} onClick={()=>changeStyle({textColor:color})}/>)}</div>
    <label className="field">自定义文字颜色<input type="color" value={style.textColor} onChange={event=>changeStyle({textColor:event.target.value})}/></label>
    <Button className="full" onClick={applyTextStyle}>同步字体与颜色到全部内页文字</Button>
    <p className="muted">只调整文字的字体与颜色，不改变字号、位置、对齐和内容。</p>
  </>;
}
