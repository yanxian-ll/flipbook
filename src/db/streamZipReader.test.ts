import {describe,expect,it} from 'vitest';
import {createZipSink,StreamZipWriter} from './streamZip';
import {StoredZipReader} from './streamZipReader';

describe('streamed ZIP backup reader',()=>{
  it('reads ZIP64 entries without loading the full archive through JSZip',async()=>{
    const sink=await createZipSink('reader-test.flipbook-backup');
    const writer=new StreamZipWriter(sink);
    await writer.addText('manifest.json',JSON.stringify({format:'flipbook-backup',version:1,title:'test'}));
    await writer.addBlob('assets/photo/original',new Blob(['original-photo-bytes'],{type:'image/jpeg'}));
    await writer.addBlob('assets/photo/preview',new Blob(['preview-bytes'],{type:'image/webp'}));
    const blob=await writer.finish();
    expect(blob).toBeInstanceOf(Blob);

    const file=new File([blob!],'reader-test.flipbook-backup',{type:'application/zip'});
    const reader=await StoredZipReader.open(file);
    expect(reader).not.toBeNull();
    expect(await reader!.text('manifest.json')).toContain('flipbook-backup');
    expect(await (await reader!.blob('assets/photo/original','image/jpeg')).text()).toBe('original-photo-bytes');
    expect(await (await reader!.blob('assets/photo/preview','image/webp')).text()).toBe('preview-bytes');
  });
});
