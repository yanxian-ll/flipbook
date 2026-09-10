import {useEffect,useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {Plus,X,ChevronRight} from 'lucide-react';
import {type StoredAsset,type ThemeId,newBook,uid} from '../domain/model';
import {prepareAsset,assetMetadata} from '../domain/assets';
import {autoLayout} from '../domain/layouts';
import {repository,friendlyError} from '../db/repository';
import {Modal,Button,ErrorMessage} from '../components/ui';
import {Bookshelf} from './Bookshelf';
import '../styles/create.css';

export function Create(){
  const [step,setStep]=useState(1),[theme,setTheme]=useState<ThemeId>('scrapbook'),[assets,setAssets]=useState<StoredAsset[]>([]),[error,setError]=useState(''),[processing,setProcessing]=useState(false),[progress,setProgress]=useState(''),[examples,setExamples]=useState(false),[restoredDraft,setRestoredDraft]=useState(false);
  const input=useRef<HTMLInputElement>(null),assetsRef=useRef<StoredAsset[]>([]),cancelUpload=useRef(false);
  const navigate=useNavigate();

  useEffect(()=>{assetsRef.current=assets;},[assets]);
  useEffect(()=>{
    let live=true;
    void repository.getCreateDraft().then(async draft=>{
      if(!live||!draft)return;
      const stored=await repository.getAssets(draft.assetIds);
      if(!live)return;
      setTheme(draft.themeId);
      setAssets(stored);
      assetsRef.current=stored;
      if(stored.length){setStep(2);setRestoredDraft(true);}
      if(stored.length!==draft.assetIds.length)await repository.saveCreateDraft({themeId:draft.themeId,assetIds:stored.map(asset=>asset.id),updatedAt:Date.now()});
    }).catch(cause=>{if(live)setError(friendlyError(cause));});
    return()=>{live=false;};
  },[]);

  async function persistDraft(nextAssets=assetsRef.current,nextTheme=theme){
    await repository.saveCreateDraft({themeId:nextTheme,assetIds:nextAssets.map(asset=>asset.id),updatedAt:Date.now()});
  }

  async function chooseTheme(next:ThemeId){
    setTheme(next);
    try{await persistDraft(assetsRef.current,next);}catch(cause){setError(friendlyError(cause));}
  }

  async function upload(files:FileList|File[]|null){
    if(!files)return;
    setError('');
    const batch=Array.from(files);
    if(batch.length+assetsRef.current.length>50){setError('一本最多放 50 张照片，请减少选择。');return;}
    setProcessing(true);cancelUpload.current=false;
    const uploadBatch={id:uid(),at:Date.now()};
    try{
      for(let i=0;i<batch.length;i++){
        if(cancelUpload.current)break;
        setProgress(`正在整理照片 ${i+1} / ${batch.length}`);
        const prepared=await prepareAsset(batch[i],uploadBatch);
        if(cancelUpload.current)break;
        await repository.putAssets([prepared]);
        const next=[...assetsRef.current,prepared];
        assetsRef.current=next;
        setAssets(next);
        await persistDraft(next,theme);
      }
    }catch(cause){setError(friendlyError(cause));}
    finally{setProcessing(false);setProgress('');cancelUpload.current=false;if(input.current)input.current.value='';}
  }

  async function removeAsset(asset:StoredAsset){
    const next=assetsRef.current.filter(item=>item.id!==asset.id);
    assetsRef.current=next;setAssets(next);
    try{
      await persistDraft(next,theme);
      await repository.removeAssets([asset.id]);
    }catch(cause){setError(friendlyError(cause));}
  }

  async function discardDraft(){
    const ids=assetsRef.current.map(asset=>asset.id);
    try{
      await repository.clearCreateDraft();
      if(ids.length)await repository.removeAssets(ids);
    }catch(cause){setError(friendlyError(cause));return;}
    navigate('/');
  }

  async function generate(){
    setStep(3);setError('');
    try{
      setProgress('正在挑选版式…');
      const count=(await repository.list()).length;
      const metadata=assetsRef.current.map(assetMetadata);
      const book=autoLayout(newBook(`FLIPBOOK #${String(count).padStart(3,'0')}`,theme,metadata),metadata);
      setProgress('正在装订画册…');
      await repository.create(book,assetsRef.current);
      await repository.clearCreateDraft();
      try{sessionStorage.setItem(`flipbook:auto-open-libraries:${book.id}`,'1');}catch{}
      navigate(`/editor/${book.id}`,{replace:true});
    }catch(cause){setStep(2);setError(friendlyError(cause));}
  }

  return <>
    <Bookshelf creating/>
    <Modal open onClose={()=>{if(step!==3&&!processing)void discardDraft();}} title={step===1?'今天做本什么样的？':step===2?'往书里装点内容':'Flipbook 正在装订中...'} description={step===1?'选一种感觉，Flipbook 帮你搭个调子':step===2?'推荐 8–20 张照片，最多可以放 50 张':'好东西值得等一小会儿'}>
      <div className="wizard-progress">{[1,2,3].map(n=><span key={n} className={n<=step?'on':''}/>)}</div>
      <ErrorMessage message={error}/>
      {step===1?<>
        <div className="theme-options"><label><input type="radio" checked={theme==='scrapbook'} onChange={()=>void chooseTheme('scrapbook')}/>高饱和拼贴</label><label><input type="radio" checked={theme==='editorial'} onChange={()=>void chooseTheme('editorial')}/>氛围感杂志</label></div>
        <div className="theme-preview"><img src={`/reference/${theme==='scrapbook'?'style01':'style02'}.jpg`} alt={theme==='scrapbook'?'高饱和拼贴示例':'氛围感杂志示例'}/></div>
        <button className="examples-link" onClick={()=>setExamples(true)}>点我查看更多示例页 <ChevronRight size={13}/></button>
        <div className="actions"><Button onClick={()=>void discardDraft()}>取消</Button><Button className="primary" onClick={()=>{void persistDraft();setStep(2);}}>就它了</Button></div>
      </>:step===2?<>
        {restoredDraft&&<p className="create-draft-restored">已恢复上次未完成的创建草稿，照片已经保存在本机。</p>}
        <div className={`upload-zone ${assets.length?'filled':''}`} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();if(!processing)void upload(event.dataTransfer.files);}}>
          {assets.length?<div className="upload-grid">{assets.map(asset=><UploadThumb key={asset.id} asset={asset} remove={()=>void removeAsset(asset)}/>)}<button aria-label="继续添加照片" className="upload-add" disabled={processing} onClick={()=>input.current?.click()}><Plus/></button></div>:<button className="upload-empty" disabled={processing} onClick={()=>input.current?.click()}><Plus size={36} strokeWidth={1.4}/><span>还是空的，点这里加照片吧</span><small>也可以把照片拖到这里</small></button>}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple hidden aria-label="上传照片" onChange={event=>void upload(event.target.files)}/>
        <div className="upload-count">{processing?<><span>{progress}</span><button type="button" className="upload-cancel" onClick={()=>{cancelUpload.current=true;}}>取消处理</button></>:`已选 ${assets.length} / 50`}</div>
        <div className="actions"><Button disabled={processing} onClick={()=>setStep(1)}>上一步</Button><Button className="primary" disabled={processing||assets.length<3} onClick={()=>void generate()}>选好了</Button></div>
        {assets.length>0&&assets.length<3&&<p className="muted centered">至少选择 3 张照片</p>}
      </>:<div className="generation"><div className="binding-animation"><span/><span/><span/><span/><span/></div><p>{progress}</p></div>}
    </Modal>
    <Modal open={examples} onClose={()=>setExamples(false)} title="翻翻看，找到你的感觉" wide><div className="example-gallery"><img src="/reference/style01.jpg" alt="拼贴示例"/><img src="/reference/style02.jpg" alt="杂志示例"/></div></Modal>
  </>;
}

function UploadThumb({asset,remove}:{asset:StoredAsset;remove:()=>void}){
  const [url,setUrl]=useState('');
  useEffect(()=>{const next=URL.createObjectURL(asset.thumbnail);setUrl(next);return()=>URL.revokeObjectURL(next);},[asset]);
  return <div className="upload-thumb"><img src={url} alt={asset.name}/><button aria-label={`移除 ${asset.name}`} onClick={remove}><X size={12}/></button></div>;
}