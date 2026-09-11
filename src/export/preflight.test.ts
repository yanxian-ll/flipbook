import {describe,expect,it,vi} from 'vitest';
import {inspectExport,exportRenderScale,findMissingStoredAssetIds} from './preflight';
import {newBook,imageElement,blankPage,type Asset} from '../domain/model';

function asset(id:string,width=2400,height=2400):Asset{
  return {
    id,name:`${id}.jpg`,mimeType:'image/jpeg',width,height,
    orientation:'square',storageKey:id,createdAt:1,
  };
}

describe('export preflight',()=>{
  it('keeps quality estimates aligned with real export scale caps',()=>{
    expect(exportRenderScale('share',3)).toBe(3);
    expect(exportRenderScale('share',.5)).toBe(.5);
    expect(exportRenderScale('collage',3)).toBe(2);
    expect(exportRenderScale('collage',.35)).toBe(.35);
    expect(exportRenderScale('pdf',2)).toBe(2);
    expect(exportRenderScale('mp4',3)).toBeCloseTo(1.1);
    expect(exportRenderScale('mp4',.5)).toBe(.5);
  });

  it('reports blank pages and missing image references without blocking the export model',()=>{
    const book=newBook('check','editorial');
    const page=blankPage(1);
    const broken=blankPage(2);
    broken.elements.push(imageElement('missing'));
    book.pages.push(page,broken);
    const result=inspectExport(book,[1,2],'pdf',1);
    expect(result.issues.map(issue=>issue.id)).toContain('blank-pages');
    expect(result.issues.map(issue=>issue.id)).toContain('missing-metadata');
    expect(result.errors).toBe(1);
  });

  it('only warns about resolution when the selected output needs more pixels',()=>{
    const photo=asset('photo',700,700);
    const book=newBook('resolution','editorial',[photo]);
    const page=blankPage(1);
    page.elements.push(imageElement(photo.id,{x:0,y:0,width:1000,height:1000,crop:{x:.5,y:.5,zoom:1}}));
    book.pages.push(page);
    expect(inspectExport(book,[1],'collage',1).issues.some(issue=>issue.id==='low-resolution')).toBe(true);
    expect(inspectExport(book,[1],'collage',.35).issues.some(issue=>issue.id==='low-resolution')).toBe(false);
    expect(inspectExport({...book,assets:[asset('photo',3000,3000)]},[1],'collage',1).issues.some(issue=>issue.id==='low-resolution')).toBe(false);
  });

  it('checks custom back-cover assets for shared HTML',()=>{
    const photo=asset('back-photo',500,500);
    const book=newBook('back','editorial',[photo]);
    book.backCover={mode:'custom',background:'#eeeae3',assetId:photo.id,crop:{x:.5,y:.5,zoom:1},text:'THE END',textColor:'#222'};
    const missing=inspectExport({...book,assets:[]},[0],'share',1.6);
    expect(missing.issues.find(issue=>issue.id==='missing-metadata')?.pages).toContain(-1);
    const low=inspectExport(book,[0],'share',1.6);
    expect(low.issues.find(issue=>issue.id==='low-resolution')?.pages).toContain(-1);
  });

  it('checks whether selected image blobs still exist in local storage',async()=>{
    const photo=asset('photo');
    const book=newBook('files','editorial',[photo]);
    const page=blankPage(1);
    page.elements.push(imageElement(photo.id));
    book.pages.push(page);
    const getAsset=vi.fn(async()=>undefined);
    expect(await findMissingStoredAssetIds(book,[1],getAsset)).toEqual(['photo']);
    expect(getAsset).toHaveBeenCalledTimes(1);
  });
});
