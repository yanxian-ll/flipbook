import {useCallback,useEffect,useState} from 'react';

export function useWorkspaceExpansion(defaultWide=true){
  const bridge=typeof window==='undefined'?undefined:window.desktopWindow;
  const [wide,setWide]=useState(()=>bridge?false:defaultWide);

  useEffect(()=>{
    if(!bridge)return;
    let live=true;
    void bridge.getExpanded().then(expanded=>{if(live)setWide(expanded);}).catch(()=>{});
    const unsubscribe=bridge.onExpandedChanged(expanded=>{if(live)setWide(expanded);});
    return()=>{
      live=false;
      unsubscribe();
    };
  },[bridge]);

  const toggleWide=useCallback(()=>{
    if(!bridge){
      setWide(value=>!value);
      return;
    }
    const next=!wide;
    void bridge.setExpanded(next).then(bounds=>{
      if(bounds)setWide(next);
    }).catch(()=>{});
  },[bridge,wide]);

  return {wide,toggleWide};
}
