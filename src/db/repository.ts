import Dexie, {type Table} from 'dexie';
import {type Book, type StoredAsset, type ThemeId, validateBook, uid, migrateLegacyBrandBook} from '../domain/model';
import {migrateBookTemplateTexts} from '../domain/layouts';

export interface BookSnapshot {id:string;bookId:string;createdAt:number;reason:string;book:Book}
export interface CreateDraft {themeId:ThemeId;assetIds:string[];updatedAt:number}
export interface LocalDataStats {books:number;assets:number;snapshots:number}
const CREATE_DRAFT_KEY='create-draft-v1';
const AUTO_SNAPSHOT_INTERVAL=5*60*1000;
const MAX_SNAPSHOTS_PER_BOOK=24;
export class StudioDatabase extends Dexie {
  books!: Table<Book,string>; assets!: Table<StoredAsset,string>; settings!: Table<{key:string;value:unknown},string>; snapshots!: Table<BookSnapshot,string>;
  constructor(name='flipbookStudio'){super(name);this.version(1).stores({books:'id,updatedAt',assets:'id',settings:'key',snapshots:'id,bookId,createdAt'});}
}
export const db = new StudioDatabase();
function migrateBook(value:Book){
  const brand=migrateLegacyBrandBook(value);
  const template=migrateBookTemplateTexts(brand.book);
  return {book:template.book,changed:brand.changed||template.changed};
}
async function trimSnapshots(bookId:string){
  const items=await db.snapshots.where('bookId').equals(bookId).sortBy('createdAt');
  const excess=items.length-MAX_SNAPSHOTS_PER_BOOK;
  if(excess>0)await db.snapshots.bulkDelete(items.slice(0,excess).map(item=>item.id));
}
async function createSnapshot(book:Book,reason:string){
  validateBook(book);
  const snapshot:BookSnapshot={id:uid(),bookId:book.id,createdAt:Date.now(),reason,book:structuredClone(book)};
  await db.snapshots.put(snapshot);
  await trimSnapshots(book.id);
  return snapshot;
}
async function maybeCreateAutoSnapshot(existing:Book){
  const latest=(await db.snapshots.where('bookId').equals(existing.id).sortBy('createdAt')).at(-1);
  if(latest&&Date.now()-latest.createdAt<AUTO_SNAPSHOT_INTERVAL)return;
  if(latest?.book.updatedAt===existing.updatedAt)return;
  await createSnapshot(existing,'自动版本');
}
async function referencedAssetIds(){
  const [books,snapshots,draftEntry]=await Promise.all([
    db.books.toArray(),
    db.snapshots.toArray(),
    db.settings.get(CREATE_DRAFT_KEY),
  ]);
  const draft=(draftEntry?.value??null) as CreateDraft|null;
  return new Set([
    ...books.flatMap(book=>[...book.assets,...(book.textureAssets??[])].map(asset=>asset.id)),
    ...snapshots.flatMap(snapshot=>[...snapshot.book.assets,...(snapshot.book.textureAssets??[])].map(asset=>asset.id)),
    ...(draft?.assetIds??[]),
  ]);
}
export const repository = {
  async list(){
    const books=await db.books.orderBy('updatedAt').reverse().toArray();
    const migrated=books.map(migrateBook);
    const changed=migrated.filter(item=>item.changed).map(item=>item.book);
    if(changed.length)await db.books.bulkPut(changed);
    return migrated.map(item=>item.book);
  },
  async get(id:string){
    const stored=await db.books.get(id);
    if(!stored)throw new Error('找不到这本画册。');
    const {book,changed}=migrateBook(stored);
    validateBook(book);
    if(changed)await db.books.put(structuredClone(book));
    return book;
  },
  async save(book:Book){
    const migrated=migrateBook(book).book;validateBook(migrated);
    const existing=await db.books.get(migrated.id);
    if(existing&&existing.updatedAt!==migrated.updatedAt)await maybeCreateAutoSnapshot(existing);
    await db.books.put(structuredClone(migrated));
  },
  async createSnapshot(book:Book,reason='手动版本'){return await createSnapshot(book,reason);},
  async listSnapshots(bookId:string){return (await db.snapshots.where('bookId').equals(bookId).sortBy('createdAt')).reverse();},
  async restoreSnapshot(snapshotId:string){
    const snapshot=await db.snapshots.get(snapshotId);
    if(!snapshot)throw new Error('这个历史版本已经不存在。');
    const current=await db.books.get(snapshot.bookId);
    if(current)await createSnapshot(current,'恢复前版本');
    const restored=migrateBook(structuredClone(snapshot.book)).book;
    restored.updatedAt=Date.now();
    validateBook(restored);
    await db.books.put(restored);
    return restored;
  },
  async removeSnapshot(snapshotId:string){await db.snapshots.delete(snapshotId);},
  async create(book:Book,assets:StoredAsset[]){const migrated=migrateBook(book).book;validateBook(migrated);await db.transaction('rw',db.books,db.assets,async()=>{await db.assets.bulkPut(assets);await db.books.add(structuredClone(migrated));});},
  async remove(id:string){await db.transaction('rw',db.books,db.assets,db.snapshots,db.settings,async()=>{await db.books.delete(id);await db.snapshots.where('bookId').equals(id).delete();const used=await referencedAssetIds();const all=await db.assets.toCollection().primaryKeys();await db.assets.bulkDelete(all.filter(key=>!used.has(key)));});},
  async rename(id:string,title:string){const book=await this.get(id);book.title=title.trim()||book.title;book.updatedAt=Date.now();await this.save(book);},
  async duplicate(id:string){const book=await this.get(id);const copy=structuredClone(book);copy.id=uid();copy.title+=' 副本';copy.createdAt=copy.updatedAt=Date.now();await this.save(copy);return copy;},
  getAsset:(id:string)=>db.assets.get(id),
  async getAssets(ids:string[]){
    const records=await db.assets.bulkGet(ids);
    return records.filter((asset):asset is StoredAsset=>!!asset);
  },
  putAssets:(assets:StoredAsset[])=>db.assets.bulkPut(assets),
  async removeAssets(ids:string[]){
    const unique=[...new Set(ids)];
    if(!unique.length)return;
    await db.transaction('rw',db.books,db.assets,db.snapshots,db.settings,async()=>{
      const used=await referencedAssetIds();
      await db.assets.bulkDelete(unique.filter(id=>!used.has(id)));
    });
  },
  async saveCreateDraft(draft:CreateDraft){await db.settings.put({key:CREATE_DRAFT_KEY,value:structuredClone(draft)});},
  async getCreateDraft(){return ((await db.settings.get(CREATE_DRAFT_KEY))?.value??null) as CreateDraft|null;},
  async clearCreateDraft(){await db.settings.delete(CREATE_DRAFT_KEY);},
  async getSetting<T>(key:string,fallback:T){const entry=await db.settings.get(key);return entry?entry.value as T:fallback;},
  async setSetting<T>(key:string,value:T){await db.settings.put({key,value});},
  async localDataStats():Promise<LocalDataStats>{const [books,assets,snapshots]=await Promise.all([db.books.count(),db.assets.count(),db.snapshots.count()]);return {books,assets,snapshots};},
  async cleanupUnusedAssets(){
    return await db.transaction('rw',db.books,db.assets,db.snapshots,db.settings,async()=>{
      const used=await referencedAssetIds();
      const all=await db.assets.toArray();
      const removable=all.filter(asset=>!used.has(asset.id)&&Date.now()-asset.createdAt>60*60*1000).map(asset=>asset.id);
      if(removable.length)await db.assets.bulkDelete(removable);
      return removable.length;
    });
  },
  async initialized(){return !!(await db.settings.get('initialized'));},
  async markInitialized(){await db.settings.put({key:'initialized',value:true});},
};
export function friendlyError(error:unknown){const e=error as Error;if(e?.name==='QuotaExceededError')return '本地存储空间不足，请先导出备份，再清理空间。';return e?.message||'操作失败，请重试。';}
