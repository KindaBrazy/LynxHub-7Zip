import fs from 'fs';
import path from 'path';
import {
  compress,
  buildCompressArgs,
  inferFormatFromExtension,
  mapCompressionLevel,
  ensure7ZipExecutable,
} from './index.js';

async function runTests() {
  console.log('--- Starting Compress Tests ---');

  // 1. Format inference unit tests
  console.log('Testing format inference...');
  if (inferFormatFromExtension('test.7z') !== '7z') throw new Error('Failed 7z format inference');
  if (inferFormatFromExtension('archive.zip') !== 'zip') throw new Error('Failed zip format inference');
  if (inferFormatFromExtension('file.tar.gz') !== 'gzip') throw new Error('Failed gzip format inference');
  if (inferFormatFromExtension('file.tar.xz') !== 'xz') throw new Error('Failed xz format inference');
  if (inferFormatFromExtension('file.unknown') !== '7z') throw new Error('Failed fallback 7z format inference');
  console.log('✓ Format inference tests passed.');

  // 2. Compression level mapping unit tests
  console.log('Testing level mapping...');
  if (mapCompressionLevel('ultra') !== '-mx=9') throw new Error('Failed ultra level mapping');
  if (mapCompressionLevel('fastest') !== '-mx=1') throw new Error('Failed fastest level mapping');
  if (mapCompressionLevel(5) !== '-mx=5') throw new Error('Failed numeric 5 level mapping');
  if (mapCompressionLevel() !== undefined) throw new Error('Failed undefined level mapping');
  console.log('✓ Level mapping tests passed.');

  // 3. Argument building unit tests
  console.log('Testing argument builder...');
  const defaultArgs = buildCompressArgs('inputDir', 'output.7z');
  console.log('Default args:', defaultArgs.join(' '));
  if (!defaultArgs.includes('-t7z')) throw new Error('Missing default format');
  if (!defaultArgs.includes('-r')) throw new Error('Missing recursive flag');

  const customArgs = buildCompressArgs(['file1.txt', 'file2.txt'], 'archive.zip', {
    level: 'maximum',
    password: 'secret',
    exclude: ['*.tmp'],
    threads: 4,
    solid: true,
  });
  console.log('Custom args:', customArgs.join(' '));
  if (!customArgs.includes('-tzip')) throw new Error('Missing custom format zip');
  if (!customArgs.includes('-mx=7')) throw new Error('Missing level maximum');
  if (!customArgs.includes('-psecret')) throw new Error('Missing password switch');
  if (!customArgs.includes('-xr!*.tmp')) throw new Error('Missing exclude pattern');
  if (!customArgs.includes('-mmt=4')) throw new Error('Missing threads switch');
  if (!customArgs.includes('-ms=on')) throw new Error('Missing solid mode switch');
  console.log('✓ Argument builder tests passed.');

  // 4. Integration Test: Real compression
  console.log('Testing real compression execution...');
  const testDir = path.join(process.cwd(), 'temp_test_compress_folder');
  const testOutputFile = path.join(process.cwd(), 'temp_test_output.7z');

  try {
    // Setup temporary files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true});
    }
    fs.mkdirSync(testDir, {recursive: true});
    fs.writeFileSync(path.join(testDir, 'sample1.txt'), 'Hello LynxHub 7Zip compression test 1');
    fs.writeFileSync(path.join(testDir, 'sample2.txt'), 'Hello LynxHub 7Zip compression test 2');

    if (fs.existsSync(testOutputFile)) {
      fs.rmSync(testOutputFile, {force: true});
    }

    const execPath = await ensure7ZipExecutable();
    console.log('Using executable:', execPath);

    const result = await compress(testDir, testOutputFile, {
      executablePath: execPath,
      level: 'normal',
    });

    console.log('Compress Result:', {
      archivePath: result.archivePath,
      exitCode: result.exitCode,
    });

    if (!fs.existsSync(result.archivePath)) {
      throw new Error(`Compressed file not found at ${result.archivePath}`);
    }

    const stats = fs.statSync(result.archivePath);
    if (stats.size === 0) {
      throw new Error('Compressed file is empty!');
    }

    console.log(`✓ Archive successfully created. Size: ${stats.size} bytes.`);
  } finally {
    // Cleanup temporary files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true});
    }
    if (fs.existsSync(testOutputFile)) {
      fs.rmSync(testOutputFile, {force: true});
    }
  }

  console.log('All compress tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
