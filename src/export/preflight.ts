import {backCoverPage,type Book,type Element} from '../domain/model';
import {cropRect} from '../domain/crop';
import {layouts} from '../domain/layouts';
import type {ExportFormat} from './exportBook';

export type ExportCheckSeverity='error'|'warning';

export interface ExportCheckIssue{
  id:string;
  severity:ExportCheckSeverity;
  title:string;
  detail:string;
  pages:number[];
}

export interface ExportCheckResult{
  issues:ExportCheckIssue[];
  errors:number;
  warnings:number;
}

function unique(values:number[]){return [...new Set(values)].sort((a,b)=>a-b);}
function pageName(index:number){return index===-1?'后封面':index===0?'封面':`第 ${index} 页`;}
function pageList(indices:number[]){
  const names=unique(indices).map(pageName);
  if(names.length<=4)return names.join('、');
  return `${names.slice(0,4).join('、')} 等 ${names.length} 页`;
}

export function exportRenderScale(format:ExportFormat,quality:number){
  if(format==='share')return Math.max(1,Math.min(1.6,quality));
  if(format==='mp4')return Math.max(.8,Math.min(1.1,.65+quality*.15));
  return Math.max(1,Math.min(2,quality));
}

function imageNeedsMorePixels(element:Element,asset:{width:number;height:number},scale:number){
  if(element.width<=0||element.height<=0||asset.width<=0||asset.height<=0)return false;
  const tolerance=.82;
  if(element.fit==='contain'){
    const available=Math.min(asset.width/element.width,asset.height/element.height);
    return available<scale*tolerance;
  }
  const visible=cropRect(
    {width:element.width,height:element.height},
    {width:asset.width,height:asset.height},
    element.crop
  );
  return visible.width<element.width*scale*tolerance||visible.height<element.height*scale*tolerance;
}

export function inspectExport(
  book:Book,
  indices:number[],
  format:ExportFormat,
  quality:number,
  missingStoredAssetIds:Iterable<string>=[]
):ExportCheckResult{
  const selected=unique(indices.filter(index=>index>=0&&index<book.pages.length));
  const includeBackCover=format==='share'&&selected.includes(0);
  const selectedSet=new Set(selected);
  if(includeBackCover)selectedSet.add(-1);
  const metadata=new Map([...book.assets,...(book.textureAssets??[])].map(asset=>[asset.id,asset]));
  const storedMissing=new Set(missingStoredAssetIds);
  const missingMetadataPages:number[]=[];
  const missingFilePages:number[]=[];
  const blankPages:number[]=[];
  const emptyFramePages:number[]=[];
  const lowResolutionPages:number[]=[];
  const scale=exportRenderScale(format,quality);

  for(const index of selected){
    const page=book.pages[index];
    const images=page.elements.filter(element=>element.type==='image');
    const visibleContent=page.elements.some(element=>{
      if(element.type==='image')return !!element.assetId;
      if(element.type==='text')return !!element.text?.trim();
      return true;
    })||!!page.templateOverlay||!!page.pattern||!!page.patternAssetId;

    if(index>0&&!visibleContent)blankPages.push(index);

    if(page.layoutId){
      const layout=[...layouts,...(book.customLayouts??[])].find(item=>item.id===page.layoutId);
      const filled=images.filter(element=>!!element.assetId).length;
      if(layout&&filled<layout.slots.length)emptyFramePages.push(index);
    }

    if(page.patternAssetId){
      if(!metadata.has(page.patternAssetId))missingMetadataPages.push(index);
      else if(storedMissing.has(page.patternAssetId))missingFilePages.push(index);
    }
    for(const image of images){
      if(!image.assetId)continue;
      const asset=metadata.get(image.assetId);
      if(!asset){
        missingMetadataPages.push(index);
        continue;
      }
      if(storedMissing.has(image.assetId))missingFilePages.push(index);
      if(imageNeedsMorePixels(image,asset,scale))lowResolutionPages.push(index);
    }
  }

  if(includeBackCover){
    for(const image of backCoverPage(book).elements.filter(element=>element.type==='image'&&element.assetId)){
      const asset=metadata.get(image.assetId!);
      if(!asset){missingMetadataPages.push(-1);continue;}
      if(storedMissing.has(image.assetId!))missingFilePages.push(-1);
      if(imageNeedsMorePixels(image,asset,scale))lowResolutionPages.push(-1);
    }
  }

  const issues:ExportCheckIssue[]=[];
  if(missingMetadataPages.length)issues.push({
    id:'missing-metadata',
    severity:'error',
    title:'有图片或纹理引用已失效',
    detail:`${pageList(missingMetadataPages)} 引用了画册中不存在的图片或纹理，导出时可能失败或出现空白。`,
    pages:unique(missingMetadataPages),
  });
  if(missingFilePages.length)issues.push({
    id:'missing-files',
    severity:'error',
    title:'有本地图片或纹理文件缺失',
    detail:`${pageList(missingFilePages)} 的元数据还在，但本地原始文件不存在，建议重新上传对应照片或纹理。`,
    pages:unique(missingFilePages),
  });
  if(emptyFramePages.length)issues.push({
    id:'empty-layout-frames',
    severity:'warning',
    title:'有排版照片框尚未填满',
    detail:`${pageList(emptyFramePages)} 的模板仍有空照片位；继续导出会保留这些空位。`,
    pages:unique(emptyFramePages),
  });
  if(blankPages.length)issues.push({
    id:'blank-pages',
    severity:'warning',
    title:'包含空白内页',
    detail:`${pageList(blankPages)} 没有可见内容；如果这是刻意留白，可以忽略。`,
    pages:unique(blankPages),
  });
  if(lowResolutionPages.length)issues.push({
    id:'low-resolution',
    severity:'warning',
    title:'部分照片在当前清晰度下可能偏糊',
    detail:`${pageList(lowResolutionPages)} 的原图像素相对当前裁剪和导出清晰度偏低。可以降低清晰度、减小裁剪放大或换更高分辨率照片。`,
    pages:unique(lowResolutionPages),
  });

  const relevantIssues=issues.map(issue=>({...issue,pages:issue.pages.filter(index=>selectedSet.has(index))}));
  return {
    issues:relevantIssues,
    errors:relevantIssues.filter(issue=>issue.severity==='error').length,
    warnings:relevantIssues.filter(issue=>issue.severity==='warning').length,
  };
}

export async function findMissingStoredAssetIds(
  book:Book,
  indices:number[],
  getAsset:(id:string)=>Promise<unknown>
){
  const selected=new Set(indices.filter(index=>index>=0&&index<book.pages.length));
  const ids=[...new Set([
    ...book.pages.flatMap((page,index)=>selected.has(index)
      ?[
        ...page.elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!),
        ...(page.patternAssetId?[page.patternAssetId]:[]),
      ]
      :[]
    ),
    ...(selected.has(0)?backCoverPage(book).elements.filter(element=>element.type==='image'&&element.assetId).map(element=>element.assetId!):[]),
  ])];
  const missing:string[]=[];
  await Promise.all(ids.map(async id=>{
    try{if(!await getAsset(id))missing.push(id);}
    catch{missing.push(id);}
  }));
  return missing;
}
