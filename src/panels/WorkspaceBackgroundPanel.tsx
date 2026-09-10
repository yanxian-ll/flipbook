import {useRef,useState} from 'react';
import {Upload} from 'lucide-react';
import {useEditor} from '../store/editor';
import {prepareAsset} from '../domain/assets';
import {friendlyError} from '../db/repository';
import {Button,ErrorMessage} from '../components/ui';

const workspaceColors=[
  ['#e9eaec','雾灰'],
  ['#ddd9d1','暖灰'],
  ['#cfc7bb','亚麻'],
  ['#cfd9d6','雾绿'],
  ['#d5dce5','雾蓝'],
  ['#b9b0a4','石褐'],
  ['#262728','深灰'],
] as const;
const workspacePatterns=[
  ['', '无纹理'],
  ['bg3.jpg','织物'],
  ['bg4.jpg','粗纸'],
  ['bg5.jpg','牛皮纸'],
] as const;

export function WorkspaceBackgroundPanel(){
  const book=useEditor(state=>state.book)!;
  const change=useEditor(state=>state.change);
  const addAssets=useEditor(state=>state.addAssets);
  const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  function color(value:string){change(b=>{b.workspaceBackground=value;});}
  function pattern(value:string){change(b=>{b.workspacePattern=value||undefined;b.workspaceImageId=undefined;});}
  function reset(){change(b=>{b.workspaceBackground='#e9eaec';b.workspacePattern=undefined;b.workspaceImageId=undefined;});}
  async function upload(files:FileList|null){if(!files?.[0])return;setBusy(true);setError('');try{const asset=await prepareAsset(files[0]);await addAssets([asset]);change(b=>{b.workspaceImageId=asset.id;b.workspacePattern=undefined;});}catch(e){setError(friendlyError(e));}finally{setBusy(false);if(input.current)input.current.value='';}}

  return <div className="workspace-background-panel">
    <p className="settings-intro">设置整本画册外部的环境背景。底色与纹理会叠加显示；上传自己的图片时会替代纹理。</p>
    <p className="field-label">环境底色</p>
    <div className="swatches">{workspaceColors.map(([value,label])=><button key={value} title={label} aria-label={`环境底色 ${label}`} className={book.workspaceBackground===value?'chosen':''} style={{backgroundColor:value}} onClick={()=>color(value)}/>)}</div>
    <label className="field">自定义颜色<input type="color" value={book.workspaceBackground} onChange={e=>color(e.target.value)}/></label>
    <p className="field-label">大背景纹理</p>
    <div className="background-grid">{workspacePatterns.map(([name,label])=><button key={name||'none'} aria-label={`大背景纹理 ${label}`} className={(book.workspacePattern??'')===name&&!book.workspaceImageId?'chosen':''} style={name?{backgroundImage:`url(/reference/${name})`}:{}} onClick={()=>pattern(name)}>{label}</button>)}</div>
    <p className="field-label">自己的背景图片</p>
    <Button className="full" disabled={busy} onClick={()=>input.current?.click()}><Upload size={16}/>{busy?'正在处理…':'上传图片作垫底背景'}</Button>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>void upload(e.target.files)}/>
    <Button className="full" onClick={reset}>恢复默认背景</Button>
    <ErrorMessage message={error}/>
  </div>;
}
