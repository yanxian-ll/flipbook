const MOBILE_READER_CONTROL=String.raw`
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
    '.stage{touch-action:none!important;overscroll-behavior:none!important}',
    '.top{position:fixed!important;left:0!important;right:0!important;top:0!important;z-index:30!important;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:10px 14px!important;pointer-events:none!important;opacity:.82!important;transition:opacity .28s ease!important;text-shadow:0 1px 5px #fff,0 1px 10px #fff8}',
    '.top.share-top-hidden{opacity:0!important}',
    '.share-book-pan-frame,.share-book-zoom-frame,.share-book-rotate-frame{position:relative;display:flex;align-items:center;justify-content:center;flex:0 0 auto;transform-origin:center center;will-change:transform}',
    '.share-book-pan-frame{touch-action:none!important}',
    '.share-book-zoom-frame{transition:transform .12s ease}',
    '.share-book-rotate-frame{transition:transform .28s cubic-bezier(.2,.72,.2,1)}',
    '.stage.detail-pinching .share-book-zoom-frame,.stage.detail-panning .share-book-pan-frame{transition:none}',
    '.share-rotate-control{font-size:20px!important;font-weight:700;line-height:1}',
    '.share-rotate-control[aria-pressed="true"]{background:#222!important;color:#fff!important}',
    '@media (pointer:fine) and (min-width:900px){.share-rotate-control{display:none!important}}'
  ].join('');
  document.head.appendChild(style);

  const rotateFrame=document.createElement('div');
  rotateFrame.className='share-book-rotate-frame';
  bookHost.parentNode.insertBefore(rotateFrame,bookHost);
  rotateFrame.appendChild(bookHost);

  const zoomFrame=document.createElement('div');
  zoomFrame.className='share-book-zoom-frame';
  rotateFrame.parentNode.insertBefore(zoomFrame,rotateFrame);
  zoomFrame.appendChild(rotateFrame);

  const panFrame=document.createElement('div');
  panFrame.className='share-book-pan-frame';
  zoomFrame.parentNode.insertBefore(panFrame,zoomFrame);
  panFrame.appendChild(zoomFrame);

  const rotateButton=document.createElement('button');
  rotateButton.id='rotate-view';
  rotateButton.className='page-button share-rotate-control';
  rotateButton.type='button';
  rotateButton.textContent='↻';
  rotateButton.setAttribute('aria-label','旋转画册');
  rotateButton.setAttribute('aria-pressed','false');
  rotateButton.title='旋转画册';
  nav.appendChild(rotateButton);

  const fullPageWidth=480;
  const fullPageHeight=678;
  const fullSpreadWidth=fullPageWidth*2;
  const mobileMinPageWidth=64;
  const longPressMs=280;
  const tapMoveTolerance=10;
  const swipeDistance=26;

  let rotated=false;
  let rotateScale=1;
  let detailScale=1;
  let panX=0;
  let panY=0;
  let fitFrame=0;
  let layoutFrame=0;
  let topTimer=0;
  let activePageFlip=null;
  let originalPageFlipSize=null;
  let appliedHostWidth=0;
  let appliedHostHeight=0;
  let pinchActive=false;
  let pinchStartDistance=0;
  let pinchStartScale=1;
  let pinchAnchorX=0;
  let pinchAnchorY=0;
  let touchView=null;
  let mouseView=null;
  let longPressTimer=0;
  let suppressClickUntil=0;

  function availableStageSize(){
    const computed=getComputedStyle(stage);
    const horizontal=(parseFloat(computed.paddingLeft)||0)+(parseFloat(computed.paddingRight)||0);
    const vertical=(parseFloat(computed.paddingTop)||0)+(parseFloat(computed.paddingBottom)||0);
    return {
      width:Math.max(1,stage.clientWidth-horizontal),
      height:Math.max(1,stage.clientHeight-vertical)
    };
  }

  function stageCenter(){
    const rect=stage.getBoundingClientRect();
    return {x:rect.left+rect.width/2,y:rect.top+rect.height/2};
  }

  function desiredRotatedHostSize(){
    const available=availableStageSize();
    const aspect=fullSpreadWidth/fullPageHeight;
    const maxLogicalWidth=Math.max(1,available.height*.965);
    const maxLogicalHeight=Math.max(1,available.width*.965);
    let width=Math.min(fullSpreadWidth,maxLogicalWidth);
    let height=width/aspect;
    if(height>maxLogicalHeight){
      height=Math.min(fullPageHeight,maxLogicalHeight);
      width=height*aspect;
    }
    return {width:Math.max(1,width),height:Math.max(1,height)};
  }

  function makeSettingsMobileResponsive(settings){
    if(!settings)return;
    const pageWidth=Math.max(1,Number(settings.width)||fullPageWidth);
    const pageHeight=Math.max(1,Number(settings.height)||fullPageHeight);
    const responsiveMinWidth=Math.min(Math.max(1,Number(settings.minWidth)||mobileMinPageWidth),mobileMinPageWidth);
    const responsiveMinHeight=Math.max(1,Math.round(responsiveMinWidth*pageHeight/pageWidth));
    settings.usePortrait=false;
    settings.minWidth=responsiveMinWidth;
    settings.minHeight=Math.min(Math.max(1,Number(settings.minHeight)||responsiveMinHeight),responsiveMinHeight);
  }

  function rememberPageFlipSize(){
    if(!activePageFlip||originalPageFlipSize)return;
    try{
      const settings=activePageFlip.getSettings&&activePageFlip.getSettings();
      if(!settings)return;
      originalPageFlipSize={
        width:settings.width,
        height:settings.height,
        minWidth:settings.minWidth,
        maxWidth:settings.maxWidth,
        minHeight:settings.minHeight,
        maxHeight:settings.maxHeight
      };
    }catch{}
  }

  function applyPageFlipSize(target){
    if(!activePageFlip)return;
    try{
      const settings=activePageFlip.getSettings&&activePageFlip.getSettings();
      if(!settings)return;
      rememberPageFlipSize();
      if(!originalPageFlipSize)return;
      if(!target){
        Object.assign(settings,originalPageFlipSize);
        makeSettingsMobileResponsive(settings);
        return;
      }
      const pageWidth=Math.max(1,target.width/2);
      const pageHeight=Math.max(1,target.height);
      settings.width=pageWidth;
      settings.height=pageHeight;
      settings.usePortrait=false;
      settings.minWidth=Math.min(mobileMinPageWidth,pageWidth);
      settings.maxWidth=Math.max(pageWidth,settings.minWidth);
      settings.minHeight=Math.min(Math.max(1,Math.round(settings.minWidth*pageHeight/pageWidth)),pageHeight);
      settings.maxHeight=Math.max(pageHeight,settings.minHeight);
    }catch{}
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

  function baseVisualSize(){
    const width=Math.max(1,rotateFrame.offsetWidth||bookHost.offsetWidth);
    const height=Math.max(1,rotateFrame.offsetHeight||bookHost.offsetHeight);
    return rotated?{width:height*rotateScale,height:width*rotateScale}:{width,height};
  }

  function clampPan(){
    if(detailScale<=1.001){panX=0;panY=0;return;}
    const available=availableStageSize();
    const base=baseVisualSize();
    const maxX=Math.max(0,(base.width*detailScale-available.width)/2+12);
    const maxY=Math.max(0,(base.height*detailScale-available.height)/2+12);
    panX=Math.max(-maxX,Math.min(maxX,panX));
    panY=Math.max(-maxY,Math.min(maxY,panY));
  }

  function applyDetailTransform(){
    clampPan();
    panFrame.style.transform=detailScale>1.001?'translate3d('+panX+'px,'+panY+'px,0)':'';
    zoomFrame.style.transform=detailScale>1.001?'scale('+detailScale+')':'';
    stage.classList.toggle('detail-zoom',detailScale>1.001);
  }

  function setDetailScale(value,clientX,clientY){
    const next=Math.max(1,Math.min(4,Number(value)||1));
    const old=Math.max(.0001,detailScale);
    if(next<=1.001){
      detailScale=1;
      panX=0;
      panY=0;
      applyDetailTransform();
      return;
    }
    if(Number.isFinite(clientX)&&Number.isFinite(clientY)){
      const center=stageCenter();
      const sx=clientX-center.x;
      const sy=clientY-center.y;
      panX=sx-(sx-panX)*(next/old);
      panY=sy-(sy-panY)*(next/old);
    }
    detailScale=next;
    applyDetailTransform();
  }

  function resetDetailView(){
    detailScale=1;
    panX=0;
    panY=0;
    pinchActive=false;
    pinchStartDistance=0;
    touchView=null;
    mouseView=null;
    clearTimeout(longPressTimer);
    stage.classList.remove('detail-zoom','detail-pinching','detail-panning');
    panFrame.style.transform='';
    zoomFrame.style.transform='';
  }

  function applyRotatedHostSize(){
    if(!rotated){
      applyPageFlipSize(null);
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
    applyPageFlipSize(target);
    if(Math.abs(target.width-appliedHostWidth)<.5&&Math.abs(target.height-appliedHostHeight)<.5)return;
    appliedHostWidth=target.width;
    appliedHostHeight=target.height;
    bookHost.style.width=target.width+'px';
    bookHost.style.height=target.height+'px';
    refreshPageFlipLayout();
  }

  function fitBook(){
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      applyRotatedHostSize();
      requestAnimationFrame(()=>{
        const width=Math.max(1,bookHost.offsetWidth);
        const height=Math.max(1,bookHost.offsetHeight);
        for(const frame of [rotateFrame,zoomFrame,panFrame]){
          frame.style.width=width+'px';
          frame.style.height=height+'px';
        }
        if(!rotated){
          rotateScale=1;
          rotateFrame.style.transform='';
          applyDetailTransform();
          return;
        }
        const available=availableStageSize();
        rotateScale=Math.max(.1,Math.min(1,available.width/height,available.height/width)*.995);
        rotateFrame.style.transform='rotate(90deg) scale('+rotateScale+')';
        applyDetailTransform();
      });
    });
  }

  function setRotated(active){
    rotated=active;
    rotateButton.setAttribute('aria-pressed',String(active));
    rotateButton.setAttribute('aria-label',active?'恢复画册方向':'旋转画册');
    rotateButton.title=active?'恢复画册方向':'旋转画册';
    fitBook();
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
    const scale=Math.max(.0001,rotateScale*detailScale);
    const localX=(clientY-centerY)/scale+width/2;
    const localY=height/2-(clientX-centerX)/scale;
    const offset=offsetInsideFrame(element);
    return {x:localX-offset.x,y:localY-offset.y};
  }

  function stopAutoplayForManualView(){
    const autoplay=document.getElementById('autoplay');
    if(autoplay&&autoplay.getAttribute('aria-pressed')==='true')autoplay.click();
  }

  function flipFromTap(clientX,clientY){
    if(!activePageFlip)return;
    stopAutoplayForManualView();
    const book=document.getElementById('book');
    if(book&&book.classList.contains('is-cover')){
      activePageFlip.flipNext&&activePageFlip.flipNext('top');
      return;
    }
    if(book&&book.classList.contains('is-back-cover')){
      activePageFlip.flipPrev&&activePageFlip.flipPrev('top');
      return;
    }
    const rect=rotateFrame.getBoundingClientRect();
    let dx=(clientX-(rect.left+rect.width/2))/Math.max(.0001,detailScale);
    let dy=(clientY-(rect.top+rect.height/2))/Math.max(.0001,detailScale);
    if(rotated){
      const x=dy/Math.max(.0001,rotateScale);
      const y=-dx/Math.max(.0001,rotateScale);
      dx=x;dy=y;
    }
    if(dx>=0)activePageFlip.flipNext&&activePageFlip.flipNext('top');
    else activePageFlip.flipPrev&&activePageFlip.flipPrev('top');
  }

  function flipFromSwipe(dx,dy){
    if(!activePageFlip)return false;
    let logicalX=dx,logicalY=dy;
    if(rotated){
      logicalX=dy/Math.max(.0001,rotateScale);
      logicalY=-dx/Math.max(.0001,rotateScale);
    }
    if(Math.abs(logicalX)<swipeDistance||Math.abs(logicalX)<Math.abs(logicalY))return false;
    stopAutoplayForManualView();
    if(logicalX<0)activePageFlip.flipNext&&activePageFlip.flipNext('top');
    else activePageFlip.flipPrev&&activePageFlip.flipPrev('top');
    return true;
  }

  function touchDistance(a,b){return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);}
  function touchCenter(a,b){return {x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};}
  function findTouch(event,id){
    for(const touch of Array.from(event.touches||[]))if(touch.identifier===id)return touch;
    for(const touch of Array.from(event.changedTouches||[]))if(touch.identifier===id)return touch;
    return null;
  }

  function beginLongPress(view){
    clearTimeout(longPressTimer);
    if(detailScale<=1.001)return;
    longPressTimer=setTimeout(()=>{
      if(view!==touchView&&view!==mouseView)return;
      view.panning=true;
      stage.classList.add('detail-panning');
    },longPressMs);
  }

  stage.addEventListener('wheel',event=>{
    if(!event.ctrlKey)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stopAutoplayForManualView();
    const factor=Math.exp(-event.deltaY*.0025);
    setDetailScale(detailScale*factor,event.clientX,event.clientY);
  },{passive:false,capture:true});

  stage.addEventListener('touchstart',event=>{
    if(event.touches.length===2){
      event.preventDefault();
      event.stopImmediatePropagation();
      stopAutoplayForManualView();
      clearTimeout(longPressTimer);
      touchView=null;
      pinchActive=true;
      const a=event.touches[0],b=event.touches[1];
      const center=touchCenter(a,b),stageMid=stageCenter();
      pinchStartDistance=Math.max(1,touchDistance(a,b));
      pinchStartScale=detailScale;
      pinchAnchorX=(center.x-stageMid.x-panX)/Math.max(.0001,detailScale);
      pinchAnchorY=(center.y-stageMid.y-panY)/Math.max(.0001,detailScale);
      stage.classList.add('detail-pinching');
      return;
    }
    if(event.touches.length===1){
      event.preventDefault();
      event.stopImmediatePropagation();
      stopAutoplayForManualView();
      const touch=event.touches[0];
      touchView={id:touch.identifier,startX:touch.clientX,startY:touch.clientY,lastX:touch.clientX,lastY:touch.clientY,panning:false,moved:false};
      beginLongPress(touchView);
    }
  },{passive:false,capture:true});

  stage.addEventListener('touchmove',event=>{
    if(pinchActive&&event.touches.length>=2){
      event.preventDefault();
      event.stopImmediatePropagation();
      const a=event.touches[0],b=event.touches[1];
      const center=touchCenter(a,b),stageMid=stageCenter();
      detailScale=Math.max(1,Math.min(4,pinchStartScale*touchDistance(a,b)/Math.max(1,pinchStartDistance)));
      if(detailScale<=1.001){detailScale=1;panX=0;panY=0;}
      else{
        panX=center.x-stageMid.x-pinchAnchorX*detailScale;
        panY=center.y-stageMid.y-pinchAnchorY*detailScale;
      }
      applyDetailTransform();
      return;
    }
    if(!touchView)return;
    const touch=findTouch(event,touchView.id);
    if(!touch)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const total=Math.hypot(touch.clientX-touchView.startX,touch.clientY-touchView.startY);
    if(total>tapMoveTolerance)touchView.moved=true;
    if(touchView.panning&&detailScale>1.001){
      panX+=touch.clientX-touchView.lastX;
      panY+=touch.clientY-touchView.lastY;
      applyDetailTransform();
    }
    touchView.lastX=touch.clientX;
    touchView.lastY=touch.clientY;
  },{passive:false,capture:true});

  stage.addEventListener('touchend',event=>{
    if(pinchActive){
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClickUntil=performance.now()+600;
      if(event.touches.length<2){
        pinchActive=false;
        pinchStartDistance=0;
        stage.classList.remove('detail-pinching');
        applyDetailTransform();
      }
      return;
    }
    if(!touchView)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(longPressTimer);
    const view=touchView;
    const touch=findTouch(event,view.id);
    touchView=null;
    stage.classList.remove('detail-panning');
    suppressClickUntil=performance.now()+450;
    if(view.panning||!touch)return;
    const dx=touch.clientX-view.startX;
    const dy=touch.clientY-view.startY;
    if(!view.moved)flipFromTap(touch.clientX,touch.clientY);
    else flipFromSwipe(dx,dy);
  },{passive:false,capture:true});

  stage.addEventListener('touchcancel',event=>{
    if(!pinchActive&&!touchView)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pinchActive=false;
    touchView=null;
    clearTimeout(longPressTimer);
    suppressClickUntil=performance.now()+550;
    stage.classList.remove('detail-pinching','detail-panning');
  },{passive:false,capture:true});

  stage.addEventListener('mousedown',event=>{
    if(detailScale<=1.001||event.button!==0)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    stopAutoplayForManualView();
    mouseView={startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,panning:false,moved:false};
    beginLongPress(mouseView);
  },{capture:true});

  window.addEventListener('mousemove',event=>{
    if(!mouseView)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const total=Math.hypot(event.clientX-mouseView.startX,event.clientY-mouseView.startY);
    if(total>tapMoveTolerance)mouseView.moved=true;
    if(mouseView.panning){
      panX+=event.clientX-mouseView.lastX;
      panY+=event.clientY-mouseView.lastY;
      applyDetailTransform();
    }
    mouseView.lastX=event.clientX;
    mouseView.lastY=event.clientY;
  },{capture:true});

  window.addEventListener('mouseup',event=>{
    if(!mouseView)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    clearTimeout(longPressTimer);
    const view=mouseView;
    mouseView=null;
    stage.classList.remove('detail-panning');
    suppressClickUntil=performance.now()+400;
    if(!view.panning&&!view.moved)flipFromTap(event.clientX,event.clientY);
  },{capture:true});

  stage.addEventListener('click',event=>{
    if(performance.now()<suppressClickUntil){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },{capture:true});

  const PageFlipCtor=window.St&&window.St.PageFlip;
  if(PageFlipCtor&&PageFlipCtor.prototype&&!PageFlipCtor.prototype.__shareReaderPatched){
    const nativeLoad=PageFlipCtor.prototype.loadFromHTML;
    PageFlipCtor.prototype.loadFromHTML=function(items){
      activePageFlip=this;
      try{makeSettingsMobileResponsive(this.getSettings&&this.getSettings());}catch{}
      const result=nativeLoad.call(this,items);
      rememberPageFlipSize();
      const ui=this.getUI&&this.getUI();
      if(ui&&typeof ui.getMousePos==='function'&&!ui.__shareReaderPatched){
        const nativeGetMousePos=ui.getMousePos.bind(ui);
        const distElement=ui.getDistElement&&ui.getDistElement();
        ui.getMousePos=(clientX,clientY)=>rotated&&distElement
          ?rotatedPointFor(distElement,clientX,clientY)
          :nativeGetMousePos(clientX,clientY);
        ui.__shareReaderPatched=true;
      }
      requestAnimationFrame(fitBook);
      return result;
    };
    PageFlipCtor.prototype.__shareReaderPatched=true;
  }

  rotateButton.addEventListener('click',()=>{
    stopAutoplayForManualView();
    resetDetailView();
    setRotated(!rotated);
  });

  window.addEventListener('keydown',event=>{
    if(event.key==='Escape')resetDetailView();
  },{capture:true});

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
      if(rotated)fitBook();
      else{
        refreshPageFlipLayout();
        fitBook();
      }
    });
    observer.observe(stage);
    observer.observe(nav);
  }
  window.addEventListener('resize',fitBook,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(fitBook,80),{passive:true});
  fitBook();
})();
`;

export async function loadEmbeddedPageFlipBundle(){
  const module=await import('page-flip/dist/js/page-flip.browser.js?raw');
  return (module.default+MOBILE_READER_CONTROL).replace(/<\/script/gi,'<\\/script');
}
