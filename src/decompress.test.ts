import fs from 'fs';
import path from 'path';
import {compress, decompress, extract, buildDecompressArgs, ensure7ZipExecutable} from './index.js';

async function runTests() {
  console.log('--- Starting Decompress / Extract Tests ---');

  // 1. Argument building unit tests
  console.log('Testing buildDecompressArgs unit cases...');

  const defaultArgs = buildDecompressArgs('archive.7z', './out');
  console.log('Default args:', defaultArgs.join(' '));
  if (defaultArgs[0] !== 'x') throw new Error('Default command should be "x"');
  if (!defaultArgs.some(a => a.startsWith('-o'))) throw new Error('Missing output dir flag -o');
  if (!defaultArgs.includes('-aoa')) throw new Error('Missing default overwrite flag -aoa');
  if (!defaultArgs.includes('-y')) throw new Error('Missing non-interactive flag -y');

  const flatArgs = buildDecompressArgs('archive.zip', './out', {mode: 'flat'});
  if (flatArgs[0] !== 'e') throw new Error('Flat mode command should be "e"');

  const preservePathsFalseArgs = buildDecompressArgs('archive.zip', './out', {preservePaths: false});
  if (preservePathsFalseArgs[0] !== 'e') throw new Error('preservePaths: false command should be "e"');

  const testArgs = buildDecompressArgs('archive.7z', './out', {testOnly: true});
  if (testArgs[0] !== 't') throw new Error('Test mode command should be "t"');
  if (testArgs.some(a => a.startsWith('-o'))) throw new Error('Test mode should not include output dir flag -o');

  const customOptionsArgs = buildDecompressArgs('archive.7z', './outDir', {
    password: 'myPassword123',
    format: 'zip',
    overwriteMode: 'skip',
    include: '*.txt',
    exclude: ['*.tmp', '*.log'],
    eliminateRootFolder: true,
    fullPaths: 2,
    hashFunction: 'SHA256',
    threads: 2,
    customArgs: ['-bb3'],
  });

  console.log('Custom options args:', customOptionsArgs.join(' '));
  if (!customOptionsArgs.includes('-pmyPassword123')) throw new Error('Missing password switch');
  if (!customOptionsArgs.includes('-tzip')) throw new Error('Missing format switch');
  if (!customOptionsArgs.includes('-aos')) throw new Error('Missing overwrite mode skip');
  if (!customOptionsArgs.includes('-ir!*.txt')) throw new Error('Missing include pattern switch');
  if (!customOptionsArgs.includes('-xr!*.tmp') || !customOptionsArgs.includes('-xr!*.log')) {
    throw new Error('Missing exclude pattern switches');
  }
  if (!customOptionsArgs.includes('-spe')) throw new Error('Missing eliminate root folder switch');
  if (!customOptionsArgs.includes('-spf2')) throw new Error('Missing fullPaths switch -spf2');
  if (!customOptionsArgs.includes('-scrcSHA256')) throw new Error('Missing hash function switch');
  if (!customOptionsArgs.includes('-mmt=2')) throw new Error('Missing thread count switch');
  if (!customOptionsArgs.includes('-bb3')) throw new Error('Missing custom CLI switch -bb3');

  console.log('✓ Argument building unit tests passed.');

  // 2. Integration Tests with real 7-Zip CLI
  console.log('Testing real decompress / extract execution...');

  const baseTempDir = path.join(process.cwd(), 'temp_test_decompress_workspace');
  const sourceFolder = path.join(baseTempDir, 'source');
  const subFolder = path.join(sourceFolder, 'nested');
  const testArchive = path.join(baseTempDir, 'sample_archive.7z');
  const passArchive = path.join(baseTempDir, 'encrypted_archive.7z');

  const extractDirX = path.join(baseTempDir, 'out_x');
  const extractDirE = path.join(baseTempDir, 'out_e');
  const extractDirPass = path.join(baseTempDir, 'out_pass');
  const deleteTestArchive = path.join(baseTempDir, 'archive_to_delete.7z');

  try {
    // Setup workspace
    if (fs.existsSync(baseTempDir)) {
      fs.rmSync(baseTempDir, {recursive: true, force: true});
    }
    fs.mkdirSync(subFolder, {recursive: true});
    fs.writeFileSync(path.join(sourceFolder, 'root_file.txt'), 'Root file content 123');
    fs.writeFileSync(path.join(subFolder, 'nested_file.txt'), 'Nested file content 456');

    const execPath = await ensure7ZipExecutable();
    console.log('Using executable:', execPath);

    // Create standard archive
    await compress(sourceFolder, testArchive, {executablePath: execPath});
    if (!fs.existsSync(testArchive)) throw new Error('Failed to create test archive');

    // Create encrypted archive
    await compress(sourceFolder, passArchive, {
      executablePath: execPath,
      password: 'SecretPassword99',
    });

    // Test 1: Full path extraction (x) using standard decompress(archive, outputDir)
    console.log('Executing full path extraction (x)...');
    const resultX = await decompress(testArchive, extractDirX, {executablePath: execPath});
    console.log('Full path result:', {outputDir: resultX.outputDir, exitCode: resultX.exitCode});
    if (resultX.exitCode !== 0) throw new Error('Decompress (x) failed with non-zero exit code');

    const rootExtracted = path.join(extractDirX, 'source', 'root_file.txt');
    const nestedExtracted = path.join(extractDirX, 'source', 'nested', 'nested_file.txt');
    if (!fs.existsSync(rootExtracted)) throw new Error(`Extracted file missing at ${rootExtracted}`);
    if (!fs.existsSync(nestedExtracted)) throw new Error(`Extracted file missing at ${nestedExtracted}`);
    console.log('✓ Full path extraction verified successfully.');

    // Test 2: Flat extraction (e) using extract alias: extract(archive, outputDir, { mode: 'flat' })
    console.log('Executing flat extraction (e)...');
    const resultE = await extract(testArchive, extractDirE, {
      executablePath: execPath,
      mode: 'flat',
    });
    if (resultE.exitCode !== 0) throw new Error('Extract (e) failed with non-zero exit code');

    const flatRootFile = path.join(extractDirE, 'root_file.txt');
    const flatNestedFile = path.join(extractDirE, 'nested_file.txt');
    if (!fs.existsSync(flatRootFile)) throw new Error(`Flat extracted file missing at ${flatRootFile}`);
    if (!fs.existsSync(flatNestedFile)) throw new Error(`Flat extracted file missing at ${flatNestedFile}`);
    console.log('✓ Flat extraction verified successfully.');

    // Test 3: Test integrity check (t)
    console.log('Executing archive integrity test (t)...');
    const resultT = await decompress(testArchive, {
      executablePath: execPath,
      testOnly: true,
    });
    if (resultT.exitCode !== 0) throw new Error('Integrity test failed');
    console.log('✓ Archive integrity test verified successfully.');

    // Test 4: Password protected extraction
    console.log('Executing encrypted archive extraction...');
    const resultPass = await decompress(passArchive, extractDirPass, {
      executablePath: execPath,
      password: 'SecretPassword99',
    });
    if (resultPass.exitCode !== 0) throw new Error('Encrypted archive extraction failed');
    console.log('✓ Password protected archive extraction verified successfully.');

    // Test 5: Delete archive after extraction (deleteArchive)
    console.log('Executing extraction with deleteArchive option...');
    await compress(sourceFolder, deleteTestArchive, {executablePath: execPath});
    if (!fs.existsSync(deleteTestArchive)) throw new Error('Failed to create delete test archive');

    await decompress(deleteTestArchive, {
      executablePath: execPath,
      deleteArchive: true,
    });

    if (fs.existsSync(deleteTestArchive)) {
      throw new Error('deleteArchive: true failed to delete source archive');
    }
    console.log('✓ deleteArchive option verified successfully.');
  } finally {
    // Cleanup temporary workspace
    if (fs.existsSync(baseTempDir)) {
      fs.rmSync(baseTempDir, {recursive: true, force: true});
    }
  }

  console.log('All decompress / extract tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
