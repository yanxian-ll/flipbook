const {app,BrowserWindow,screen,shell}=require('electron');
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

let server=null;
let serverOrigin='';

function safeFilePath(root,pathname){
  const relative=decodeURIComponent(pathname).replace(/^\/+/, '');
  const candidate=path.resolve(root,relative||'index.html');
  const rootPrefix=`${path.resolve(root)}${path.sep}`;
  return candidate===path.resolve(root)||candidate.startsWith(rootPrefix)?candidate:null;
}

function startRendererServer(){
  const root=path.resolve(__dirname,'..','dist');
  if(!fs.existsSync(path.join(root,'index.html'))){
    throw new Error(`Desktop renderer is missing at ${root}. Run \`npm run build\` before starting Electron.`);
  }

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

    server.once('error',reject);
    server.listen(0,'127.0.0.1',()=>{
      const address=server.address();
      if(!address||typeof address==='string'){
        reject(new Error('Unable to determine the local renderer port.'));
        return;
      }
      serverOrigin=`http://127.0.0.1:${address.port}`;
      resolve(serverOrigin);
    });
  });
}

function compactContentSize(){
  const {width,height}=screen.getPrimaryDisplay().workAreaSize;
  return {
    width:Math.min(430,Math.max(320,width-32)),
    height:Math.min(932,Math.max(560,height-48)),
  };
}

async function createWindow(){
  if(!serverOrigin)await startRendererServer();

  const contentSize=compactContentSize();
  const window=new BrowserWindow({
    width:contentSize.width,
    height:contentSize.height,
    useContentSize:true,
    resizable:false,
    maximizable:false,
    fullscreenable:false,
    show:false,
    backgroundColor:'#ffffff',
    autoHideMenuBar:true,
    webPreferences:{
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

  await window.loadURL(serverOrigin);
}

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
