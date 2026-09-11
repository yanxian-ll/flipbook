import {H,W,uid,type Element} from './model';

export type PolaroidStyleId=NonNullable<Element['polaroidStyle']>;
type PolaroidAssetFields={polaroidAssetId?:string};
export type PolaroidElement=Element&PolaroidAssetFields&{polaroidStyle:PolaroidStyleId};
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
    name:'回形针爱心',
    description:'单张相纸、金色回形针与背后爱心',
    overlay:'/reference/polaroids/stacked.svg',
    photo:{x:.16,y:.144,width:.68,height:.544},
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

export function storedPolaroidAssetId(element:Element){
  return (element as Element&PolaroidAssetFields).polaroidAssetId;
}

/**
 * Existing books created by the first polaroid implementation stored their photo in assetId.
 * Keep that as a read fallback until the canvas migrates the element to polaroidAssetId.
 */
export function polaroidAssetIdFor(element:Element){
  return storedPolaroidAssetId(element)??(element.polaroidStyle?element.assetId:undefined);
}

/**
 * Polaroid photos deliberately do not use Element.assetId. Template/layout code uses assetId
 * as its source of truth for page photo count, so keeping this field separate prevents a
 * polaroid photo from changing the page's N-photo template selection.
 */
export function polaroidAssetPatch(assetId:string|undefined,resetCrop=true):Partial<Element>{
  return ({
    assetId:undefined,
    polaroidAssetId:assetId,
    ...(resetCrop?{crop:{x:.5,y:.5,zoom:1}}:{}),
  } as unknown) as Partial<Element>;
}

export function createPolaroidElement(style:PolaroidStyleId):Element{
  const template=polaroidTemplateFor(style);
  const {width,height}=template.defaultSize;
  return ({
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
    polaroidAssetId:undefined,
  } as unknown) as PolaroidElement;
}
