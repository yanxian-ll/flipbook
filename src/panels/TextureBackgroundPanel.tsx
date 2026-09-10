import {useEffect,useMemo,useRef,useState} from 'react';
import {Upload,X} from 'lucide-react';
import {assetMetadata,prepareAsset} from '../domain/assets';
import type {Asset,Book} from '../domain/model';
import {repository,friendlyError} from '../db/repository';
import {useEditor} from '../store/editor';
import {Button,ErrorMessage,IconButton} from '../components/ui';
import './textureBackground.css';

export type TextureBackgroundMode='workspace'|'page';

const RECENT_TEXTURE_LIMIT=4;
const workspaceColors=['#e9eaec','#ddd9d1','#cfc7bb','#cfd9d6','#d5dce5','#b9b0a4','#262728'] as const;
const pageColors=['#ffffff','#eeeae3','#f5ec30','#e48af5','#d9eb51','#75a4e1','#ff9658','#f6c9cc','#1a1a1a'] as const;
const workspaceTextures=[
  ['', '无纹理'],
  ['bg3.jpg','织物'],
  ['bg4.jpg','粗纸'],
  ['bg5.jpg','牛皮纸'],
] as const;
const pageTextures=[
  ['', '纯色'],
  ['bg-dots.jpg','波点'],
  ['bg-grid.jpg','格纹'],
  ['bg2.jpg','纸张'],
  ['bg3.jpg','织物'],
  ['bg4.jpg','纹理'],
  ['bg5.jpg','牛皮纸'],
] as const;

function recentTextureAssets(book:Book,currentId:string|undefined){
  const textures=book.textureAssets??[];
  const byId=new Map(textures.map(asset=>[asset.id,asset]));
  const ordered=(book.recentTextureIds?.length
    ?book.recentTextureIds
    :[...textures].sort((a,b)=>b.createdAt-a.createdAt).map(asset=>asset.id))
    .filter((id,index,ids)=>byId.has(id)&&ids.indexOf(id)===index);
  if(currentId&&byId.has(currentId)&&!ordered.includes(currentId))ordered.unshift(currentId);
  return ordered.slice(0,RECENT_TEXTURE_LIMIT).map(id=>byId.get(id)!).filter(Boolean);
}

export function TextureBackgroundPanel({mode,onClose}:{mode:TextureBackgroundMode;onClose:()=>void}){
  const book=useEditor(state=>state.book)!;
  const pageIndex=useEditor(state=>state.pageIndex);
  const change=useEditor(state=>state.change);
  const page=book.pages[pageIndex];
  const input=useRef<HTMLInputElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const workspace=mode==='workspace';
  const currentTextureId=workspace?book.workspaceTextureId:page.patternAssetId;
  const recent=useMemo(()=>recentTextureAssets(book,currentTextureId),[book.textureAssets,book.recentTextureIds,currentTextureId]);
  const colors=workspace?workspaceColors:pageColors;
  const textures=workspace?workspaceTextures:pageTextures;
  const title=workspace?'垫底背景':'底纹';

  function setColor(value:string){
    change(draft=>{
      if(workspace)draft.workspaceBackground=value;
      else{
        draft.pages[pageIndex].background=value;
        draft.pages[pageIndex].templateBackground=undefined;
      }
    });
  }
  function chooseBuiltIn(value:string){
    change(draft=>{
      if(workspace){
        draft.workspacePattern=value||undefined;
        draft.workspaceTextureId=undefined;
        draft.workspaceImageId=undefined;
      }else{
        const target=draft.pages[pageIndex];
        target.pattern=value||undefined;
        target.patternAssetId=undefined;
      }
    });
  }
  function chooseUploaded(assetId:string){
    change(draft=>{
      if(workspace){
        draft.workspaceTextureId=assetId;
        draft.workspacePattern=undefined;
        draft.workspaceImageId=undefined;
      }else{
        const target=draft.pages[pageIndex];
        target.patternAssetId=assetId;
        target.pattern=undefined;
      }
      const rest=(draft.recentTextureIds??[]).filter(id=>id!==assetId);
      draft.recentTextureIds=[assetId,...rest].slice(0,12);
    });
  }
  function reset(){
    change(draft=>{
      if(workspace){
        draft.workspaceBackground='#e9eaec';
        draft.workspacePattern=undefined;
        draft.workspaceTextureId=undefined;
        draft.workspaceImageId=undefined;
      }else{
        const target=draft.pages[pageIndex];
        target.background=draft.defaultPageBackground??'#eeeae3';
        target.templateBackground=undefined;
        target.pattern=undefined;
        target.patternAssetId=undefined;
      }
    });
  }
  async function upload(files:FileList|null){
    const file=files?.[0];
    if(!file)return;
    setBusy(true);setError('');
    try{
      const prepared=await prepareAsset(file);
      await repository.putAssets([prepared]);
      const metadata=assetMetadata(prepared);
      change(draft=>{
        const textureAssets=draft.textureAssets??=[];
        if(!textureAssets.some(asset=>asset.id===metadata.id))textureAssets.push(metadata);
        const rest=(draft.recentTextureIds??[]).filter(id=>id!==metadata.id);
        draft.recentTextureIds=[metadata.id,...rest].slice(0,12);
        if(workspace){
          draft.workspaceTextureId=metadata.id;
          draft.workspacePattern=undefined;
          draft.workspaceImageId=undefined;
        }else{
          const target=draft.pages[pageIndex];
          target.patternAssetId=metadata.id;
          target.pattern=undefined;
        }
      });
    }catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);if(input.current)input.current.value='';}
  }

  const builtInChosen=(value:string)=>workspace
    ?!book.workspaceTextureId&&!book.workspaceImageId&&(book.workspacePattern??'')===value
    :!page.patternAssetId&&(page.pattern??'')===value;

  return <aside className="editor-panel texture-background-panel">
    <div className="panel-grabber"/>
    <header><h2>{title}</h2><IconButton label="关闭面板" onClick={onClose}><X size={17}/></IconButton></header>
    <ErrorMessage message={error}/>
    <div className="panel-body texture-background-body">
      <p className="settings-intro">{workspace?'设置整本画册外部的底色与纹理。':'设置当前页面的底色与纹理。'} 上传后的纹理可在两个窗口中复用。</p>
      <p className="field-label">底色</p>
      <div className="swatches texture-color-swatches">{colors.map(value=><button key={value} aria-label={`底色 ${value}`} className={(workspace?book.workspaceBackground:page.background)===value?'chosen':''} style={{backgroundColor:value}} onClick={()=>setColor(value)}/>)}</div>
      <label className="field texture-custom-color"><span>自定义颜色</span><input type="color" value={workspace?book.workspaceBackground:page.background} onChange={event=>setColor(event.target.value)}/></label>
      <p className="field-label texture-field-label">纹理</p>
      <div className="background-grid texture-grid">
        {textures.map(([name,label])=><button key={name||'none'} type="button" aria-label={`纹理 ${label}`} className={builtInChosen(name)?'chosen':''} style={name?{backgroundImage:`url(/reference/${name})`}:{}} onClick={()=>chooseBuiltIn(name)}>{label}</button>)}
        {recent.map(asset=><UploadedTexture key={asset.id} asset={asset} chosen={currentTextureId===asset.id} onClick={()=>chooseUploaded(asset.id)}/>) }
      </div>
      <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={event=>void upload(event.target.files)}/>
      <Button className="full texture-upload-button" disabled={busy} onClick={()=>input.current?.click()}><Upload size={16}/>{busy?'正在处理纹理…':'上传纹理'}</Button>
      <p className="muted texture-upload-hint">手动上传的纹理会接在默认纹理后，只显示最近 {RECENT_TEXTURE_LIMIT} 个。</p>
      <Button className="full" onClick={reset}>恢复默认</Button>
    </div>
  </aside>;
}

function UploadedTexture({asset,chosen,onClick}:{asset:Asset;chosen:boolean;onClick:()=>void}){
  const [url,setUrl]=useState('');
  useEffect(()=>{
    let live=true,objectUrl='';
    void repository.getAsset(asset.id).then(stored=>{
      if(!live||!stored)return;
      objectUrl=URL.createObjectURL(stored.thumbnail);
      setUrl(objectUrl);
    }).catch(()=>{});
    return()=>{live=false;if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[asset.id]);
  return <button type="button" title={asset.name} aria-label={`最近上传纹理 ${asset.name}`} className={`uploaded-texture-tile ${chosen?'chosen':''}`} style={url?{backgroundImage:`url("${url}")`}:{}} onClick={onClick}><span>{asset.name}</span></button>;
}
