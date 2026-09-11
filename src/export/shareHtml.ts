export type ShareLeafPlan={
  needsFiller:boolean;
  backIndex:number;
};

export type ShareViewerConfig={
  width:number;
  height:number;
  minWidth:number;
  maxWidth:number;
  minHeight:number;
  maxHeight:number;
  flippingTime:number;
  maxShadowOpacity:number;
  swipeDistance:number;
  corner:'top'|'bottom';
};

export type ShareHtmlInput={
  title:string;
  pages:string[];
  labels:string[];
  showCover:boolean;
  coverTexture:string;
  backColor:string;
  backPage:string;
  leafPlan:ShareLeafPlan;
  viewerConfig:ShareViewerConfig;
  libraryScript:string;
};

const HTML_ENTITIES:Record<string,string>={
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;',
};

export function escapeShareHtml(value:string){
  return value.replace(/[&<>"']/g,char=>HTML_ENTITIES[char]??char);
}

export function serializeInlineJson(value:unknown){
  return JSON.stringify(value)
    .replace(/</g,'\\u003c')
    .replace(/\u2028/g,'\\u2028')
    .replace(/\u2029/g,'\\u2029');
}

export const SHARE_VIEWER_CSS=`
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;font-family:Arial,"Microsoft YaHei",sans-serif;background:#e9e8e4;color:#1b1b1b}
body{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:100dvh;overflow:hidden}
.top{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;font-weight:700;background:#ffffffd9;backdrop-filter:blur(14px);z-index:5}
.stage{position:relative;display:flex;align-items:center;justify-content:center;min-height:0;padding:26px 18px;overflow:hidden}
.book-host{width:min(var(--share-spread-width,960px),78vw);height:min(64dvh,var(--share-page-height,678px));display:flex;align-items:center;justify-content:center}
.share-page{position:relative;width:100%;height:100%;overflow:hidden;background:#fff}
.share-page>img{display:block;width:100%;height:100%;object-fit:fill;user-select:none;-webkit-user-drag:none}
.share-page.stf__item{position:absolute}
.nav{display:flex;align-items:center;justify-content:center;gap:18px;padding:14px 20px 22px;z-index:5}
.nav button{width:44px;height:44px;border:0;border-radius:50%;background:#fff;font-size:22px;box-shadow:0 4px 14px #0001;cursor:pointer;color:#222}
.nav button:disabled{opacity:.3;cursor:default}
.count{min-width:150px;text-align:center;color:#666;font-size:12px}
.hint{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);font-size:10px;color:#777;white-space:nowrap;pointer-events:none}
.single-static{width:min(var(--share-page-width,480px),68vw)!important;height:auto!important;filter:drop-shadow(0 18px 22px #0003)}
.single-static .share-page{display:block!important;position:relative!important;aspect-ratio:1200/1696}
#book{transition:transform .28s cubic-bezier(.2,.72,.2,1)}
#book.is-cover{transform:translateX(-25%)}
#book.is-back-cover{transform:translateX(25%)}
.book-rendering .stf__parent{filter:drop-shadow(0 15px 18px #00000028) drop-shadow(0 28px 30px #00000016)}
.book-rendering .share-page{box-shadow:inset 0 0 0 1px #00000010}
.cover-grain-layer{position:absolute;inset:0;z-index:12;background-position:center;background-size:cover;mix-blend-mode:multiply;opacity:.5;pointer-events:none}
.cover-spine-layer{position:absolute;left:0;top:0;bottom:0;width:5.33%;z-index:13;background:linear-gradient(90deg,#ffffff45,transparent 28%,#00000014 48%,#ffffff29 80%,transparent);pointer-events:none}
.share-back-cover .cover-spine-layer{left:auto;right:0;transform:scaleX(-1)}
.book-rendering .share-page[data-cover=true].--simple,.book-rendering .share-back-cover.--simple{border-radius:1px 3px 3px 1px;box-shadow:inset -2px 0 3px #0002,inset 0 1px 2px #fff9,3px 4px 5px #0003,0 22px 34px #0003}
.book-rendering .share-back-cover.--simple{border-radius:3px 1px 1px 3px}
.book-rendering .share-page.--simple::after{content:"";position:absolute;inset:0;z-index:15;pointer-events:none;border:1px solid #00000012}
.book-rendering .share-page[data-cover=true].--simple::after,.book-rendering .share-back-cover.--simple::after{display:none}
.book-rendering .share-page.--simple.--left::after{background:linear-gradient(90deg,#00000008,transparent 3%,transparent 89%,#00000008 95%,#00000028 99%,#00000055)}
.book-rendering .share-page.--simple.--right::after{background:linear-gradient(90deg,#00000040,#ffffff33 .6%,#00000015 2%,transparent 8%,transparent 97%,#00000008)}
.load-error{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:8;padding:7px 11px;border-radius:999px;background:#ffffffdb;box-shadow:0 3px 12px #0001;color:#777;font-size:10px;text-align:center;pointer-events:none;white-space:nowrap}
.load-error[hidden]{display:none}
@media(max-width:640px){
  .top{padding:13px 16px}
  .stage{padding:14px 6px}
  .book-host{width:min(var(--share-spread-width,960px),84vw);height:min(62dvh,var(--share-page-height,678px))}
  .nav{padding-bottom:max(16px,env(safe-area-inset-bottom))}
  .count{min-width:112px}
  .hint{display:none}
}
`.trim();

export function buildShareViewerScript(input:Omit<ShareHtmlInput,'title'|'libraryScript'>){
  const pages=serializeInlineJson(input.pages);
  const labels=serializeInlineJson(input.labels);
  const coverTexture=serializeInlineJson(input.coverTexture);
  const backColor=serializeInlineJson(input.backColor);
  const backPage=serializeInlineJson(input.backPage);
  const leafPlan=serializeInlineJson(input.leafPlan);
  const viewerConfig=serializeInlineJson(input.viewerConfig);

  return `
const pages=${pages},labels=${labels},showCover=${String(input.showCover)},coverTexture=${coverTexture},backColor=${backColor},backPage=${backPage},leafPlan=${leafPlan},viewerConfig=${viewerConfig};
const root=document.getElementById("book"),count=document.getElementById("count"),prev=document.getElementById("prev"),next=document.getElementById("next"),stage=document.getElementById("stage"),loadError=document.getElementById("load-error");
const needsFiller=showCover&&leafPlan.needsFiller,backIndex=showCover?leafPlan.backIndex:-1;
const viewerPageWidth=Math.max(1,Number(viewerConfig.maxWidth)||Number(viewerConfig.width)||480),viewerPageHeight=Math.max(1,Number(viewerConfig.maxHeight)||Number(viewerConfig.height)||678);
document.documentElement.style.setProperty("--share-page-width",viewerPageWidth+"px");
document.documentElement.style.setProperty("--share-page-height",viewerPageHeight+"px");
document.documentElement.style.setProperty("--share-spread-width",viewerPageWidth*2+"px");

function decorateCover(leaf,back){
  const grain=document.createElement("span");
  grain.className="cover-grain-layer";
  if(coverTexture)grain.style.backgroundImage="url("+coverTexture+")";
  const spine=document.createElement("span");
  spine.className="cover-spine-layer";
  leaf.append(grain,spine);
  if(back)leaf.classList.add("share-back-cover");
}

function makeLeaf(src,label,density,cover,staticMode){
  const leaf=document.createElement("div");
  leaf.className="share-page";
  leaf.dataset.density=density;
  if(cover)leaf.dataset.cover="true";
  if(staticMode){
    leaf.style.position="relative";
    leaf.style.width="min("+viewerPageWidth+"px,39vw)";
    leaf.style.height="auto";
    leaf.style.aspectRatio="1200/1696";
    leaf.style.display="block";
  }
  if(src){
    const img=document.createElement("img");
    img.src=src;
    img.alt=label;
    leaf.appendChild(img);
  }
  if(cover)decorateCover(leaf,false);
  return leaf;
}

function makeBlank(staticMode){
  const leaf=makeLeaf("","空白页","soft",false,staticMode);
  leaf.classList.add("share-blank");
  return leaf;
}

function makeBack(staticMode){
  const leaf=makeLeaf(backPage,"后封面","hard",false,staticMode);
  leaf.dataset.back="true";
  leaf.style.backgroundColor=backColor;
  decorateCover(leaf,true);
  return leaf;
}

function buildLeaves(){
  const leaves=pages.map((src,i)=>makeLeaf(src,labels[i],showCover&&i===0?"hard":"soft",showCover&&i===0,false));
  if(showCover){
    if(needsFiller)leaves.push(makeBlank(false));
    leaves.push(makeBack(false));
  }
  return leaves;
}

root.replaceChildren(...buildLeaves());

if(pages.length<=1&&!showCover){
  root.classList.add("single-static");
  count.textContent=labels[0]||"1 / 1";
  prev.disabled=true;
  next.disabled=true;
}else if(!window.St||!window.St.PageFlip){
  loadError.hidden=false;
  let staticIndex=0;

  function renderStatic(){
    const coverOnly=showCover&&staticIndex===0,backOnly=showCover&&staticIndex===backIndex;
    root.classList.remove("single-static","is-cover","is-back-cover");
    root.style.display="flex";
    root.style.alignItems="center";
    root.style.justifyContent="center";
    root.style.width="min("+viewerPageWidth*2+"px,78vw)";
    root.style.height="min(64dvh,"+viewerPageHeight+"px)";

    if(backOnly){
      root.replaceChildren(makeBack(true));
      count.textContent="后封面";
    }else{
      const visible=coverOnly?[0]:[staticIndex,staticIndex+1].filter(i=>i<pages.length);
      const nodes=visible.map(i=>makeLeaf(pages[i],labels[i],showCover&&i===0?"hard":"soft",showCover&&i===0,true));
      if(showCover&&!coverOnly&&needsFiller&&staticIndex+1===pages.length)nodes.push(makeBlank(true));
      root.replaceChildren(...nodes);
      count.textContent=coverOnly?(labels[0]||"封面"):(labels[staticIndex]||"")+(visible.length>1?"  ·  "+labels[staticIndex+1]:"");
    }

    prev.disabled=staticIndex<=0;
    next.disabled=showCover?staticIndex>=backIndex:(staticIndex+2>=pages.length);
  }

  function staticNext(){
    if(next.disabled)return;
    if(showCover){
      if(staticIndex===0)staticIndex=1;
      else if(staticIndex+2>=backIndex)staticIndex=backIndex;
      else staticIndex+=2;
    }else staticIndex=Math.min(pages.length-1,staticIndex+2);
    renderStatic();
  }

  function staticPrev(){
    if(prev.disabled)return;
    if(showCover){
      if(staticIndex===backIndex)staticIndex=pages.length<=1?0:Math.max(1,backIndex-2);
      else if(staticIndex<=1)staticIndex=0;
      else staticIndex=Math.max(1,staticIndex-2);
    }else staticIndex=Math.max(0,staticIndex-2);
    renderStatic();
  }

  prev.onclick=staticPrev;
  next.onclick=staticNext;
  addEventListener("keydown",event=>{
    if(event.key==="ArrowRight")staticNext();
    if(event.key==="ArrowLeft")staticPrev();
  });
  renderStatic();
}else{
  const pageFlip=new St.PageFlip(root,{
    width:viewerConfig.width,
    height:viewerConfig.height,
    size:"stretch",
    minWidth:viewerConfig.minWidth,
    maxWidth:viewerConfig.maxWidth,
    minHeight:viewerConfig.minHeight,
    maxHeight:viewerConfig.maxHeight,
    drawShadow:true,
    flippingTime:viewerConfig.flippingTime,
    usePortrait:true,
    startZIndex:0,
    autoSize:true,
    maxShadowOpacity:viewerConfig.maxShadowOpacity,
    showCover,
    mobileScrollSupport:true,
    clickEventForward:true,
    useMouseEvents:true,
    swipeDistance:viewerConfig.swipeDistance,
    showPageCorners:true,
    disableFlipByClick:false
  });
  pageFlip.loadFromHTML(root.querySelectorAll(".share-page"));

  function currentIndex(value){
    const number=Number(value);
    return Number.isFinite(number)?number:(pageFlip.getCurrentPageIndex?Number(pageFlip.getCurrentPageIndex()):0)||0;
  }

  function update(value){
    const index=currentIndex(value);
    const coverOnly=showCover&&index===0;
    const backOnly=showCover&&index===backIndex;
    const second=!coverOnly&&!backOnly&&index+1<pages.length;
    const landscape=!pageFlip.getOrientation||pageFlip.getOrientation()!=="portrait";
    count.textContent=backOnly?"后封面":coverOnly?(labels[0]||"封面"):(labels[index]||"")+(second?"  ·  "+labels[index+1]:"");
    prev.disabled=index<=0;
    next.disabled=showCover?index>=backIndex:(index+2>=pages.length);
    root.classList.toggle("is-cover",landscape&&coverOnly);
    root.classList.toggle("is-back-cover",landscape&&backOnly);
  }

  function flipPrevSafely(){
    const rect=pageFlip.getBoundsRect&&pageFlip.getBoundsRect();
    const controller=pageFlip.getFlipController&&pageFlip.getFlipController();
    if(controller&&controller.flip&&rect&&Number.isFinite(rect.left)){
      controller.flip({x:rect.left+10,y:1});
      return;
    }
    pageFlip.flipPrev(viewerConfig.corner);
  }

  function goNext(){
    if(!next.disabled)pageFlip.flipNext(viewerConfig.corner);
  }

  function goPrev(){
    if(!prev.disabled)flipPrevSafely();
  }

  pageFlip.on("flip",event=>update(event.data));
  pageFlip.on("init",event=>update(event.data&&event.data.page));
  pageFlip.on("update",event=>update(event.data&&event.data.page));
  pageFlip.on("changeOrientation",()=>update());
  prev.onclick=goPrev;
  next.onclick=goNext;
  addEventListener("keydown",event=>{
    if(event.key==="ArrowRight")goNext();
    if(event.key==="ArrowLeft")goPrev();
  });

  let wheelSum=0,wheelLocked=false,wheelTimer=0;
  stage.addEventListener("wheel",event=>{
    if(Math.abs(event.deltaY)<2)return;
    event.preventDefault();
    if(wheelLocked)return;
    wheelSum+=event.deltaY;
    if(Math.abs(wheelSum)<28)return;
    const forward=wheelSum>0;
    wheelSum=0;
    wheelLocked=true;
    forward?goNext():goPrev();
    clearTimeout(wheelTimer);
    wheelTimer=setTimeout(()=>wheelLocked=false,360);
  },{passive:false});

  update(0);
}
`.trim();
}

export function buildShareHtmlDocument(input:ShareHtmlInput){
  const title=escapeShareHtml(input.title);
  const viewerScript=buildShareViewerScript(input);
  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    `<title>${title}</title>`,
    `<style>${SHARE_VIEWER_CSS}</style>`,
    '</head>',
    '<body class="book-rendering">',
    `<div class="top"><span>${title}</span><span>FLIPBOOK</span></div>`,
    '<main class="stage" id="stage">',
    '<div class="book-host"><div id="book"></div></div>',
    '<div id="load-error" class="load-error" hidden>翻页组件加载失败，已切换静态阅读模式。</div>',
    '<span class="hint">拖动书角或滚轮翻页</span>',
    '</main>',
    '<div class="nav"><button id="prev" aria-label="上一页">‹</button><span id="count" class="count"></span><button id="next" aria-label="下一页">›</button></div>',
    input.libraryScript,
    `<script>${viewerScript}</script>`,
    '</body>',
    '</html>',
  ].join('');
}
