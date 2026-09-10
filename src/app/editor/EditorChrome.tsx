import {useEffect,useRef,useState} from 'react';
import {Check,ChevronLeft,Eye,History,Maximize2,Minimize2,Palette,SlidersHorizontal,Undo2,Redo2,Upload} from 'lucide-react';
import {Button,IconButton,Modal} from '../../components/ui';
import {useEditor} from '../../store/editor';
import {commitEditorTitle} from './editorTitle';
import './editorControls.css';

export function EditorHeader({wide,onBack,onToggleWide}:{wide:boolean;onBack:()=>void;onToggleWide:()=>void}){
  const title=useEditor(state=>state.book?.title??'');
  const [draft,setDraft]=useState(title);
  const cancelCommit=useRef(false);
  useEffect(()=>setDraft(title),[title]);

  function commit(){
    if(cancelCommit.current){cancelCommit.current=false;setDraft(title);return;}
    const next=draft.trim();
    if(!next){setDraft(title);return;}
    if(next!==title)void commitEditorTitle(next);
  }

  return <header className="studio-header">
    <IconButton label="返回书架" onClick={onBack}><ChevronLeft size={21}/></IconButton>
    <input
      className="editor-title"
      aria-label="画册名称"
      value={draft}
      onChange={event=>setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event=>{
        if(event.key==='Enter')event.currentTarget.blur();
        if(event.key==='Escape'){
          cancelCommit.current=true;
          setDraft(title);
          event.currentTarget.blur();
        }
      }}
    />
    <IconButton label={wide?'收起工作区':'展开工作区'} onClick={onToggleWide}>{wide?<Minimize2 size={17}/>:<Maximize2 size={17}/>}</IconButton>
  </header>;
}

export function WorkspaceToolbar({onHistory,onBookStyle,onBackground,onPreview,onExport}:{onHistory:()=>void;onBookStyle:()=>void;onBackground:()=>void;onPreview:()=>void;onExport:()=>void}){
  const canUndo=useEditor(state=>state.past.length>0);
  const canRedo=useEditor(state=>state.future.length>0);
  const status=useEditor(state=>state.status);
  return <div className="workspace-toolbar">
    <div className="toolbar-pill">
      <IconButton label="撤销" disabled={!canUndo} onClick={()=>useEditor.getState().undo()}><Undo2 size={16}/></IconButton>
      <IconButton label="重做" disabled={!canRedo} onClick={()=>useEditor.getState().redo()}><Redo2 size={16}/></IconButton>
      <IconButton label="历史版本" onClick={onHistory}><History size={16}/></IconButton>
    </div>
    <div className="toolbar-pill toolbar-pill-actions">
      <IconButton label="画册风格" onClick={onBookStyle}><SlidersHorizontal size={16}/></IconButton>
      <IconButton label="垫底背景" onClick={onBackground}><Palette size={16}/></IconButton>
      <IconButton label="翻页预览" onClick={onPreview}><Eye size={16}/></IconButton>
      <IconButton label="导出 Flipbook" onClick={onExport}><Upload size={16}/></IconButton>
    </div>
    <div className={`save-status workspace-save-status ${status}`} role="status" aria-live="polite">
      {status==='saved'?<><Check size={10}/>已保存</>:status==='saving'?'保存中…':<button onClick={()=>void useEditor.getState().flush().catch(()=>{})}>保存失败，点此重试</button>}
    </div>
  </div>;
}

export function ViewModeSwitch({mode,top,onChange}:{mode:'spread'|'page';top?:string;onChange:(mode:'spread'|'page')=>void}){
  return <div className="view-mode-switch" style={top?{top}:undefined} role="group" aria-label="页面显示模式">
    <button type="button" className={mode==='spread'?'active':''} aria-pressed={mode==='spread'} onClick={()=>onChange('spread')}>双页</button>
    <button type="button" className={mode==='page'?'active':''} aria-pressed={mode==='page'} onClick={()=>onChange('page')}>单页</button>
  </div>;
}

export function PageDeleteDialog({open,pageIndex,onClose,onConfirm}:{open:boolean;pageIndex:number;onClose:()=>void;onConfirm:()=>void}){
  const book=useEditor(state=>state.book);
  const selectedPages=useEditor(state=>state.selectedPages);
  const selectedIndices=(book?.pages??[])
    .map((page,index)=>selectedPages.includes(page.id)?index:-1)
    .filter(index=>index>0)
    .sort((a,b)=>a-b);
  const indices=selectedIndices.length?selectedIndices:pageIndex>0?[pageIndex]:[];
  const multiple=indices.length>1;
  const title=multiple?`删除选中的 ${indices.length} 页？`:`删除第 ${indices[0]??pageIndex} 页？`;
  const description=multiple
    ?`将删除第 ${indices.join('、')} 页。删除后仍可通过撤销或历史版本恢复。`
    :'删除页面后仍可通过撤销或历史版本恢复。';

  return <Modal open={open} onClose={onClose} title={title} description={description}>
    <div className="actions">
      <Button onClick={onClose}>取消</Button>
      <Button className="danger" onClick={onConfirm}>{multiple?`删除 ${indices.length} 页`:'删除页面'}</Button>
    </div>
  </Modal>;
}
