import {useEffect,useRef,useState} from 'react';
import {ArchiveRestore,ChevronLeft,Database,Download,HardDrive,Keyboard,Trash2} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {Button,ErrorMessage,IconButton,Modal} from '../components/ui';
import {exportLibraryBackup,importBookBackup,importLibraryBackup} from '../db/backup';
import {friendlyError,repository,type LocalDataStats} from '../db/repository';
import '../styles/settings.css';

function formatBytes(value:number|undefined){
  if(!value)return '0 MB';
  const units=['B','KB','MB','GB'];
  let amount=value,index=0;
  while(amount>=1024&&index<units.length-1){amount/=1024;index++;}
  return `${amount>=100||index===0?Math.round(amount):amount.toFixed(1)} ${units[index]}`;
}

export function Settings(){
  const navigate=useNavigate();
  const restoreInput=useRef<HTMLInputElement>(null);
  const [stats,setStats]=useState<LocalDataStats>({books:0,assets:0,snapshots:0});
  const [storage,setStorage]=useState<{usage?:number;quota?:number}>({});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[cleanupOpen,setCleanupOpen]=useState(false);
  const [backupProgress,setBackupProgress]=useState<number|null>(null);

  async function refresh(){
    try{
      const estimatePromise=navigator.storage?.estimate
        ?navigator.storage.estimate()
        :Promise.resolve({} as StorageEstimate);
      const [nextStats,estimate]=await Promise.all([repository.localDataStats(),estimatePromise]);
      setStats(nextStats);
      setStorage({usage:estimate.usage,quota:estimate.quota});
    }catch(cause){setError(friendlyError(cause));}
  }
  useEffect(()=>{void refresh();},[]);

  async function backupAll(){
    if(busy)return;setBusy(true);setBackupProgress(0);setError('');setMessage('');
    let lastProgress=-1;
    try{
      await exportLibraryBackup(progress=>{
        const rounded=Math.round(progress);
        if(rounded===lastProgress)return;
        lastProgress=rounded;
        setBackupProgress(rounded);
      });
      setMessage('全部作品备份已生成。');
    }
    catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);setBackupProgress(null);}
  }

  async function restore(file:File|undefined){
    if(!file||busy)return;setBusy(true);setError('');setMessage('');
    try{
      if(file.name.endsWith('.flipbook-library-backup')){
        const books=await importLibraryBackup(file);
        setMessage(`已恢复 ${books.length} 本画册。`);
      }else{
        const book=await importBookBackup(file);
        setMessage(`已恢复“${book.title}”。`);
      }
      await refresh();
    }catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);if(restoreInput.current)restoreInput.current.value='';}
  }

  async function cleanup(){
    if(busy)return;setBusy(true);setCleanupOpen(false);setError('');setMessage('');
    try{const count=await repository.cleanupUnusedAssets();setMessage(count?`已清理 ${count} 个未被作品、历史版本或创建草稿使用的素材文件。`:'没有发现可以安全清理的旧素材。');await refresh();}
    catch(cause){setError(friendlyError(cause));}
    finally{setBusy(false);}
  }

  const usage=storage.usage??0,quota=storage.quota??0,ratio=quota?Math.min(100,usage/quota*100):0;
  const backingUp=backupProgress!==null;
  return <main className="phone-shell settings-shell">
    <header className="settings-page-header"><IconButton label="返回书架" onClick={()=>navigate('/')}><ChevronLeft size={20}/></IconButton><div><h1>设置与存储</h1><p>本地数据、备份与快捷键</p></div><span/></header>
    <div className="settings-page-body">
      <ErrorMessage message={error}/>
      {message&&<div className="settings-success" role="status">{message}</div>}

      <section className="settings-card">
        <div className="settings-card-title"><HardDrive size={18}/><div><h2>本地存储</h2><p>画册和原始照片只保存在当前浏览器</p></div></div>
        <div className="storage-usage"><div><strong>{formatBytes(usage)}</strong><span>{quota?` / ${formatBytes(quota)}`:'已使用'}</span></div>{quota&&<div className="storage-meter" aria-label={`已使用 ${Math.round(ratio)}%`}><i style={{width:`${ratio}%`}}/></div>}</div>
        <div className="settings-stats"><div><b>{stats.books}</b><span>画册</span></div><div><b>{stats.assets}</b><span>素材文件</span></div><div><b>{stats.snapshots}</b><span>历史版本</span></div></div>
        <Button className="full" disabled={busy} onClick={()=>setCleanupOpen(true)}><Trash2 size={15}/>清理未使用素材</Button>
        <p className="settings-note">清理只删除至少一小时前、且没有被画册、历史版本或未完成创建草稿引用的孤立素材。</p>
      </section>

      <section className="settings-card">
        <div className="settings-card-title"><Database size={18}/><div><h2>备份与恢复</h2><p>建议定期把完整作品备份到其他磁盘或云盘</p></div></div>
        <div className="settings-action-grid">
          <Button className={`backup-progress-button ${backingUp?'is-backing-up':''}`} disabled={busy||!stats.books} onClick={()=>void backupAll()} aria-label={backingUp?`正在备份 ${backupProgress}%`:'备份全部作品'}>
            {backingUp&&<span className="backup-progress-fill" style={{width:`${backupProgress}%`}} aria-hidden/>}
            <span className="backup-progress-content"><Download size={15}/>{backingUp?`备份中 ${backupProgress}%`:'备份全部作品'}</span>
          </Button>
          <Button disabled={busy} onClick={()=>restoreInput.current?.click()}><ArchiveRestore size={15}/>恢复备份</Button>
        </div>
        <input ref={restoreInput} hidden type="file" accept=".flipbook-backup,.flipbook-library-backup,application/zip" onChange={event=>void restore(event.target.files?.[0])}/>
      </section>

      <section className="settings-card">
        <div className="settings-card-title"><Keyboard size={18}/><div><h2>编辑快捷键</h2><p>Windows 使用 Ctrl，macOS 使用 Command</p></div></div>
        <dl className="shortcut-list"><div><dt>撤销 / 重做</dt><dd>Ctrl Z / Ctrl Shift Z</dd></div><div><dt>复制 / 粘贴</dt><dd>Ctrl C / Ctrl V</dd></div><div><dt>复制元素</dt><dd>Ctrl D</dd></div><div><dt>删除</dt><dd>Delete / Backspace</dd></div><div><dt>微调位置</dt><dd>方向键 · Shift 10px</dd></div><div><dt>关闭当前操作</dt><dd>Esc</dd></div></dl>
      </section>
    </div>

    <Modal open={cleanupOpen} onClose={()=>setCleanupOpen(false)} title="清理未使用素材？" description="不会删除任何画册、历史版本或未完成创建草稿正在使用的照片。">
      <div className="actions"><Button onClick={()=>setCleanupOpen(false)}>取消</Button><Button className="danger" disabled={busy} onClick={()=>void cleanup()}>开始清理</Button></div>
    </Modal>
  </main>;
}
