import {describe,expect,it} from 'vitest';
import {buildShareHtmlDocument,buildShareViewerScript,serializeInlineJson,type ShareHtmlInput} from './shareHtml';

const input:ShareHtmlInput={
  title:'测试 <画册> & "朋友"',
  pages:[
    'data:image/jpeg;base64,AAA',
    'data:image/jpeg;base64,BBB',
    'data:image/jpeg;base64,CCC',
  ],
  labels:['封面','第 1 页','第 2 页'],
  showCover:true,
  coverTexture:'data:image/png;base64,TEXTURE',
  backColor:'#efe7d2',
  leafPlan:{needsFiller:false,backIndex:3},
  viewerConfig:{
    width:480,
    height:678,
    minWidth:192,
    maxWidth:480,
    minHeight:271,
    maxHeight:678,
    flippingTime:620,
    maxShadowOpacity:.28,
    swipeDistance:28,
    corner:'top',
  },
  libraryScript:'<script>window.St={PageFlip:function(){}};</script>',
};

describe('shared HTML viewer',()=>{
  it('always emits JavaScript that can be parsed before an export is downloaded',()=>{
    const script=buildShareViewerScript(input);
    expect(()=>new Function(script)).not.toThrow();
  });

  it('keeps embedded data from terminating the generated script',()=>{
    const script=buildShareViewerScript({
      ...input,
      pages:['data:image/jpeg;base64,AAA</script><script>bad()</script>'],
      labels:['封面\u2028下一行'],
    });
    expect(script).not.toContain('</script><script>bad()');
    expect(script).toContain('\\u003c/script>');
    expect(()=>new Function(script)).not.toThrow();
  });

  it('escapes document text while keeping the viewer and back-cover logic',()=>{
    const html=buildShareHtmlDocument(input);
    expect(html).toContain('<title>测试 &lt;画册&gt; &amp; &quot;朋友&quot;</title>');
    expect(html).toContain('class="book-rendering"');
    expect(html).toContain('function makeBack');
    expect(html).toContain('new St.PageFlip');
    expect(html).toContain('data:image/jpeg;base64,AAA');
  });

  it('serializes inline JSON safely for script tags',()=>{
    const json=serializeInlineJson('</script>\u2028next');
    expect(json).not.toContain('</script>');
    expect(json).toContain('\\u003c/script>');
    expect(json).toContain('\\u2028');
  });
});
