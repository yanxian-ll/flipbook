import JSZip from 'jszip';
import {describe,expect,it} from 'vitest';
import {createZipSink,StreamZipWriter} from './streamZip';

describe('streaming ZIP writer',()=>{
  it('produces a standard ZIP that JSZip can read',async()=>{
    const sink=await createZipSink('test.flipbook-backup','.flipbook-backup');
    const writer=new StreamZipWriter(sink);
    await writer.addText('manifest.json',JSON.stringify({format:'flipbook-backup',version:1}));
    await writer.addBlob('assets/photo/original',new Blob(['original-photo-bytes'],{type:'image/jpeg'}));
    await writer.addBlob('assets/photo/preview',new Blob(['preview-bytes'],{type:'image/webp'}));
    const blob=await writer.finish();

    expect(blob).toBeInstanceOf(Blob);
    const zip=await JSZip.loadAsync(await blob!.arrayBuffer());
    expect(await zip.file('manifest.json')!.async('string')).toContain('flipbook-backup');
    expect(await zip.file('assets/photo/original')!.async('string')).toBe('original-photo-bytes');
    expect(await zip.file('assets/photo/preview')!.async('string')).toBe('preview-bytes');
  });
});
