const MOBILE_ROTATE_CONTROL=String.raw`
;(()=>{
  const nav=document.querySelector('.nav');
  const stage=document.getElementById('stage');
  const bookHost=document.getElementById('book-host');
  const topBar=document.querySelector('.top');
  if(!nav||!stage||!bookHost||document.getElementById('rotate-view'))return;

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
  let fitFrame=0;
  let topTimer=0;

  function availableStageSize(){
    const computed=getComputedStyle(stage);
    const horizontal=(parseFloat(computed.paddingLeft)||0)+(parseFloat(computed.paddingRight)||0);
    const vertical=(parseFloat(computed.paddingTop)||0)+(parseFloat(computed.paddingBottom)||0);
    return {
      width:Math.max(1,stage.clientWidth-horizontal),
      height:Math.max(1,stage.clientHeight-vertical)
    };
  }

  function fitRotatedBook(){
    cancelAnimationFrame(fitFrame);
    fitFrame=requestAnimationFrame(()=>{
      const width=Math.max(1,bookHost.offsetWidth);
      const height=Math.max(1,bookHost.offsetHeight);
      rotateFrame.style.width=width+'px';
      rotateFrame.style.height=height+'px';
      if(!rotated){
        rotateFrame.style.transform='';
        return;
      }
      const available=availableStageSize();
      const scale=Math.max(.1,Math.min(1.15,available.width/height,available.height/width)*.97);
      rotateFrame.style.transform='rotate(90deg) scale('+scale+')';
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
    const observer=new ResizeObserver(fitRotatedBook);
    observer.observe(stage);
    observer.observe(bookHost);
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
