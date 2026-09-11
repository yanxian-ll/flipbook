/// <reference types="vite/client" />

interface Window {
  desktopWindow?: {
    close:()=>void;
    getExpanded:()=>Promise<boolean>;
    setExpanded:(expanded:boolean)=>Promise<{x:number;y:number;width:number;height:number}|null>;
    onExpandedChanged:(listener:(expanded:boolean)=>void)=>()=>void;
  };
}
