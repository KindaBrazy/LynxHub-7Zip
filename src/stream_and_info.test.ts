import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {
  getSupportedFeatures,
  buildGetSupportedFeaturesArgs,
  parseGetSupportedFeaturesOutput,
  compressStream,
  buildCompressStreamArgs,
  decompressStream,
  buildDecompressStreamArgs,
  compress,
} from './index.js';

async function runTests() {
  console.log('--- Starting Stream & Feature Info Tests ---');

  // =========================================================================
  // 1. Argument Builders
  // =========================================================================
  console.log('1. Testing argument builders...');

  const infoArgs = buildGetSupportedFeaturesArgs({customArgs: ['-slt']});
  if (infoArgs[0] !== 'i' || !infoArgs.includes('-slt')) {
    throw new Error('buildGetSupportedFeaturesArgs failed');
  }

  const compArgs = buildCompressStreamArgs({format: 'xz', level: 9, streamName: 'file.txt'}, true);
  if (
    !compArgs.includes('a') ||
    !compArgs.includes('-txz') ||
    !compArgs.includes('-so') ||
    !compArgs.includes('-sifile.txt')
  ) {
    throw new Error('buildCompressStreamArgs failed');
  }

  const decompArgs = buildDecompressStreamArgs({format: 'xz'}, true);
  if (
    !decompArgs.includes('e') ||
    !decompArgs.includes('-so') ||
    !decompArgs.includes('-si') ||
    !decompArgs.includes('-txz')
  ) {
    throw new Error('buildDecompressStreamArgs failed');
  }

  // =========================================================================
  // 2. Parser Unit Test
  // =========================================================================
  console.log('2. Testing parseGetSupportedFeaturesOutput...');
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
  if (!parsed.version?.includes('26.02')) throw new Error('Failed to parse version header');
  if (parsed.formats.length !== 2) throw new Error('Expected 2 formats');
  if (parsed.codecs.length !== 2) throw new Error('Expected 2 codecs');
  if (parsed.hashers.length !== 2) throw new Error('Expected 2 hashers');
  if (parsed.formats[0].name !== '7z' || parsed.formats[1].name !== 'xz')
    throw new Error('Incorrect format names parsed');
  if (parsed.codecs[1].name !== 'LZMA2') throw new Error('Incorrect codec name parsed');

  // =========================================================================
  // 3. getSupportedFeatures Integration Test
  // =========================================================================
  console.log('3. Testing getSupportedFeatures()...');
  const features = await getSupportedFeatures();
  console.log('Features inspection result:');
  console.log('Version:', features.version);
  console.log('Formats count:', features.formats.length);
  console.log('Codecs count:', features.codecs.length);
  console.log('Hashers count:', features.hashers.length);

  if (features.exitCode !== 0) throw new Error('getSupportedFeatures exitCode non-zero');
  if (features.formats.length === 0) throw new Error('getSupportedFeatures returned no formats');

  // =========================================================================
  // 4. Stream Pipe Round-Trip Test (Readable Stream -> compressStream -> decompressStream)
  // =========================================================================
  console.log('4. Testing stream pipe round-trip...');
  const originalData = 'Hello world from LynxHub-7Zip streaming pipeline test!\n'.repeat(500);
  const inputStream = Readable.from([originalData]);

  const compressedStream = compressStream(inputStream, {format: 'xz', streamName: 'data.txt'});
  const decompressedStream = decompressStream(compressedStream, {format: 'xz'});

  let decompressedResult = '';
  for await (const chunk of decompressedStream) {
    decompressedResult += chunk.toString();
  }

  const doneResult = await decompressedStream.promise;
  console.log('Decompress stream done promise exitCode:', doneResult.exitCode);
  if (doneResult.exitCode !== 0) throw new Error('Decompress stream failed exitCode');
  if (decompressedResult !== originalData) {
    throw new Error('Decompressed stream output does not match original data');
  }
  console.log('Stream pipe round-trip matched perfectly!');

  // =========================================================================
  // 5. Buffer Stream Compression & Decompression Test
  // =========================================================================
  console.log('5. Testing Buffer input stream compression...');
  const sampleBuf = Buffer.from('Testing buffer streaming capability with 7-Zip in memory!');
  const compBufStream = compressStream(sampleBuf, {format: 'xz'});

  const chunks: Buffer[] = [];
  for await (const chunk of compBufStream) {
    chunks.push(Buffer.from(chunk));
  }
  const compressedBuf = Buffer.concat(chunks);
  console.log('Compressed buffer size:', compressedBuf.length);
  if (compressedBuf.length === 0) throw new Error('Compressed buffer is empty');

  const decompBufStream = decompressStream(compressedBuf, {format: 'xz'});
  let decompBufText = '';
  for await (const chunk of decompBufStream) {
    decompBufText += chunk.toString();
  }
  if (decompBufText !== sampleBuf.toString()) {
    throw new Error('Decompressed buffer text mismatch');
  }
  console.log('Buffer streaming test passed!');

  // =========================================================================
  // 6. File-Based Stream Decompression Test
  // =========================================================================
  console.log('6. Testing file-based stream decompression...');
  const tempTextFile = path.resolve('temp_stream_test.txt');
  const tempArchiveFile = path.resolve('temp_stream_archive.xz');
  fs.writeFileSync(tempTextFile, 'File-based streaming content test');

  await compress(tempTextFile, tempArchiveFile);

  const fileDecompStream = decompressStream(tempArchiveFile);
  let fileDecompText = '';
  for await (const chunk of fileDecompStream) {
    fileDecompText += chunk.toString();
  }

  if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile);
  if (fs.existsSync(tempArchiveFile)) fs.unlinkSync(tempArchiveFile);

  if (fileDecompText !== 'File-based streaming content test') {
    throw new Error('File-based stream decompress content mismatch');
  }
  console.log('File-based stream decompression test passed!');

  console.log('--- All Stream & Feature Info Tests Passed Successfully! ---');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
