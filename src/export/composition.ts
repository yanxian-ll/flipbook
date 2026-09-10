import {W,H} from '../domain/model';

export interface CompositionOptions {
  pagesPerCollage?:number;
  frame?:boolean;
  ratio?:string;
  frameWidth?:number;
  frameHeight?:number;
  zoom?:number;
  offsetX?:number;
  offsetY?:number;
  bookStyle?:boolean;
}
export const defaultComposition:CompositionOptions={pagesPerCollage:2,frame:true,ratio:'3:4',frameWidth:1200,frameHeight:1600,zoom:1,offsetX:0,offsetY:0,bookStyle:true};
const bounded=(n:number|undefined,fallback:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(n)?n!:fallback));
export function compositionGeometry(options:CompositionOptions={}){
  const count=[1,2,4,6,8].includes(options.pagesPerCollage??2)?options.pagesPerCollage??2:2;
  const columns=count===1?1:2,rows=Math.ceil(count/columns);
  const gap=H*.14;
  const contentWidth=W*columns,contentHeight=H*rows+gap*(rows-1);
  const padding=options.bookStyle?W*.025:0;
  let width=contentWidth+padding*2,height=contentHeight+padding*2;
  if(options.frame){
    const ratios:Record<string,number>={'1:1':1,'3:4':.75,'4:3':4/3,'9:16':9/16,'16:9':16/9};
    const ratio=options.ratio==='custom'?bounded(options.frameWidth,1200,1,10000)/bounded(options.frameHeight,1600,1,10000):ratios[options.ratio??'3:4']??.75;
    width=contentWidth*1.18;height=width/ratio;
  }
  return {count,columns,rows,gap,contentWidth,contentHeight,width,height};
}
export function drawComposition(canvas:HTMLCanvasElement,images:CanvasImageSource[],options:CompositionOptions={},maxEdge=1800){
  const g=compositionGeometry(options),factor=Math.min(maxEdge/g.width,maxEdge/g.height);
  canvas.width=Math.max(2,Math.round(g.width*factor));canvas.height=Math.max(2,Math.round(g.height*factor));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法创建导出画布。');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.scale(factor,factor);
  const fit=options.frame?Math.min(g.width*.88/g.contentWidth,g.height*.88/g.contentHeight):1;
  const scale=fit*(options.frame?bounded(options.zoom,1,.25,2.5):1);
  ctx.translate((g.width-g.contentWidth*scale)/2+(options.frame?bounded(options.offsetX,0,-1,1)*g.width:0),(g.height-g.contentHeight*scale)/2+(options.frame?bounded(options.offsetY,0,-1,1)*g.height:0));
  ctx.scale(scale,scale);
  for(let row=0;row<g.rows;row++){
    const rowImages=images.slice(row*g.columns,(row+1)*g.columns);if(!rowImages.length)continue;
    const x=(g.contentWidth-rowImages.length*W)/2,y=row*(H+g.gap),width=rowImages.length*W;
    if(options.bookStyle){ctx.save();ctx.shadowColor='#0004';ctx.shadowBlur=14;ctx.shadowOffsetY=5;ctx.fillStyle='#fff';ctx.fillRect(x,y,width,H);ctx.restore();}
    rowImages.forEach((img,col)=>ctx.drawImage(img,x+col*W,y,W,H));
    if(options.bookStyle){
      ctx.strokeStyle='#0002';ctx.lineWidth=2;ctx.strokeRect(x,y,width,H);
      if(rowImages.length===2){const spine=x+W;const shade=ctx.createLinearGradient(spine-24,0,spine+24,0);shade.addColorStop(0,'#0000');shade.addColorStop(.46,'#0002');shade.addColorStop(.5,'#0007');shade.addColorStop(.55,'#ffffff55');shade.addColorStop(1,'#0000');ctx.fillStyle=shade;ctx.fillRect(spine-24,y,48,H);}
    }
  }
}
