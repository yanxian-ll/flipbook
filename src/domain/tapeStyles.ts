export type TapeStyleId='kraft'|'grid'|'dots'|'fiber';

export type PaperTapeStyle={
  id:TapeStyleId;
  name:string;
  texture:string;
  sourceColor:string;
  defaultColor:string;
};

export const paperTapeStyles:readonly PaperTapeStyle[]=[
  {id:'kraft',name:'牛皮纸',texture:'/tapes/kraft.svg',sourceColor:'#c9a46e',defaultColor:'#c9a46e'},
  {id:'grid',name:'格纹',texture:'/tapes/grid.svg',sourceColor:'#e6aeb7',defaultColor:'#d9b8b2'},
  {id:'dots',name:'波点',texture:'/tapes/dots.svg',sourceColor:'#a9cdea',defaultColor:'#b8c5d2'},
  {id:'fiber',name:'纤维纸',texture:'/tapes/fiber.svg',sourceColor:'#d8c6a6',defaultColor:'#d9c9a8'},
];

export function paperTapeStyleFor(id:TapeStyleId|undefined){
  return paperTapeStyles.find(style=>style.id===id)??paperTapeStyles[0];
}

export function isPaperTapeElement(element:{type:string;tapeStyle?:string;shadow?:boolean;width:number;height:number}){
  if(element.type!=='shape')return false;
  if(element.tapeStyle)return paperTapeStyles.some(style=>style.id===element.tapeStyle);
  return !element.shadow&&element.width/Math.max(1,element.height)>=3;
}
