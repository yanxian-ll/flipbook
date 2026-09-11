const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('desktopWindow',{
  close:()=>ipcRenderer.send('desktop-window:close'),
  getExpanded:()=>ipcRenderer.invoke('desktop-window:get-expanded'),
  setExpanded:(expanded)=>ipcRenderer.invoke('desktop-window:set-expanded',Boolean(expanded)),
  onExpandedChanged:(listener)=>{
    const wrapped=(_event,expanded)=>listener(Boolean(expanded));
    ipcRenderer.on('desktop-window:expanded-changed',wrapped);
    return()=>ipcRenderer.removeListener('desktop-window:expanded-changed',wrapped);
  },
});
