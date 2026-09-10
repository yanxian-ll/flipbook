import {Copy,Crop,ImagePlus,Pencil,SlidersHorizontal,Trash2} from 'lucide-react';
import type {Element} from '../../domain/model';
import {IconButton} from '../../components/ui';

export function EditorContextToolbar({element,fixed,onReplace,onEditText,onAdjust,onDuplicate,onDelete}:{element:Element;fixed:boolean;onReplace:()=>void;onEditText:()=>void;onAdjust:()=>void;onDuplicate:()=>void;onDelete:()=>void}){
  return <div className="context-toolbar" aria-label="选中元素操作">
    {element.type==='image'&&<IconButton label="替换照片" onClick={onReplace}><ImagePlus size={16}/></IconButton>}
    {element.type==='image'&&<IconButton label={fixed?'裁切与位置':'图片调整'} onClick={onAdjust}>{fixed?<Crop size={16}/>:<SlidersHorizontal size={16}/>}</IconButton>}
    {element.type==='text'&&<IconButton label="编辑文字" onClick={onEditText}><Pencil size={16}/></IconButton>}
    {(element.type==='text'||element.type==='sticker'||element.type==='shape')&&<IconButton label="调整元素" onClick={onAdjust}><SlidersHorizontal size={16}/></IconButton>}
    {!fixed&&<IconButton label="复制元素" onClick={onDuplicate}><Copy size={16}/></IconButton>}
    {!fixed&&<IconButton label="删除元素" onClick={onDelete}><Trash2 size={16}/></IconButton>}
  </div>;
}
