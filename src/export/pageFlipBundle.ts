export async function loadEmbeddedPageFlipBundle(){
  const module=await import('page-flip/dist/js/page-flip.browser.js?raw');
  return module.default.replace(/<\/script/gi,'<\\/script');
}
