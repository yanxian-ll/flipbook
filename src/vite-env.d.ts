/// <reference types="vite/client" />

interface Window {
  desktopWindow?: {
    setExpanded:(expanded:boolean)=>Promise<{x:number;y:number;width:number;height:number}|null>;
  };
}
