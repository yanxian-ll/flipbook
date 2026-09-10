const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('desktopWindow',{
  close:()=>ipcRenderer.send('desktop-window:close'),
  setExpanded:(expanded)=>ipcRenderer.invoke('desktop-window:set-expanded',Boolean(expanded)),
});
