const MOBILE_ROTATE_CONTROL=String.raw`
;(()=>{
  const nav=document.querySelector('.nav');
  const stage=document.getElementById('stage');
  const bookHost=document.getElementById('book-host');
  const topBar=document.querySelector('.top');
  if(!nav||!stage||!bookHost||document.getElementById('rotate-view'))return;

  document.querySelectorAll('.hint,.zoom-hint').forEach(node=>node.remove());

  const style=document.createElement('style');
  style.textContent=[
    'body{grid-template-rows:minmax(0,1fr) auto!important}',
    '.top{position:fixed!important;left:0!important;right:0!important;top:0!important;z-index:30!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:10px 14px!important;pointer-events:none!important;opacity:.82!important;transition:opacity .28s ease!important;text-shadow:0 1px 5px #fff,0 1px 10px #fff8}',
    '.top.share-top-hidden{opacity:0!important}',
    '.share-book-rotate-frame{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto;transform-origin:center center;will-change:transform;transition:transform .28s cubic-bezier(.2,.72,.2,1)}',
    '.share-rotate-control{font-size:20px!important;font-weight:700;line-height:1}',
    '.share-rotate-control[aria-pressed="true"]{background:#222!important;color:#fff!important}',
    '@media (pointer:fine) and (min-width:900px){.share-rotate-control{display:none!important}}'
  ].join('');
  document.head.appendChild(style);

  const rotateFrame=document.createElement('div');
  rotateFrame.className='share-book-rotate-frame';
  bookHost.parentNode.insertBefore(rotateFrame,bookHost);
  rotateFrame.appendChild(bookHost);

  const button=document.createElement('button');
  button.id='rotate-view';
  button.className='page-button share-rotate-control';
  button.type='button';
  button.textContent='↻';
  button.setAttribute('aria-label','旋转画册');
  button.setAttribute('aria-pressed','false');
  button.title='旋转画册';
  nav.appendChild(button);

  let rotated=false;
  let rotateScale=1;
  let fitFrame=0;
  let layoutFrame=0;
  let topTimer=0;
  let activePageFlip=null;
  let appliedHostWidth=0;
  let appliedHostHeight=0;

  function availableStageSize(){
    const computed=getComputedStyle(stage);
    const horizontal=(parseFloat(computed.paddingLeft)||0)+(parseFloat(computed.paddingRight)||0);
    const vertical=(parseFloat(computed.paddingTop)||0)+(parseFloat(computed.paddingBottom)||0);
    return {
      width:Math.max(1,stage.clientWidth-horizontal),
      height:Math.max(1,stage.clientHeight-vertical)
    };
  }

  function cssNumber(name,fallback){
    const value=parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
    return Number.isFinite(value)&&value>0?value:fallback;
  }

  function desiredRotatedHostSize(){
    const available=availableStageSize();
    const currentWidth=Math.max(1,bookHost.offsetWidth);
    const currentHeight=Math.max(1,bookHost.offsetHeight);
    const intrinsicWidth=cssNumber('--share-spread-width',currentWidth);
    const intrinsicHeight=cssNumber('--share-page-height',currentHeight);
    const aspect=Math.max(.2,intrinsicWidth/Math.max(1,intrinsicHeight));
    const maxLogicalWidth=Math.max(1,available.height*.965);
    const maxLogicalHeight=Math.max(1,available.width*.965);
    let width=Math.min(intrinsicWidth,maxLogicalWidth);
    let height=width/aspect;
    if(height>maxLogicalHeight){
      height=maxLogicalHeight;
      width=height*aspect;
    }
    return {width:Math.max(1,width),height:Math.max(1,height)};
  }

  function refreshPageFlipLayout(){
    cancelAnimationFrame(layoutFrame);
    layoutFrame=requestAnimationFrame(()=>{
      if(!activePageFlip)return;
      try{
        const ui=activePageFlip.getUI&&activePageFlip.getUI();
        if(ui&&typeof ui.update==='function')ui.update();
        if(typeof activePageFlip.update==='function')activePageFlip.update();
      }catch{}
    });
  }

  function applyRotatedHostSize(){
    if(!rotated){
      if(appliedHostWidth||appliedHostHeight){
        bookHost.style.width='';
        bookHost.style.height='';
        appliedHostWidth=0;
        appliedHostHeight=0;
        refreshPageFlipLayout();
      }
      return;
    }
    const target=desiredRotatedHostSize();
    if(Math.abs(target.width-appliedHostWidth)<.5&&Math.abs(target.height-appliedHostHeight)<.5)return;
    appliedHostWidth=target.width;
    appliedHostHeight=target.height;
    bookHost.style.width=target.width+'px';
    bookHost.style.height=target.height+'px';
    refreshPageFlipLayout();
  }

  function fitRotatedBook(){
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      applyRotatedHostSize();
      requestAnimationFrame(()=>{
        const width=Math.max(1,bookHost.offsetWidth);
        const height=Math.max(1,bookHost.offsetHeight);
        rotateFrame.style.width=width+'px';
        rotateFrame.style.height=height+'px';
        if(!rotated){
          rotateScale=1;
          rotateFrame.style.transform='';
          return;
        }
        const available=availableStageSize();
        rotateScale=Math.max(.1,Math.min(1,available.width/height,available.height/width)*.995);
        rotateFrame.style.transform='rotate(90deg) scale('+rotateScale+')';
      });
    });
  }

  function setRotated(active){
    rotated=active;
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',active?'恢复画册方向':'旋转画册');
    button.title=active?'恢复画册方向':'旋转画册';
    fitRotatedBook();
  }

  function resetDetailZoom(){
    try{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));}catch{}
    bookHost.style.transform='';
    bookHost.style.transformOrigin='50% 50%';
    stage.classList.remove('detail-zoom','pinching');
  }

  function offsetInsideFrame(element){
    let x=0,y=0,node=element;
    while(node&&node!==rotateFrame){
      x+=Number(node.offsetLeft)||0;
      y+=Number(node.offsetTop)||0;
      node=node.offsetParent;
    }
    if(node!==rotateFrame)return {x:0,y:0};
    return {x,y};
  }

  function rotatedPointFor(element,clientX,clientY){
    const rect=rotateFrame.getBoundingClientRect();
    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const width=Math.max(1,rotateFrame.offsetWidth);
    const height=Math.max(1,rotateFrame.offsetHeight);
    const scale=Math.max(.0001,rotateScale);
    const localX=(clientY-centerY)/scale+width/2;
    const localY=height/2-(clientX-centerX)/scale;
    const offset=offsetInsideFrame(element);
    return {x:localX-offset.x,y:localY-offset.y};
  }

  const PageFlipCtor=window.St&&window.St.PageFlip;
  if(PageFlipCtor&&PageFlipCtor.prototype&&!PageFlipCtor.prototype.__shareRotatePointerPatched){
    const nativeLoad=PageFlipCtor.prototype.loadFromHTML;
    PageFlipCtor.prototype.loadFromHTML=function(items){
      const result=nativeLoad.call(this,items);
      activePageFlip=this;
      const ui=this.getUI&&this.getUI();
      if(ui&&typeof ui.getMousePos==='function'&&!ui.__shareRotatePointerPatched){
        const nativeGetMousePos=ui.getMousePos.bind(ui);
        const distElement=ui.getDistElement&&ui.getDistElement();
        ui.getMousePos=(clientX,clientY)=>rotated&&distElement
          ?rotatedPointFor(distElement,clientX,clientY)
          :nativeGetMousePos(clientX,clientY);
        ui.__shareRotatePointerPatched=true;
      }
      return result;
    };
    PageFlipCtor.prototype.__shareRotatePointerPatched=true;
  }

  button.addEventListener('click',()=>{
    const autoplay=document.getElementById('autoplay');
    if(autoplay&&autoplay.getAttribute('aria-pressed')==='true')autoplay.click();
    resetDetailZoom();
    setRotated(!rotated);
  });

  function showTopBriefly(){
    if(!topBar)return;
    topBar.classList.remove('share-top-hidden');
    clearTimeout(topTimer);
    topTimer=setTimeout(()=>topBar.classList.add('share-top-hidden'),1600);
  }
  showTopBriefly();
  document.addEventListener('pointerdown',showTopBriefly,{passive:true});
  document.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')showTopBriefly();},{passive:true});

  if(typeof ResizeObserver!=='undefined'){
    const observer=new ResizeObserver(()=>{
      if(!rotated)fitRotatedBook();
    });
    observer.observe(stage);
    observer.observe(nav);
  }
  window.addEventListener('resize',fitRotatedBook,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(fitRotatedBook,80),{passive:true});
  fitRotatedBook();
})();
`;

export async function loadEmbeddedPageFlipBundle(){
  const module=await import('page-flip/dist/js/page-flip.browser.js?raw');
  return (module.default+MOBILE_ROTATE_CONTROL).replace(/<\/script/gi,'<\\/script');
}
