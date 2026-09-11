/// <reference types="vite/client" />

interface Window {
  desktopWindow?: {
    close:()=>void;
    getExpanded:()=>Promise<boolean>;
    setExpanded:(expanded:boolean)=>Promise<{x:number;y:number;width:number;height:number}|null>;
    toggleExpanded:()=>Promise<boolean>;
    onExpandedChanged:(listener:(expanded:boolean)=>void)=>()=>void;
  };
}
