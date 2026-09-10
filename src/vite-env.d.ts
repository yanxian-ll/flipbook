/// <reference types="vite/client" />

interface Window {
  desktopWindow?: {
    close:()=>void;
    setExpanded:(expanded:boolean)=>Promise<{x:number;y:number;width:number;height:number}|null>;
  };
}
