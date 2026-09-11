const {app,BrowserWindow,ipcMain,screen,shell}=require('electron');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const MIME_TYPES={
  '.css':'text/css; charset=utf-8',
  '.gif':'image/gif',
  '.html':'text/html; charset=utf-8',
  '.ico':'image/x-icon',
  '.jpeg':'image/jpeg',
  '.jpg':'image/jpeg',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.map':'application/json; charset=utf-8',
  '.png':'image/png',
  '.svg':'image/svg+xml',
  '.ttf':'font/ttf',
  '.webp':'image/webp',
  '.woff':'font/woff',
  '.woff2':'font/woff2',
};

const DEFAULT_RENDERER_PORT=41731;
const RENDERER_PORT_FILE='renderer-port.txt';
const COMPACT_WIDTH=430;
const COMPACT_HEIGHT=780;
const EXPANDED_WIDTH=1280;
const EXPANDED_HEIGHT=932;
const EXPANDED_THRESHOLD=640;
let server=null;
let serverOrigin='';

function safeFilePath(root,pathname){
  const relative=decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate=path.resolve(root,relative||'index.html');
  const rootPrefix=`${path.resolve(root)}${path.sep}`;
  return candidate===path.resolve(root)||candidate.startsWith(rootPrefix)?candidate:null;
}

function validPort(value){
  const port=Number(value);
  return Number.isInteger(port)&&port>=1024&&port<=65535?port:null;
}

function rendererPortFile(){
  return path.join(app.getPath('userData'),RENDERER_PORT_FILE);
}

function readRememberedRendererPort(){
  try{
    if(!fs.existsSync(rendererPortFile()))return null;
    return validPort(fs.readFileSync(rendererPortFile(),'utf8').trim());
  }catch(error){
    console.warn('Unable to read remembered renderer port.',error);
    return null;
  }
}

function findMostRecentLegacyRendererPort(){
  const indexedDbRoot=path.join(app.getPath('userData'),'IndexedDB');
  try{
    if(!fs.existsSync(indexedDbRoot))return null;
    const candidates=[];
    for(const name of fs.readdirSync(indexedDbRoot)){
      const match=/^http_127\.0\.0\.1_(\d+)\.indexeddb\.leveldb$/.exec(name);
      if(!match)continue;
      const port=validPort(match[1]);
      if(!port)continue;
      const fullPath=path.join(indexedDbRoot,name);
      const stats=fs.statSync(fullPath);
      candidates.push({port,modified:stats.mtimeMs});
    }
    candidates.sort((a,b)=>b.modified-a.modified);
    return candidates[0]?.port??null;
  }catch(error){
    console.warn('Unable to inspect legacy desktop IndexedDB origins.',error);
    return null;
  }
}

function rememberRendererPort(port){
  try{
    fs.mkdirSync(app.getPath('userData'),{recursive:true});
    fs.writeFileSync(rendererPortFile(),String(port),'utf8');
  }catch(error){
    console.warn('Unable to remember renderer port.',error);
  }
}

function resolveRendererPort(){
  const remembered=readRememberedRendererPort();
  if(remembered)return remembered;

  const legacy=findMostRecentLegacyRendererPort();
  const port=legacy??DEFAULT_RENDERER_PORT;
  rememberRendererPort(port);
  if(legacy)console.info(`Reusing legacy Flipbook Studio storage origin on port ${port}.`);
  return port;
}

function startRendererServer(){
  const root=path.resolve(__dirname,'..','dist');
  if(!fs.existsSync(path.join(root,'index.html'))){
    throw new Error(`Desktop renderer is missing at ${root}. Run \`npm run build\` before starting Electron.`);
  }
  const rendererPort=resolveRendererPort();

  return new Promise((resolve,reject)=>{
    server=http.createServer((request,response)=>{
      try{
        const requestUrl=new URL(request.url||'/','http://127.0.0.1');
        const requestedPath=safeFilePath(root,requestUrl.pathname);
        let filePath=requestedPath;

        if(filePath&&fs.existsSync(filePath)&&fs.statSync(filePath).isDirectory()){
          filePath=path.join(filePath,'index.html');
        }
        if(!filePath||!fs.existsSync(filePath)||!fs.statSync(filePath).isFile()){
          filePath=path.join(root,'index.html');
        }

        const extension=path.extname(filePath).toLowerCase();
        response.statusCode=200;
        response.setHeader('Content-Type',MIME_TYPES[extension]||'application/octet-stream');
        response.setHeader('Cache-Control','no-cache');
        fs.createReadStream(filePath).pipe(response);
      }catch(error){
        response.statusCode=500;
        response.setHeader('Content-Type','text/plain; charset=utf-8');
        response.end('Unable to load Flipbook Studio.');
        console.error(error);
      }
    });

    server.once('error',error=>{
      if(error&&error.code==='EADDRINUSE'){
        reject(new Error(`Flipbook Studio desktop storage port ${rendererPort} is already in use. Close the other Flipbook Studio instance or the program using this port, then try again.`));
        return;
      }
      reject(error);
    });
    server.listen(rendererPort,'127.0.0.1',()=>{
      serverOrigin=`http://127.0.0.1:${rendererPort}`;
      resolve(serverOrigin);
    });
  });
}

function initialContentSize(){
  const {width,height}=screen.getPrimaryDisplay().workAreaSize;
  return {
    width:Math.min(COMPACT_WIDTH,Math.max(320,width-32)),
    height:Math.min(COMPACT_HEIGHT,Math.max(480,height-48)),
  };
}

function expandedFromBounds(bounds){
  return bounds.width>EXPANDED_THRESHOLD;
}

function currentExpanded(window){
  return expandedFromBounds(window.getBounds());
}

function notifyExpanded(window,expanded=currentExpanded(window)){
  if(!window.isDestroyed()&&!window.webContents.isDestroyed())window.webContents.send('desktop-window:expanded-changed',Boolean(expanded));
  return Boolean(expanded);
}

function layoutBounds(window,expanded,baseBounds){
  const current=baseBounds??window.getBounds();
  const display=screen.getDisplayMatching(current);
  const area=display.workArea;
  const availableWidth=Math.max(320,area.width-32);
  const availableHeight=Math.max(480,area.height-32);
  const width=expanded?Math.min(EXPANDED_WIDTH,availableWidth):Math.min(COMPACT_WIDTH,availableWidth);
  const targetHeight=expanded?EXPANDED_HEIGHT:COMPACT_HEIGHT;
  const height=Math.min(targetHeight,availableHeight);
  const centerX=current.x+current.width/2;
  const centerY=current.y+current.height/2;
  const x=Math.max(area.x,Math.min(Math.round(centerX-width/2),area.x+area.width-width));
  const y=Math.max(area.y,Math.min(Math.round(centerY-height/2),area.y+area.height-height));
  return {x,y,width,height};
}

function applyExpanded(window,expanded,baseBounds){
  const next=Boolean(expanded);
  const bounds=layoutBounds(window,next,baseBounds);
  window.setBounds(bounds,true);
  notifyExpanded(window,next);
  return bounds;
}

async function createWindow(){
  if(!serverOrigin)await startRendererServer();

  const contentSize=initialContentSize();
  const window=new BrowserWindow({
    width:contentSize.width,
    height:contentSize.height,
    useContentSize:true,
    minWidth:320,
    minHeight:480,
    resizable:true,
    maximizable:false,
    fullscreenable:true,
    movable:true,
    frame:false,
    show:false,
    backgroundColor:'#ffffff',
    autoHideMenuBar:true,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      contextIsolation:true,
      nodeIntegration:false,
      sandbox:true,
    },
  });

  window.center();
  window.once('ready-to-show',()=>window.show());
  window.webContents.setWindowOpenHandler(({url})=>{
    if(url.startsWith(serverOrigin))return {action:'allow'};
    void shell.openExternal(url);
    return {action:'deny'};
  });
  window.webContents.on('will-navigate',(event,url)=>{
    if(url.startsWith(serverOrigin))return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  let lastReportedExpanded=currentExpanded(window);
  const reportExpanded=()=>{
    if(window.isDestroyed())return;
    const expanded=currentExpanded(window);
    if(expanded===lastReportedExpanded)return;
    lastReportedExpanded=expanded;
    notifyExpanded(window,expanded);
  };
  window.on('resize',reportExpanded);
  window.webContents.on('did-finish-load',()=>{
    lastReportedExpanded=currentExpanded(window);
    notifyExpanded(window,lastReportedExpanded);
  });

  await window.loadURL(serverOrigin);
}

ipcMain.on('desktop-window:close',event=>{
  const window=BrowserWindow.fromWebContents(event.sender)??BrowserWindow.getFocusedWindow();
  if(window&&!window.isDestroyed())window.close();
});

ipcMain.handle('desktop-window:get-expanded',event=>{
  const window=BrowserWindow.fromWebContents(event.sender);
  return window?currentExpanded(window):false;
});

ipcMain.handle('desktop-window:set-expanded',(event,expanded)=>{
  const window=BrowserWindow.fromWebContents(event.sender);
  if(!window)return null;
  return applyExpanded(window,Boolean(expanded));
});

ipcMain.handle('desktop-window:toggle-expanded',event=>{
  const window=BrowserWindow.fromWebContents(event.sender);
  if(!window)return false;
  const next=!currentExpanded(window);
  applyExpanded(window,next);
  return next;
});

app.whenReady().then(async()=>{
  await createWindow();
  app.on('activate',()=>{
    if(BrowserWindow.getAllWindows().length===0)void createWindow();
  });
}).catch(error=>{
  console.error(error);
  app.quit();
});

app.on('window-all-closed',()=>{
  if(process.platform!=='darwin')app.quit();
});

app.on('before-quit',()=>{
  server?.close();
  server=null;
  serverOrigin='';
});
