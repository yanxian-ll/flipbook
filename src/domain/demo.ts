import {repository} from '../db/repository';
import {prepareAsset,assetMetadata} from './assets';
import {newBook,blankPage,imageElement} from './model';
let initialization:Promise<void>|null=null;
export function initializeDemo(){return initialization??= (async()=>{
  if(await repository.initialized())return;
  if((await repository.list()).length){await repository.markInitialized();return;}
  const files=['style01.jpg','style02.jpg','bg2.jpg'];
  const stored=[];
  for(const name of files){const response=await fetch(`/reference/${name}`);if(!response.ok)throw new Error('示例图片加载失败，请刷新重试。');stored.push(await prepareAsset(new File([await response.blob()],name,{type:'image/jpeg'})));}
  const book=newBook('FLIPBOOK #000','scrapbook',stored.map(assetMetadata));
  for(let i=1;i<=8;i++){const page=blankPage(i);const asset=stored[i%2+1];page.elements.push(imageElement(asset.id,{x:0,y:0,width:1200,height:1696,crop:{x:i%2===1?0:1,y:.5,zoom:1}}));book.pages.push(page);}
  await repository.create(book,stored);await repository.markInitialized();
})().catch(e=>{initialization=null;throw e;});}
