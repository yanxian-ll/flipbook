import {describe,expect,it} from 'vitest';
import {frontCoverRenderPage} from './coverPresentation';
import {H,W,backCoverFor,backCoverPage,coverTemplateFor,coverTemplatesFor,newBook,type Asset} from './model';

const photo:Asset={
  id:'cover-photo',name:'cover.jpg',mimeType:'image/jpeg',width:1800,height:2400,
  orientation:'portrait',storageKey:'cover-photo',createdAt:1,
};

describe('cover presentation model',()=>{
  it('keeps legacy custom back covers readable',()=>{
    const book=newBook('Legacy','editorial',[photo]);
    book.backCover={mode:'custom',background:'#ffffff',assetId:photo.id,crop:{x:.2,y:.7,zoom:1.4},text:'THE END',textColor:'#333333'};
    const normalized=backCoverFor(book);
    expect(normalized.backgroundMode).toBe('custom');
    expect(normalized.templateId).toBe('cutout');
    const page=backCoverPage(book);
    expect(page.background).toBe('#ffffff');
    const image=page.elements.find(element=>element.type==='image');
    expect(image).toMatchObject({
      assetId:photo.id,
      y:360,
      width:372,
      height:498,
      crop:{x:.2,y:.7,zoom:1.4},
    });
    expect(image?.x).toBeCloseTo(414);
  });

  it('lets a no-photo template hide the photo without deleting the selection',()=>{
    const book=newBook('Plain','editorial',[photo]);
    book.backCover={
      mode:'solid',backgroundMode:'custom',background:'#f4efe4',templateId:'plain',
      assetId:photo.id,crop:{x:.5,y:.5,zoom:1},text:'',textColor:'#222222',
    };
    expect(backCoverFor(book).assetId).toBe(photo.id);
    expect(backCoverPage(book).elements.some(element=>element.type==='image')).toBe(false);
    expect(coverTemplateFor(book,'plain').slot).toBeUndefined();
  });

  it('uses the same cover template geometry for the back cover without changing its style',()=>{
    const book=newBook('Shared template','editorial',[photo]);
    book.backCover={
      mode:'custom',backgroundMode:'custom',background:'#75a4e1',templateId:'basic',
      assetId:photo.id,crop:{x:.5,y:.5,zoom:1},text:'BACK',textColor:'#ffffff',
    };
    const page=backCoverPage(book);
    expect(page.background).toBe('#75a4e1');
    expect(page.elements.find(element=>element.type==='image')).toMatchObject({
      x:80,y:100,width:1040,height:1300,
    });
    expect(page.elements.find(element=>element.type==='text')).toMatchObject({text:'BACK',color:'#ffffff'});
  });

  it('keeps cover templates geometry-only',()=>{
    const book=newBook('Templates','scrapbook',[photo]);
    const templates=coverTemplatesFor(book);
    expect(templates.map(template=>template.id)).toEqual(expect.arrayContaining(['plain','basic','cutout']));
    expect(coverTemplateFor(book,'basic').slot).toEqual({x:80/W,y:100/H,width:1040/W,height:1300/H});
    expect(coverTemplateFor(book,'plain')).not.toHaveProperty('background');
  });

  it('applies front-cover template geometry only at presentation time',()=>{
    const book=newBook('Front','editorial',[photo]);
    const stored=book.pages[0].elements.find(element=>element.type==='image')!;
    const storedGeometry={x:stored.x,y:stored.y,width:stored.width,height:stored.height,opacity:stored.opacity};

    book.coverTemplate='basic';
    const basic=frontCoverRenderPage(book).elements.find(element=>element.type==='image')!;
    expect(basic).toMatchObject({x:80,y:100,width:1040,height:1300,opacity:1});
    expect(book.pages[0].elements.find(element=>element.type==='image')).toMatchObject(storedGeometry);

    book.coverTemplate='plain';
    const hidden=frontCoverRenderPage(book).elements.find(element=>element.type==='image')!;
    expect(hidden.opacity).toBe(0);
    expect(hidden.assetId).toBe(photo.id);
  });

  it('exports the stored cover color instead of stale normal-page styling',()=>{
    const book=newBook('Color','editorial',[photo]);
    const cover=book.pages[0];
    cover.background='#e48af5';
    cover.templateBackground='#1a1a1a';
    cover.templateOverlay='/reference/legacy-overlay.png';
    cover.templateDecorations=[{id:'legacy-frame',type:'frame',x:.1,y:.1,width:.8,height:.8,stroke:'#000000',strokeWidth:2}];
    cover.pattern='bg-grid.jpg';

    const rendered=frontCoverRenderPage(book);
    expect(rendered.background).toBe('#e48af5');
    expect(rendered.templateBackground).toBeUndefined();
    expect(rendered.templateOverlay).toBeUndefined();
    expect(rendered.templateDecorations).toBeUndefined();
    expect(rendered.pattern).toBeUndefined();
    expect(rendered.patternAssetId).toBeUndefined();
    expect(book.pages[0].templateBackground).toBe('#1a1a1a');
  });
});
