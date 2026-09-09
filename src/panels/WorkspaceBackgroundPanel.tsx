import {useRef,useState} from 'react';
import {Upload} from 'lucide-react';
import {useEditor} from '../store/editor';
import {prepareAsset} from '../domain/assets';
import {friendlyError} from '../db/repository';
import {Button,ErrorMessage} from '../components/ui';
const colors=['#e9eaec','#ffffff','#eeeae3','#f6c9cc','#d8e6dd','#dce8f4','#252525'];
export function WorkspaceBackgroundPanel(){
  const s=useEditor(),book=s.book!,input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  function color(value:string){s.change(b=>{b.workspaceBackground=value;b.workspacePattern=undefined;b.workspaceImageId=undefined;});}
  async function upload(files:FileList|null){if(!files?.[0])return;setBusy(true);setError('');try{const asset=await prepareAsset(files[0]);await s.addAssets([asset]);s.change(b=>{b.workspaceImageId=asset.id;b.workspacePattern=undefined;});}catch(e){setError(friendlyError(e));}finally{setBusy(false);if(input.current)input.current.value='';}}
  return <><p className="settings-intro">书本外面的背景，翻阅整本画册时保持一致。</p><p className="field-label">背景颜色</p><div className="swatches">{colors.map(value=><button key={value} aria-label={`垫底颜色 ${value}`} className={!book.workspacePattern&&!book.workspaceImageId&&book.workspaceBackground===value?'chosen':''} style={{backgroundColor:value}} onClick={()=>color(value)}/>)}</div><label className="field">自定义颜色<input type="color" value={book.workspaceBackground} onChange={e=>color(e.target.value)}/></label><p className="field-label">背景纹理</p><div className="background-grid">{['bg-dots.jpg','bg-grid.jpg','bg2.jpg','bg3.jpg','bg4.jpg','bg5.jpg'].map((name,i)=><button key={name} aria-label={`垫底纹理 ${['波点','格纹','纸张','织物','纹理','牛皮纸'][i]}`} className={book.workspacePattern===name?'chosen':''} style={{backgroundImage:`url(/reference/${name})`}} onClick={()=>s.change(b=>{b.workspacePattern=name;b.workspaceImageId=undefined;})}>{['波点','格纹','纸张','织物','纹理','牛皮纸'][i]}</button>)}</div><p className="field-label">自己的背景图片</p><Button className="full" disabled={busy} onClick={()=>input.current?.click()}><Upload size={16}/>{busy?'正在处理…':'上传图片作垫底背景'}</Button><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>void upload(e.target.files)}/><Button className="full" onClick={()=>color('#e9eaec')}>恢复默认背景</Button><ErrorMessage message={error}/></>;
}
