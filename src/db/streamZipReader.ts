const EOCD_SIGNATURE=0x06054b50;
const ZIP64_EOCD_SIGNATURE=0x06064b50;
const ZIP64_LOCATOR_SIGNATURE=0x07064b50;
const CENTRAL_SIGNATURE=0x02014b50;
const LOCAL_SIGNATURE=0x04034b50;
const ZIP64_EXTRA_ID=0x0001;
const U32_MAX=0xffffffff;
const U16_MAX=0xffff;
const decoder=new TextDecoder();

type Entry={name:string;method:number;compressedSize:number;uncompressedSize:number;localOffset:number};

function safeU64(view:DataView,offset:number){
  const value=view.getBigUint64(offset,true);
  if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('备份文件索引超出当前运行环境可读取的范围。');
  return Number(value);
}
function findSignature(bytes:Uint8Array,signature:number){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let offset=bytes.byteLength-4;offset>=0;offset--){
    if(view.getUint32(offset,true)===signature)return offset;
  }
  return -1;
}
async function readRange(file:Blob,start:number,length:number){
  if(start<0||length<0||start+length>file.size)throw new Error('备份文件结构不完整。');
  return new Uint8Array(await file.slice(start,start+length).arrayBuffer());
}
function zip64Values(view:DataView,start:number,length:number,needs:{uncompressed:boolean;compressed:boolean;offset:boolean}){
  const end=start+length;
  let cursor=start;
  while(cursor+4<=end){
    const id=view.getUint16(cursor,true),size=view.getUint16(cursor+2,true);
    const dataStart=cursor+4,dataEnd=dataStart+size;
    if(dataEnd>end)break;
    if(id===ZIP64_EXTRA_ID){
      let pos=dataStart;
      let uncompressed:number|undefined,compressed:number|undefined,offset:number|undefined;
      if(needs.uncompressed){if(pos+8>dataEnd)throw new Error('ZIP64 索引损坏。');uncompressed=safeU64(view,pos);pos+=8;}
      if(needs.compressed){if(pos+8>dataEnd)throw new Error('ZIP64 索引损坏。');compressed=safeU64(view,pos);pos+=8;}
      if(needs.offset){if(pos+8>dataEnd)throw new Error('ZIP64 索引损坏。');offset=safeU64(view,pos);}
      return {uncompressed,compressed,offset};
    }
    cursor=dataEnd;
  }
  throw new Error('ZIP64 索引缺少必要的大小信息。');
}

async function readCentralLocation(file:File){
  const tailLength=Math.min(file.size,128*1024);
  const tailStart=file.size-tailLength;
  const tail=await readRange(file,tailStart,tailLength);
  const eocdRelative=findSignature(tail,EOCD_SIGNATURE);
  if(eocdRelative<0)throw new Error('这不是有效的 ZIP 备份文件。');
  const eocdView=new DataView(tail.buffer,tail.byteOffset,tail.byteLength);
  const totalEntries32=eocdView.getUint16(eocdRelative+10,true);
  const centralSize32=eocdView.getUint32(eocdRelative+12,true);
  const centralOffset32=eocdView.getUint32(eocdRelative+16,true);
  const needsZip64=totalEntries32===U16_MAX||centralSize32===U32_MAX||centralOffset32===U32_MAX;
  if(!needsZip64)return {totalEntries:totalEntries32,centralSize:centralSize32,centralOffset:centralOffset32};

  const eocdAbsolute=tailStart+eocdRelative;
  const locatorOffset=eocdAbsolute-20;
  if(locatorOffset<0)throw new Error('ZIP64 备份缺少定位信息。');
  const locator=await readRange(file,locatorOffset,20);
  const locatorView=new DataView(locator.buffer,locator.byteOffset,locator.byteLength);
  if(locatorView.getUint32(0,true)!==ZIP64_LOCATOR_SIGNATURE)throw new Error('ZIP64 备份定位信息损坏。');
  const zip64EndOffset=safeU64(locatorView,8);
  const zip64End=await readRange(file,zip64EndOffset,56);
  const zip64View=new DataView(zip64End.buffer,zip64End.byteOffset,zip64End.byteLength);
  if(zip64View.getUint32(0,true)!==ZIP64_EOCD_SIGNATURE)throw new Error('ZIP64 备份目录损坏。');
  return {
    totalEntries:safeU64(zip64View,32),
    centralSize:safeU64(zip64View,40),
    centralOffset:safeU64(zip64View,48),
  };
}

async function readEntries(file:File){
  const {totalEntries,centralSize,centralOffset}=await readCentralLocation(file);
  const bytes=await readRange(file,centralOffset,centralSize);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const entries=new Map<string,Entry>();
  let cursor=0;
  for(let index=0;index<totalEntries;index++){
    if(cursor+46>bytes.byteLength||view.getUint32(cursor,true)!==CENTRAL_SIGNATURE)throw new Error('备份文件目录结构损坏。');
    const method=view.getUint16(cursor+10,true);
    const compressed32=view.getUint32(cursor+20,true);
    const uncompressed32=view.getUint32(cursor+24,true);
    const nameLength=view.getUint16(cursor+28,true);
    const extraLength=view.getUint16(cursor+30,true);
    const commentLength=view.getUint16(cursor+32,true);
    const offset32=view.getUint32(cursor+42,true);
    const nameStart=cursor+46,extraStart=nameStart+nameLength;
    const next=extraStart+extraLength+commentLength;
    if(next>bytes.byteLength)throw new Error('备份文件目录条目不完整。');
    const name=decoder.decode(bytes.subarray(nameStart,extraStart));
    let compressedSize=compressed32,uncompressedSize=uncompressed32,localOffset=offset32;
    const needs={uncompressed:uncompressed32===U32_MAX,compressed:compressed32===U32_MAX,offset:offset32===U32_MAX};
    if(needs.uncompressed||needs.compressed||needs.offset){
      const values=zip64Values(view,extraStart,extraLength,needs);
      if(values.uncompressed!==undefined)uncompressedSize=values.uncompressed;
      if(values.compressed!==undefined)compressedSize=values.compressed;
      if(values.offset!==undefined)localOffset=values.offset;
    }
    entries.set(name,{name,method,compressedSize,uncompressedSize,localOffset});
    cursor=next;
  }
  return entries;
}

export class StoredZipReader{
  private constructor(private file:File,private entries:Map<string,Entry>){}

  static async open(file:File){
    const entries=await readEntries(file);
    if([...entries.values()].some(entry=>entry.method!==0))return null;
    return new StoredZipReader(file,entries);
  }

  has(name:string){return this.entries.has(name);}

  async blob(name:string,type='application/octet-stream'){
    const entry=this.entries.get(name);
    if(!entry)throw new Error(`备份文件缺少：${name}`);
    const header=await readRange(this.file,entry.localOffset,30);
    const view=new DataView(header.buffer,header.byteOffset,header.byteLength);
    if(view.getUint32(0,true)!==LOCAL_SIGNATURE)throw new Error(`备份文件条目损坏：${name}`);
    const nameLength=view.getUint16(26,true),extraLength=view.getUint16(28,true);
    const dataStart=entry.localOffset+30+nameLength+extraLength;
    const dataEnd=dataStart+entry.compressedSize;
    if(dataEnd>this.file.size)throw new Error(`备份文件条目不完整：${name}`);
    if(entry.compressedSize!==entry.uncompressedSize)throw new Error(`备份文件条目大小异常：${name}`);
    return this.file.slice(dataStart,dataEnd,type);
  }

  async text(name:string){return await (await this.blob(name,'application/json')).text();}
}
