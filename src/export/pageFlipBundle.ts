const MOBILE_ROTATE_CONTROL=String.raw`
;(()=>{
  const nav=document.querySelector('.nav');
  if(!nav||document.getElementById('rotate-view'))return;

  const style=document.createElement('style');
  style.textContent='.share-rotate-control{font-size:20px!important;font-weight:700;line-height:1}.share-rotate-control[aria-pressed="true"]{background:#222!important;color:#fff!important}html.share-manual-landscape{overflow:hidden!important}html.share-manual-landscape body{position:fixed!important;left:50%!important;top:50%!important;width:100dvh!important;height:100dvw!important;min-height:100dvw!important;max-height:100dvw!important;transform:translate(-50%,-50%) rotate(90deg);transform-origin:center center;overflow:hidden!important}@media (pointer:fine) and (min-width:900px){.share-rotate-control{display:none!important}}';
  document.head.appendChild(style);

  const button=document.createElement('button');
  button.id='rotate-view';
  button.className='page-button share-rotate-control';
  button.type='button';
  button.textContent='↻';
  button.setAttribute('aria-label','旋转为横屏阅读');
  button.setAttribute('aria-pressed','false');
  button.title='横屏阅读';
  nav.appendChild(button);

  let nativeLocked=false;
  let fallbackRotated=false;
  let fullscreenByControl=false;
  const orientationMedia=window.matchMedia?window.matchMedia('(orientation: landscape)'):null;

  function setActive(active){
    button.setAttribute('aria-pressed',String(active));
    button.setAttribute('aria-label',active?'恢复自动方向':'旋转为横屏阅读');
    button.title=active?'恢复自动方向':'横屏阅读';
  }

  async function releaseLandscape(){
    document.documentElement.classList.remove('share-manual-landscape');
    fallbackRotated=false;
    if(nativeLocked&&screen.orientation&&typeof screen.orientation.unlock==='function'){
      try{screen.orientation.unlock();}catch{}
    }
    nativeLocked=false;
    if(fullscreenByControl&&document.fullscreenElement&&document.exitFullscreen){
      try{await document.exitFullscreen();}catch{}
    }
    fullscreenByControl=false;
    setActive(false);
  }

  async function tryNativeLandscape(){
    const orientation=screen.orientation;
    if(!orientation||typeof orientation.lock!=='function')return false;
    try{
      await orientation.lock('landscape');
      nativeLocked=true;
      return true;
    }catch{}

    const root=document.documentElement;
    if(root.requestFullscreen&&!document.fullscreenElement){
      try{
        await root.requestFullscreen({navigationUI:'hide'});
        fullscreenByControl=!!document.fullscreenElement;
      }catch{}
    }
    try{
      await orientation.lock('landscape');
      nativeLocked=true;
      return true;
    }catch{}

    if(fullscreenByControl&&document.fullscreenElement&&document.exitFullscreen){
      try{await document.exitFullscreen();}catch{}
    }
    fullscreenByControl=false;
    return false;
  }

  button.addEventListener('click',async()=>{
    const autoplay=document.getElementById('autoplay');
    if(autoplay&&autoplay.getAttribute('aria-pressed')==='true')autoplay.click();
    if(nativeLocked||fallbackRotated){
      await releaseLandscape();
      return;
    }
    if(orientationMedia&&orientationMedia.matches){
      setActive(false);
      return;
    }
    if(await tryNativeLandscape()){
      setActive(true);
      return;
    }
    fallbackRotated=true;
    document.documentElement.classList.add('share-manual-landscape');
    setActive(true);
  });

  const syncActualOrientation=()=>{
    if(fallbackRotated&&orientationMedia&&orientationMedia.matches){
      document.documentElement.classList.remove('share-manual-landscape');
      fallbackRotated=false;
      setActive(false);
    }
  };
  if(orientationMedia){
    if(orientationMedia.addEventListener)orientationMedia.addEventListener('change',syncActualOrientation);
    else if(orientationMedia.addListener)orientationMedia.addListener(syncActualOrientation);
  }
  document.addEventListener('fullscreenchange',()=>{
    if(fullscreenByControl&&!document.fullscreenElement&&!fallbackRotated){
      fullscreenByControl=false;
      nativeLocked=false;
      setActive(false);
    }
  });
})();
`;

export async function loadEmbeddedPageFlipBundle(){
  const module=await import('page-flip/dist/js/page-flip.browser.js?raw');
  return (module.default+MOBILE_ROTATE_CONTROL).replace(/<\/script/gi,'<\\/script');
}
