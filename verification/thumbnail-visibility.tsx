import {StrictMode,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PageThumbnail} from '../src/components/PageThumbnail';
import {blankPage} from '../src/domain/model';
import '../src/styles.css';
// Deliberately report every observed element as offscreen, as can happen during flips.
class OffscreenObserver {
  constructor(private callback:IntersectionObserverCallback){}
  observe(target:Element){queueMicrotask(()=>this.callback([{target,isIntersecting:false} as IntersectionObserverEntry],this as unknown as IntersectionObserver));}
  unobserve(){} disconnect(){} takeRecords(){return [];}
}
window.IntersectionObserver=OffscreenObserver as unknown as typeof IntersectionObserver;
const left=blankPage(1,'#ffc766'),right=blankPage(2,'#83c9ed');
function Test(){const [active,setActive]=useState(0);return <main style={{padding:30,background:'white'}}><h1>强制不可见回归测试</h1><p>蓝色与黄色两页必须始终可见；下方懒加载区域应没有图片。</p><button onClick={()=>setActive(1-active)}>切换编辑页</button><div style={{display:'flex',transform:'translate3d(0,0,0)',margin:20}}>{[left,right].map((page,index)=><div key={page.id} data-testid={`page-${index}`} style={{width:180,height:254}}>{active===index?<div style={{background:page.background,width:'100%',height:'100%'}}>当前编辑页</div>:<PageThumbnail page={page} immediate/>}</div>)}</div><div data-testid="lazy" style={{width:80,height:110}}><PageThumbnail page={left}/></div></main>;}
createRoot(document.getElementById('root')!).render(<StrictMode><Test/></StrictMode>);
