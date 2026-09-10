const CRC_TABLE=(()=>{
  const table=new Uint32Array(256);
  for(let index=0;index<256;index++){
    let value=index;
    for(let bit=0;bit<8;bit++)value=(value&1)?0xedb88320^(value>>>1):value>>>1;
    table[index]=value>>>0;
  }
  return table;
})();

const textEncoder=new TextEncoder();
const ZIP64_VERSION=45;

type WritableFileLike={
  write(data:Uint8Array):Promise<void>;
  close():Promise<void>;
  abort?(reason?:unknown):Promise<void>;
};
type FileHandleLike={createWritable():Promise<WritableFileLike>};
type SaveFilePicker=(options:{suggestedName:string})=>Promise<FileHandleLike>;

type Sink={
  write(data:Uint8Array):Promise<void>;
  close():Promise<Blob|undefined>;
  abort(reason?:unknown):Promise<void>;
};
type Entry={name:Uint8Array;crc:number;size:number;offset:number;time:number;date:number};

function u16(value:number){const bytes=new Uint8Array(2);new DataView(bytes.buffer).setUint16(0,value,true);return bytes;}
function u32(value:number){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value>>>0,true);return bytes;}
function u64(value:number){const bytes=new Uint8Array(8);new DataView(bytes.buffer).setBigUint64(0,BigInt(value),true);return bytes;}
function concat(...parts:Uint8Array[]){
  const result=new Uint8Array(parts.reduce((sum,part)=>sum+part.byteLength,0));
  let offset=0;
  for(const part of parts){result.set(part,offset);offset+=part.byteLength;}
  return result;
}
function zip64Extra(...values:Uint8Array[]){
  const data=concat(...values);
  return concat(u16(0x0001),u16(data.byteLength),data);
}
function updateCrc(crc:number,bytes:Uint8Array){
  let value=crc>>>0;
  for(let index=0;index<bytes.length;index++)value=CRC_TABLE[(value^bytes[index])&0xff]^(value>>>8);
  return value>>>0;
}
function dosDateTime(date=new Date()){
  const year=Math.max(1980,date.getFullYear());
  return {
    time:((date.getHours()&31)<<11)|((date.getMinutes()&63)<<5)|(Math.floor(date.getSeconds()/2)&31),
    date:(((year-1980)&127)<<9)|(((date.getMonth()+1)&15)<<5)|(date.getDate()&31),
  };
}

class FileSink implements Sink{
  constructor(private writable:WritableFileLike){}
  async write(data:Uint8Array){await this.writable.write(data);}
  async close(){await this.writable.close();return undefined;}
  async abort(reason?:unknown){if(this.writable.abort)await this.writable.abort(reason);}
}
class MemorySink implements Sink{
  private parts:BlobPart[]=[];
  async write(data:Uint8Array){this.parts.push(data);}
  async close(){const blob=new Blob(this.parts,{type:'application/zip'});this.parts=[];return blob;}
  async abort(){this.parts=[];}
}

export async function createZipSink(suggestedName:string):Promise<Sink>{
  const picker=(globalThis as typeof globalThis&{showSaveFilePicker?:SaveFilePicker}).showSaveFilePicker;
  if(picker){
    const handle=await picker.call(globalThis,{suggestedName});
    return new FileSink(await handle.createWritable());
  }
  return new MemorySink();
}

export class StreamZipWriter{
  private entries:Entry[]=[];
  private offset=0;
  constructor(private sink:Sink){}

  private async write(bytes:Uint8Array){
    await this.sink.write(bytes);
    this.offset+=bytes.byteLength;
  }

  async addText(name:string,text:string,onProgress?:(written:number,total:number)=>void){
    await this.addBlob(name,new Blob([text],{type:'application/json'}),onProgress);
  }

  async addBlob(name:string,blob:Blob,onProgress?:(written:number,total:number)=>void){
    const nameBytes=textEncoder.encode(name);
    if(nameBytes.byteLength>0xffff)throw new Error('备份文件路径过长，无法写入。');
    const {time,date}=dosDateTime();
    const localOffset=this.offset;
    const flags=0x0808; // data descriptor + UTF-8 filename
    const localExtra=zip64Extra(u64(0),u64(0));
    const localHeader=concat(
      u32(0x04034b50),u16(ZIP64_VERSION),u16(flags),u16(0),u16(time),u16(date),
      u32(0),u32(0xffffffff),u32(0xffffffff),u16(nameBytes.byteLength),u16(localExtra.byteLength),
      nameBytes,localExtra,
    );
    await this.write(localHeader);

    let crc=0xffffffff,written=0;
    const reader=blob.stream().getReader();
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!value?.byteLength)continue;
      crc=updateCrc(crc,value);
      await this.write(value);
      written+=value.byteLength;
      onProgress?.(written,blob.size);
    }
    crc=(crc^0xffffffff)>>>0;
    const size=blob.size;
    await this.write(concat(u32(0x08074b50),u32(crc),u64(size),u64(size)));
    this.entries.push({name:nameBytes,crc,size,offset:localOffset,time,date});
    onProgress?.(size,size);
  }

  async finish(){
    const centralOffset=this.offset;
    for(const entry of this.entries){
      const centralExtra=zip64Extra(u64(entry.size),u64(entry.size),u64(entry.offset));
      const centralHeader=concat(
        u32(0x02014b50),u16(ZIP64_VERSION),u16(ZIP64_VERSION),u16(0x0808),u16(0),u16(entry.time),u16(entry.date),
        u32(entry.crc),u32(0xffffffff),u32(0xffffffff),u16(entry.name.byteLength),u16(centralExtra.byteLength),u16(0),
        u16(0),u16(0),u32(0),u32(0xffffffff),entry.name,centralExtra,
      );
      await this.write(centralHeader);
    }
    const centralSize=this.offset-centralOffset;
    const zip64EndOffset=this.offset;
    await this.write(concat(
      u32(0x06064b50),u64(44),u16(ZIP64_VERSION),u16(ZIP64_VERSION),u32(0),u32(0),
      u64(this.entries.length),u64(this.entries.length),u64(centralSize),u64(centralOffset),
    ));
    await this.write(concat(
      u32(0x07064b50),u32(0),u64(zip64EndOffset),u32(1),
    ));
    await this.write(concat(
      u32(0x06054b50),u16(0),u16(0),u16(0xffff),u16(0xffff),u32(0xffffffff),u32(0xffffffff),u16(0),
    ));
    return await this.sink.close();
  }

  async abort(reason?:unknown){await this.sink.abort(reason);}
}
