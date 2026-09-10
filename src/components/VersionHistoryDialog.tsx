import {useEffect,useState} from 'react';
import {Clock3,RotateCcw,Save} from 'lucide-react';
import type {Book} from '../domain/model';
import {repository,type BookSnapshot,friendlyError} from '../db/repository';
import {Button,Modal} from './ui';

function snapshotTime(value:number){
  return new Intl.DateTimeFormat('zh-CN',{
    month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',
    hour12:false,
  }).format(value);
}

export function VersionHistoryDialog({
  book,
  open,
  onClose,
  onBeforeRestore,
  onRestore,
}:{
  book:Book;
  open:boolean;
  onClose:()=>void;
  onBeforeRestore:()=>Promise<void>;
  onRestore:(book:Book)=>void;
}){
  const [items,setItems]=useState<BookSnapshot[]>([]);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');

  async function refresh(){
    setLoading(true);setError('');
    try{setItems(await repository.listSnapshots(book.id));}
    catch(e){setError(friendlyError(e));}
    finally{setLoading(false);}
  }

  useEffect(()=>{if(open)void refresh();},[open,book.id]);

  async function saveVersion(){
    if(busy)return;
    setBusy(true);setError('');
    try{
      await repository.createSnapshot(book,'手动版本');
      await refresh();
    }catch(e){setError(friendlyError(e));}
    finally{setBusy(false);}
  }

  async function restore(snapshot:BookSnapshot){
    if(busy||!window.confirm('恢复到这个历史版本？当前状态会先自动保存为“恢复前版本”。'))return;
    setBusy(true);setError('');
    try{
      await onBeforeRestore();
      const restored=await repository.restoreSnapshot(snapshot.id);
      onRestore(restored);
      onClose();
    }catch(e){setError(friendlyError(e));}
    finally{setBusy(false);}
  }

  return <Modal open={open} onClose={onClose} title="历史版本" description="版本保存在当前浏览器本地。自动版本最多保留最近 24 个。" wide className="version-history-dialog">
    <div className="version-history-head">
      <div><Clock3 size={17}/><span>自动版本约每 5 分钟生成一次</span></div>
      <Button onClick={()=>void saveVersion()} disabled={busy}><Save size={14}/>保存当前版本</Button>
    </div>
    {error&&<div className="version-history-error" role="alert">{error}</div>}
    <div className="version-history-list" aria-live="polite">
      {loading?<p className="version-history-empty">正在读取历史版本…</p>:items.length===0?<p className="version-history-empty">还没有历史版本。继续编辑后系统会自动创建。</p>:items.map(snapshot=><article key={snapshot.id} className="version-history-item">
        <div>
          <strong>{snapshot.reason}</strong>
          <span>{snapshotTime(snapshot.createdAt)}</span>
          <small>{snapshot.book.pages.length} 页 · {snapshot.book.assets.length} 个素材</small>
        </div>
        <button type="button" onClick={()=>void restore(snapshot)} disabled={busy}><RotateCcw size={14}/>恢复</button>
      </article>)}
    </div>
  </Modal>;
}
