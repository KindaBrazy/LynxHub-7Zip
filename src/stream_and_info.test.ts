import {describe, it, expect, afterAll} from 'vitest';
import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {
  getSupportedFeatures,
  parseGetSupportedFeaturesOutput,
  compressStream,
  decompressStream,
  compress,
  CommandCompiler,
} from './index.js';

describe('Stream & Feature Info Module', () => {
  describe('Unit Tests: Argument Builders', () => {
    it('should build getSupportedFeatures arguments', () => {
      const infoArgs = CommandCompiler.getSupportedFeatures({customArgs: ['-slt']});
      expect(infoArgs[0]).toBe('i');
      expect(infoArgs).toContain('-slt');
    });

    it('should build compressStream arguments', () => {
      const compArgs = CommandCompiler.compressStream({format: 'xz', level: 9, streamName: 'file.txt'}, true);
      expect(compArgs).toContain('a');
      expect(compArgs).toContain('-txz');
      expect(compArgs).toContain('-so');
      expect(compArgs).toContain('-sifile.txt');
    });

    it('should build decompressStream arguments', () => {
      const decompArgs = CommandCompiler.decompressStream({format: 'xz'}, true);
      expect(decompArgs).toContain('e');
      expect(decompArgs).toContain('-so');
      expect(decompArgs).toContain('-si');
      expect(decompArgs).toContain('-txz');
    });
  });

  describe('Unit Tests: parseGetSupportedFeaturesOutput', () => {
    it('should parse 7-Zip feature inspection stdout accurately', () => {
      const sampleStdout = `
7-Zip (r) 26.02 (x86) : Igor Pavlov : Public domain : 2026-06-25

Formats:
   C...F..........c.a.m+..  7z       7z            7 z BC AF ' 1C
   CK.....................  xz       xz txz (.tar) FD 7 z X Z 00

Codecs:
   4ED   303011B BCJ2
    ED        21 LZMA2

Hashers:
      4        1 CRC32
     32        A SHA256
`;

      const parsed = parseGetSupportedFeaturesOutput(sampleStdout);
      expect(parsed.version).toContain('26.02');
      expect(parsed.formats).toHaveLength(2);
      expect(parsed.codecs).toHaveLength(2);
      expect(parsed.hashers).toHaveLength(2);
      expect(parsed.formats[0].name).toBe('7z');
      expect(parsed.formats[1].name).toBe('xz');
      expect(parsed.codecs[1].name).toBe('LZMA2');
    });
  });

  describe('Integration Tests: Process & Stream Execution', () => {
    const tempTextFile = path.resolve('temp_stream_test.txt');
    const tempArchiveFile = path.resolve('temp_stream_archive.xz');

    afterAll(() => {
      if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile);
      if (fs.existsSync(tempArchiveFile)) fs.unlinkSync(tempArchiveFile);
    });

    it('should inspect supported features using getSupportedFeatures()', async () => {
      const features = await getSupportedFeatures();
      expect(features.exitCode).toBe(0);
      expect(features.formats.length).toBeGreaterThan(0);
    });

    it('should handle stream pipe round-trip (Readable Stream -> compressStream -> decompressStream)', async () => {
      const originalData = 'Hello world from LynxHub-7Zip streaming pipeline test!\n'.repeat(500);
      const inputStream = Readable.from([originalData]);

      const compressedStream = compressStream(inputStream, {format: 'xz', streamName: 'data.txt'});
      const decompressedStream = decompressStream(compressedStream, {format: 'xz'});

      let decompressedResult = '';
      for await (const chunk of decompressedStream) {
        decompressedResult += chunk.toString();
      }

      const doneResult = await decompressedStream.promise;
      expect(doneResult.exitCode).toBe(0);
      expect(decompressedResult).toBe(originalData);
    });

    it('should compress and decompress Buffer streams in-memory', async () => {
      const sampleBuf = Buffer.from('Testing buffer streaming capability with 7-Zip in memory!');
      const compBufStream = compressStream(sampleBuf, {format: 'xz'});

      const chunks: Buffer[] = [];
      for await (const chunk of compBufStream) {
        chunks.push(Buffer.from(chunk));
      }
      const compressedBuf = Buffer.concat(chunks);
      expect(compressedBuf.length).toBeGreaterThan(0);

      const decompBufStream = decompressStream(compressedBuf, {format: 'xz'});
      let decompBufText = '';
      for await (const chunk of decompBufStream) {
        decompBufText += chunk.toString();
      }
      expect(decompBufText).toBe(sampleBuf.toString());
    });

    it('should decompress file-based stream using decompressStream()', async () => {
      fs.writeFileSync(tempTextFile, 'File-based streaming content test');

      await compress(tempTextFile, tempArchiveFile);

      const fileDecompStream = decompressStream(tempArchiveFile);
      let fileDecompText = '';
      for await (const chunk of fileDecompStream) {
        fileDecompText += chunk.toString();
      }

      expect(fileDecompText).toBe('File-based streaming content test');
    });
  });
});
