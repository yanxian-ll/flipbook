import {useEffect,useState,useRef} from 'react';
import {useNavigate} from 'react-router-dom';
import {Grid2X2,Book as BookIcon,Plus,Trash2,Copy,ChevronLeft,ChevronRight,MoreHorizontal,Download,ArchiveRestore,Maximize2,Minimize2,Settings} from 'lucide-react';
import type {Book} from '../domain/model';
import {repository,friendlyError} from '../db/repository';
import {exportBookBackup,importBookBackup} from '../db/backup';
import {initializeDemo} from '../domain/demo';
import {BookCover} from '../components/BookCover';
import {IconButton,Modal,Button,Loading,ErrorMessage,DesktopCloseControl} from '../components/ui';
import {useWorkspaceExpansion} from './useWorkspaceExpansion';

export function Bookshelf({creating=false}:{creating?:boolean}){
  const [books,setBooks]=useState<Book[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[grid,setGrid]=useState(true),[index,setIndex]=useState(0),[deleting,setDeleting]=useState(false),[rename,setRename]=useState(false),[title,setTitle]=useState(''),[menu,setMenu]=useState(false),[transferring,setTransferring]=useState(false);
  const [backupProgress,setBackupProgress]=useState<number|null>(null),[restoreProgress,setRestoreProgress]=useState<number|null>(null);
  const {wide,toggleWide}=useWorkspaceExpansion();
  const navigate=useNavigate();const startX=useRef(0),restoreInput=useRef<HTMLInputElement>(null);const current=books[Math.min(index,books.length-1)];
  async function refresh(){try{setBooks(await repository.list());}catch(e){setError(friendlyError(e));}finally{setLoading(false);}}
  useEffect(()=>{void initializeDemo().then(refresh).catch(e=>{setError(friendlyError(e));setLoading(false);});},[]);
  async function remove(){if(!current)return;try{await repository.remove(current.id);setDeleting(false);setIndex(0);await refresh();}catch(e){setError(friendlyError(e));}}
  async function backup(){
    if(!current||transferring)return;
    setTransferring(true);setBackupProgress(0);setError('');
    let lastProgress=-1;
    try{
      const saved=await exportBookBackup(current.id,progress=>{
        const rounded=Math.round(progress);
        if(rounded===lastProgress)return;
        lastProgress=rounded;
        setBackupProgress(rounded);
      },current.title);
      if(saved)setMenu(false);
    }catch(e){setError(friendlyError(e));}
    finally{setTransferring(false);setBackupProgress(null);}
  }
  async function restore(files:FileList|null){
    const file=files?.[0];if(!file||transferring)return;
    setTransferring(true);setRestoreProgress(0);setError('');
    let lastProgress=-1;
    try{
      await importBookBackup(file,progress=>{
        const rounded=Math.round(progress);
        if(rounded===lastProgress)return;
        lastProgress=rounded;
        setRestoreProgress(rounded);
      });
      setIndex(0);await refresh();
    }catch(e){setError(friendlyError(e));}
    finally{setTransferring(false);setRestoreProgress(null);if(restoreInput.current)restoreInput.current.value='';}
  }
  const backingUp=backupProgress!==null,restoring=restoreProgress!==null;
  return <main className={`phone-shell shelf ${wide?'expanded':''} ${creating?'behind-wizard':''}`}>
    <header className="shelf-header">
      <div className="view-toggle"><IconButton label="书架网格" active={grid} onClick={()=>setGrid(true)}><Grid2X2 size={17}/></IconButton><IconButton label="单本轮播" active={!grid} onClick={()=>setGrid(false)}><BookIcon size={17}/></IconButton></div>
      <div className="shelf-header-actions">
        <span style={{position:'relative',display:'inline-flex'}}><IconButton label={restoring?`正在恢复 ${restoreProgress}%`:'恢复作品备份'} disabled={transferring} onClick={()=>restoreInput.current?.click()}><ArchiveRestore size={17}/></IconButton>{restoring&&<span role="status" aria-live="polite" style={{position:'absolute',right:-8,top:-8,zIndex:2,minWidth:30,padding:'2px 5px',borderRadius:999,background:'#9bd7a5',color:'#173b20',fontSize:8,fontWeight:700,lineHeight:'13px',textAlign:'center',boxShadow:'0 1px 4px #0002',pointerEvents:'none'}}>{restoreProgress}%</span>}</span>
        {!grid&&<IconButton label="删除当前 Flipbook" disabled={!current||transferring} onClick={()=>setDeleting(true)}><Trash2 size={17}/></IconButton>}
        <IconButton label="设置与存储" onClick={()=>navigate('/settings')}><Settings size={17}/></IconButton>
        <IconButton label={wide?'收起工作区':'展开工作区'} onClick={toggleWide}>{wide?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</IconButton>
        <DesktopCloseControl/>
      </div>
    </header>
    <input ref={restoreInput} type="file" hidden accept=".flipbook-backup,application/zip" onChange={e=>void restore(e.target.files)}/>
    <ErrorMessage message={error}/>
    {loading?<Loading/>:!books.length?<div className="empty"><BookIcon size={40} strokeWidth={1}/><h2>还没有画册</h2><p>把照片变成一本可以翻阅的数字画册。</p><Button className="primary" onClick={()=>navigate('/create')}>创建第一本画册</Button></div>:grid?<><h2 className="grid-heading">我的书架</h2><div className="book-grid">{books.map((book,i)=><article key={book.id}><BookCover book={book} onClick={()=>navigate(`/editor/${book.id}`)}/><button className="book-name" onClick={()=>{setIndex(i);setTitle(book.title);setRename(true);}}>{book.title}</button><span>{book.pages.length}页 · {new Date(book.updatedAt).toLocaleDateString('zh-CN')}</span><IconButton label={`管理 ${book.title}`} onClick={()=>{setIndex(i);setMenu(true);}}><MoreHorizontal size={16}/></IconButton></article>)}</div></>:current&&<><div className="shelf-stage" onTouchStart={e=>startX.current=e.touches[0].clientX} onTouchEnd={e=>{const delta=e.changedTouches[0].clientX-startX.current;if(Math.abs(delta)>45)setIndex(Math.max(0,Math.min(books.length-1,index+(delta<0?1:-1))));}}><BookCover book={current} onClick={()=>navigate(`/editor/${current.id}`)}/>{books.length>1&&<><button className="carousel-arrow previous" aria-label="上一本" disabled={index===0} onClick={()=>setIndex(index-1)}><ChevronLeft/></button><button className="carousel-arrow next" aria-label="下一本" disabled={index===books.length-1} onClick={()=>setIndex(index+1)}><ChevronRight/></button></>}</div><div className="shelf-meta"><button className="shelf-title" onClick={()=>{setTitle(current.title);setRename(true);}}>{current.title}</button><div className="shelf-sub">{current.pages.length}页</div><div className="shelf-dots">{books.map((book,i)=><button key={book.id} aria-label={`第 ${i+1} 本`} className={i===index?'selected':''} onClick={()=>setIndex(i)/>)}</div><button className="shelf-more" aria-label="画册操作" onClick={()=>setMenu(true)}><MoreHorizontal size={18}/></button></div></>}
    <button className="create-fab" title="新建 Flipbook" aria-label="新建 Flipbook" onClick={()=>navigate('/create')}><Plus size={28}/></button>
    <Modal open={deleting} onClose={()=>setDeleting(false)} title="要删掉这本 Flipbook 吗？" description="删除后无法从书架恢复，建议先备份重要作品。"><div className="actions"><Button onClick={()=>setDeleting(false)}>取消</Button><Button className="danger" onClick={()=>void remove()}>删除</Button></div></Modal>
    <Modal open={rename} onClose={()=>setRename(false)} title="给这本书起个名字"><input aria-label="画册名称" maxLength={80} value={title} onChange={e=>setTitle(e.target.value)}/><div className="actions"><Button onClick={()=>setRename(false)}>取消</Button><Button className="primary" disabled={!title.trim()} onClick={()=>{if(current)void repository.rename(current.id,title).then(()=>{setRename(false);return refresh();}).catch(e=>setError(friendlyError(e)));}}>保存</Button></div></Modal>
    <Modal open={menu} onClose={()=>setMenu(false)} title={current?.title??'画册操作'}><div className="menu-list"><Button onClick={()=>current&&navigate(`/editor/${current.id}`)}>打开画册</Button><Button onClick={()=>{setMenu(false);setTitle(current.title);setRename(true);}}>重命名</Button><Button onClick={()=>{void repository.duplicate(current.id).then(()=>{setMenu(false);return refresh();}).catch(e=>setError(friendlyError(e)));}}><Copy size={17}/>复制画册</Button><Button onClick={()=>navigate(`/preview/${current.id}?export=1`)}>导出画册</Button><Button disabled={transferring} onClick={()=>void backup()} aria-label={backingUp?`正在备份 ${backupProgress}%`:'备份作品'} style={{position:'relative',overflow:'hidden',opacity:backingUp?1:undefined}}>{backingUp&&<span aria-hidden style={{position:'absolute',left:0,top:0,bottom:0,width:`${backupProgress}%`,background:'#9bd7a5',borderRadius:'inherit',transition:'width 120ms linear'}}/>}<span style={{position:'relative',zIndex:1,display:'inline-flex',alignItems:'center',gap:8}}><Download size={17}/>{backingUp?`备份中 ${backupProgress}%`:'备份作品'}</span></Button><Button className="danger" onClick={()=>{setMenu(false);setDeleting(true);}}>删除</Button></div></Modal>
  </main>;
}