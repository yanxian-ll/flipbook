import React from 'react';
import {createRoot} from 'react-dom/client';
import {VirtualAssetLibrary} from '../src/components/VirtualAssetLibrary';
import type {Asset} from '../src/domain/model';
import '../src/styles.css';
const assets:Asset[]=Array.from({length:5000},(_,i)=>({id:`load-${i}`,name:`照片 ${i+1}`,mimeType:'image/jpeg',width:1200,height:1600,orientation:'portrait',storageKey:`load-${i}`,createdAt:1}));
const batches=[{id:'load-test',at:1,legacy:false,assets}];
createRoot(document.getElementById('root')!).render(<main style={{background:'#fff',padding:20,width:380}}><h1>5000 张素材 · 虚拟列表验证</h1><div className="panel-body" style={{height:500,padding:0,marginTop:20}}><VirtualAssetLibrary batches={batches} label={()=>'测试素材'} renderAsset={asset=><button key={asset.id} aria-label={asset.name}><img src="/reference/flipin-here-toast.jpg" alt={asset.name} decoding="async"/></button>}/></div></main>);
