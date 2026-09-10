const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('desktopWindow',{
  setExpanded:(expanded)=>ipcRenderer.invoke('desktop-window:set-expanded',Boolean(expanded)),
});
