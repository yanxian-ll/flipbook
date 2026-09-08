import Dexie, {type Table} from 'dexie';
import {type Book, type StoredAsset, validateBook, uid} from '../domain/model';
export class StudioDatabase extends Dexie {
  books!: Table<Book,string>; assets!: Table<StoredAsset,string>; settings!: Table<{key:string;value:unknown},string>;
  constructor(name='flipbookStudio'){super(name);this.version(1).stores({books:'id,updatedAt',assets:'id',settings:'key',snapshots:'id,bookId,createdAt'});}
}
export const db = new StudioDatabase();
export const repository = {
  list: () => db.books.orderBy('updatedAt').reverse().toArray(),
  async get(id:string){const book=await db.books.get(id); if(!book)throw new Error('找不到这本画册。');validateBook(book);return book;},
  async save(book:Book){validateBook(book); await db.books.put(structuredClone(book));},
  async create(book:Book,assets:StoredAsset[]){validateBook(book);await db.transaction('rw',db.books,db.assets,async()=>{await db.assets.bulkPut(assets);await db.books.add(structuredClone(book));});},
  async remove(id:string){await db.transaction('rw',db.books,db.assets,async()=>{await db.books.delete(id);const books=await db.books.toArray();const used=new Set(books.flatMap(b=>b.assets.map(a=>a.id)));const all=await db.assets.toCollection().primaryKeys();await db.assets.bulkDelete(all.filter(key=>!used.has(key)));});},
  async rename(id:string,title:string){const book=await this.get(id);book.title=title.trim()||book.title;book.updatedAt=Date.now();await this.save(book);},
  async duplicate(id:string){const book=await this.get(id);const copy=structuredClone(book);copy.id=uid();copy.title+=' 副本';copy.createdAt=copy.updatedAt=Date.now();await this.save(copy);return copy;},
  getAsset:(id:string)=>db.assets.get(id),
  putAssets:(assets:StoredAsset[])=>db.assets.bulkPut(assets),
  async initialized(){return !!(await db.settings.get('initialized'));},
  async markInitialized(){await db.settings.put({key:'initialized',value:true});},
};
export function friendlyError(error:unknown){const e=error as Error;if(e?.name==='QuotaExceededError')return '本地存储空间不足，请先导出备份，再清理空间。';return e?.message||'操作失败，请重试。';}
