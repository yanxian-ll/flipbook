import {describe,expect,it} from 'vitest';
import type {Element} from './model';
import {createPolaroidElement,polaroidAssetIdFor,polaroidAssetPatch,storedPolaroidAssetId} from './polaroids';

describe('polaroid photo selection',()=>{
  it('keeps new polaroids out of the normal assetId field',()=>{
    const element=createPolaroidElement('classic');
    expect(element.assetId).toBeUndefined();
    expect(polaroidAssetIdFor(element)).toBeUndefined();
  });

  it('stores a polaroid photo independently from template assetId',()=>{
    const element=createPolaroidElement('pastel');
    Object.assign(element,polaroidAssetPatch('asset-polaroid'));
    expect(element.assetId).toBeUndefined();
    expect(storedPolaroidAssetId(element)).toBe('asset-polaroid');
    expect(polaroidAssetIdFor(element)).toBe('asset-polaroid');
  });

  it('can clear a polaroid without affecting a template using the same asset',()=>{
    const templatePhoto={id:'template',type:'image',assetId:'shared',x:0,y:0,width:100,height:100,rotation:0,opacity:1} satisfies Element;
    const polaroid=createPolaroidElement('vintage');
    Object.assign(polaroid,polaroidAssetPatch('shared'));
    Object.assign(polaroid,polaroidAssetPatch(undefined));
    expect(templatePhoto.assetId).toBe('shared');
    expect(polaroid.assetId).toBeUndefined();
    expect(polaroidAssetIdFor(polaroid)).toBeUndefined();
  });

  it('reads legacy polaroids that still store the photo in assetId',()=>{
    const legacy={...createPolaroidElement('classic'),assetId:'legacy-asset'};
    expect(polaroidAssetIdFor(legacy)).toBe('legacy-asset');
  });
});
