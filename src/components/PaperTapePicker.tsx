import {paperTapeStyles,type TapeStyleId} from '../domain/tapeStyles';

const palette=['#d9c9a8','#d9b8b2','#b8c8b8','#b8c5d2','#c8b8a8','#c7c3bd'] as const;

type Props={
  styleId:TapeStyleId;
  color:string;
  opacity:number;
  onStyleChange:(style:TapeStyleId)=>void;
  onColorChange:(color:string)=>void;
  onOpacityChange:(opacity:number)=>void;
};

export function PaperTapePicker({styleId,color,opacity,onStyleChange,onColorChange,onOpacityChange}:Props){
  return <section aria-label="纸胶带" style={{marginTop:16}}>
    <p className="field-label">纸胶带</p>
    <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8}}>
      {paperTapeStyles.map(style=><button
        key={style.id}
        type="button"
        aria-pressed={styleId===style.id}
        onClick={()=>onStyleChange(style.id)}
        style={{display:'grid',gridTemplateRows:'54px auto',gap:5,padding:7,border:styleId===style.id?'2px solid #3185ff':'1px solid rgba(38,38,38,.14)',borderRadius:9,background:'rgba(255,255,255,.7)',cursor:'pointer'}}
      >
        <span style={{display:'grid',placeItems:'center',overflow:'hidden'}}><img src={style.texture} alt="" draggable={false} style={{display:'block',width:'100%',height:'42px',objectFit:'fill'}}/></span>
        <span style={{fontSize:11}}>{style.name}</span>
      </button>)}
    </div>
    <div className="tape-color-controls" style={{marginTop:10}}>
      <input type="color" aria-label="纸胶带调色盘" value={color} onChange={event=>onColorChange(event.target.value)}/>
      <span className="tape-color-swatches" aria-label="纸胶带常用颜色">{palette.map(item=><button key={item} type="button" aria-label={`使用纸胶带颜色 ${item}`} title={item} className={`tape-color-swatch ${item.toLowerCase()===color.toLowerCase()?'chosen':''}`} style={{backgroundColor:item}} onClick={()=>onColorChange(item)}/>)}</span>
    </div>
    <label className="tape-opacity-field"><span>不透明度</span><input type="range" min={.1} max={1} step={.05} value={opacity} onChange={event=>onOpacityChange(+event.target.value)}/><span>{Math.round(opacity*100)}%</span></label>
  </section>;
}
