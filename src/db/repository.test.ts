import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import type {StoredAsset} from '../domain/model';
import {db,repository} from './repository';

function storedAsset(id:string,createdAt=Date.now()):StoredAsset{
  const original=new Blob([`original:${id}`],{type:'image/jpeg'});
  const preview=new Blob([`preview:${id}`],{type:'image/webp'});
  const thumbnail=new Blob([`thumbnail:${id}`],{type:'image/webp'});
  return {
    id,
    name:`${id}.jpg`,
    mimeType:'image/jpeg',
    width:1200,
    height:800,
    orientation:'landscape',
    storageKey:id,
    createdAt,
    original,
    preview,
    thumbnail,
  };
}

describe('local repository safety',()=>{
  beforeEach(async()=>{
    await db.delete();
    await db.open();
  });

  afterEach(async()=>{
    await db.delete();
  });

  it('keeps assets referenced by an unfinished create draft',async()=>{
    const asset=storedAsset('draft-photo');
    await repository.putAssets([asset]);
    await repository.saveCreateDraft({themeId:'scrapbook',assetIds:[asset.id],updatedAt:Date.now()});

    await repository.removeAssets([asset.id]);
    expect(await repository.getAsset(asset.id)).toBeDefined();

    await repository.clearCreateDraft();
    await repository.removeAssets([asset.id]);
    expect(await repository.getAsset(asset.id)).toBeUndefined();
  });

  it('only cleans old orphaned assets',async()=>{
    const old=storedAsset('old-orphan',Date.now()-2*60*60*1000);
    const fresh=storedAsset('fresh-orphan');
    await repository.putAssets([old,fresh]);

    expect(await repository.cleanupUnusedAssets()).toBe(1);
    expect(await repository.getAsset(old.id)).toBeUndefined();
    expect(await repository.getAsset(fresh.id)).toBeDefined();
  });
});
