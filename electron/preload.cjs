const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('desktopWindow',{
  close:()=>ipcRenderer.invoke('desktop-window:close'),
  setExpanded:(expanded)=>ipcRenderer.invoke('desktop-window:set-expanded',Boolean(expanded)),
});
