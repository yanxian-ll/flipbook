import {H,W,uid,type Element} from './model';

export type PolaroidStyleId=NonNullable<Element['polaroidStyle']>;
export type PolaroidTemplate={
  id:PolaroidStyleId;
  name:string;
  description:string;
  overlay:string;
  photo:{x:number;y:number;width:number;height:number};
  defaultSize:{width:number;height:number};
  rotation:number;
};

export const polaroidTemplates:PolaroidTemplate[]=[
  {
    id:'classic',
    name:'经典白框',
    description:'干净白边与宽底边',
    overlay:'/reference/polaroids/classic.svg',
    photo:{x:.09,y:.072,width:.82,height:.656},
    defaultSize:{width:500,height:625},
    rotation:-2,
  },
  {
    id:'pastel',
    name:'手帐胶带',
    description:'粉色爱心与花朵胶带',
    overlay:'/reference/polaroids/pastel.svg',
    photo:{x:.11,y:.15,width:.78,height:.62},
    defaultSize:{width:510,height:638},
    rotation:1.5,
  },
  {
    id:'vintage',
    name:'复古旧相纸',
    description:'泛黄磨损与手写日期',
    overlay:'/reference/polaroids/vintage.svg',
    photo:{x:.09,y:.088,width:.82,height:.65},
    defaultSize:{width:500,height:625},
    rotation:-1.5,
  },
  {
    id:'stacked',
    name:'叠放相框',
    description:'双层相纸与回形针',
    overlay:'/reference/polaroids/stacked.svg',
    photo:{x:.285,y:.252,width:.56,height:.448},
    defaultSize:{width:560,height:700},
    rotation:2,
  },
];

export function polaroidTemplateFor(style:Element['polaroidStyle']){
  return polaroidTemplates.find(template=>template.id===style)??polaroidTemplates[0];
}

export function polaroidPhotoFrame(element:Element){
  const {photo}=polaroidTemplateFor(element.polaroidStyle);
  return {
    x:photo.x*element.width,
    y:photo.y*element.height,
    width:photo.width*element.width,
    height:photo.height*element.height,
  };
}

export function createPolaroidElement(style:PolaroidStyleId):Element{
  const template=polaroidTemplateFor(style);
  const {width,height}=template.defaultSize;
  return {
    id:uid(),
    type:'image',
    x:(W-width)/2,
    y:(H-height)/2,
    width,
    height,
    rotation:template.rotation,
    opacity:1,
    fit:'cover',
    crop:{x:.5,y:.5,zoom:1},
    freeImage:true,
    polaroidStyle:style,
  };
}
