import fs from 'fs';
import path from 'path';
import {
  compress,
  listArchive,
  buildListArchiveArgs,
  parseListArchiveOutput,
  calculateHash,
  buildCalculateHashArgs,
  parseCalculateHashOutput,
  testArchive,
  buildTestArchiveArgs,
  parseTestArchiveOutput,
  ensure7ZipExecutable,
} from './index.js';

async function runTests() {
  console.log('--- Starting Archive Features (listArchive, calculateHash, testArchive) Tests ---');

  // =========================================================================
  // 1. Unit Tests: Argument Builders
  // =========================================================================
  console.log('1. Testing argument builders...');

  // listArchive args
  const listArgs = buildListArchiveArgs('my_archive.7z', {
    password: 'secretPassword',
    format: 'zip',
    exclude: '*.tmp',
  });
  console.log('buildListArchiveArgs:', listArgs.join(' '));
  if (listArgs[0] !== 'l') throw new Error('listArchive command should be "l"');
  if (!listArgs.includes('-slt')) throw new Error('listArchive should default to -slt');
  if (!listArgs.includes('-psecretPassword')) throw new Error('Missing password switch in listArchive');
  if (!listArgs.includes('-tzip')) throw new Error('Missing format switch in listArchive');
  if (!listArgs.includes('-xr!*.tmp')) throw new Error('Missing exclude switch in listArchive');

  // calculateHash args
  const hashArgs = buildCalculateHashArgs('file.txt', {
    hashType: 'SHA256',
    recursive: true,
  });
  console.log('buildCalculateHashArgs:', hashArgs.join(' '));
  if (hashArgs[0] !== 'h') throw new Error('calculateHash command should be "h"');
  if (!hashArgs.includes('-scrcSHA256')) throw new Error('Missing hashType switch -scrcSHA256');

  // testArchive args
  const testArgs = buildTestArchiveArgs('my_archive.7z', {
    password: 'myPass',
    threads: 4,
  });
  console.log('buildTestArchiveArgs:', testArgs.join(' '));
  if (testArgs[0] !== 't') throw new Error('testArchive command should be "t"');
  if (!testArgs.includes('-pmyPass')) throw new Error('Missing password switch in testArchive');
  if (!testArgs.includes('-mmt=4')) throw new Error('Missing thread switch in testArchive');

  console.log('✓ Argument building unit tests passed.');

  // =========================================================================
  // 2. Unit Tests: Output Parsers
  // =========================================================================
  console.log('2. Testing output parsers...');

  // Sample stdout for 7z l -slt
  const sampleListStdout = `
7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-28

Listing archive: sample.7z

--
Path = sample.7z
Type = 7z
Physical Size = 1234
Headers Size = 122
Method = LZMA2:12k

----------
Path = file1.txt
Size = 100
Packed Size = 80
Modified = 2026-01-01 12:00:00
Attributes = A
Encrypted = -
CRC = A1B2C3D4
Method = LZMA2:12k

Path = subfolder
Folder = +
Size = 0
Packed Size = 0
Modified = 2026-01-01 12:00:00
Attributes = D
Encrypted = -
`;

  const parsedList = parseListArchiveOutput(sampleListStdout);
  if (parsedList.rawInfo['Type'] !== '7z') throw new Error('Parsed rawInfo Type incorrect');
  if (parsedList.items.length !== 2) throw new Error(`Expected 2 items, got ${parsedList.items.length}`);
  if (parsedList.items[0].path !== 'file1.txt') throw new Error('Item 0 path incorrect');
  if (parsedList.items[0].size !== 100) throw new Error('Item 0 size incorrect');
  if (parsedList.items[0].crc !== 'A1B2C3D4') throw new Error('Item 0 CRC incorrect');
  if (parsedList.items[1].isDir !== true) throw new Error('Item 1 should be a folder');

  // Sample stdout for 7z h -scrcSHA256
  const sampleHashStdout = `
7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-28

Hash values for files:

SHA256                           Size  Name
------------------------------------  ----------------------------------------
E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855            12  file1.txt
------------------------------------  ----------------------------------------
E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855            12  

SHA256 for data:   E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855
`;

  const parsedHash = parseCalculateHashOutput(sampleHashStdout);
  if (parsedHash.files.length !== 1) throw new Error(`Expected 1 file hash, got ${parsedHash.files.length}`);
  if (parsedHash.files[0].path !== 'file1.txt') throw new Error('Hash item path incorrect');
  if (parsedHash.files[0].hashes['SHA256'] !== 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855') {
    throw new Error('Hash item SHA256 value incorrect');
  }
  if (parsedHash.summary['SHA256'] !== 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855') {
    throw new Error('Hash summary SHA256 value incorrect');
  }

  // Sample stdout for 7z t
  const sampleTestStdout = `
7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-28

Testing archive: sample.7z
Everything is Ok

Folders: 1
Files: 2
Size: 500
Compressed: 1234
`;

  const parsedTest = parseTestArchiveOutput(sampleTestStdout, '', 0);
  if (!parsedTest.valid) throw new Error('Expected test output to be valid');
  if (parsedTest.testedFilesCount !== 2) throw new Error('Tested files count incorrect');
  if (parsedTest.testedFoldersCount !== 1) throw new Error('Tested folders count incorrect');
  if (parsedTest.totalSize !== 500) throw new Error('Total size incorrect');

  console.log('✓ Output parsing unit tests passed.');

  // =========================================================================
  // 3. Integration Tests with Real 7-Zip Executable
  // =========================================================================
  console.log('3. Testing real process execution...');

  const baseTempDir = path.join(process.cwd(), 'temp_test_archive_features_workspace');
  const sourceFolder = path.join(baseTempDir, 'source');
  const subFolder = path.join(sourceFolder, 'docs');
  const testFile = path.join(sourceFolder, 'hello.txt');
  const sampleArchive = path.join(baseTempDir, 'archive.7z');
  const encryptedArchive = path.join(baseTempDir, 'encrypted.7z');

  try {
    if (fs.existsSync(baseTempDir)) {
      fs.rmSync(baseTempDir, {recursive: true, force: true});
    }
    fs.mkdirSync(subFolder, {recursive: true});
    fs.writeFileSync(testFile, 'Hello LynxHub 7-Zip features!');
    fs.writeFileSync(path.join(subFolder, 'nested.txt'), 'Nested text content');

    const execPath = await ensure7ZipExecutable();
    console.log('Using 7-Zip executable:', execPath);

    // Create archives
    await compress(sourceFolder, sampleArchive, {executablePath: execPath});
    await compress(sourceFolder, encryptedArchive, {
      executablePath: execPath,
      password: 'ProtectedPassword123',
    });

    // Test 3.1: listArchive
    console.log('Testing listArchive()...');
    const listRes = await listArchive(sampleArchive, {executablePath: execPath});
    console.log('listArchive result:', {
      itemCount: listRes.items.length,
      archiveType: listRes.rawInfo['Type'],
      exitCode: listRes.exitCode,
    });
    if (listRes.exitCode !== 0) throw new Error('listArchive returned non-zero exit code');
    if (listRes.items.length < 2) throw new Error('listArchive did not return all items');
    const foundHello = listRes.items.some(it => it.path.includes('hello.txt'));
    if (!foundHello) throw new Error('listArchive items missing hello.txt');
    console.log('✓ listArchive verified successfully.');

    // Test 3.2: calculateHash (SHA256)
    console.log('Testing calculateHash(file, "SHA256")...');
    const hashRes256 = await calculateHash(testFile, 'SHA256', {executablePath: execPath});
    console.log('calculateHash SHA256:', hashRes256.summary);
    if (hashRes256.exitCode !== 0) throw new Error('calculateHash returned non-zero exit code');
    if (!hashRes256.summary['SHA256']) throw new Error('calculateHash SHA256 summary missing');
    if (hashRes256.summary['SHA256'].length !== 64) throw new Error('SHA256 string length should be 64');
    console.log('✓ calculateHash SHA256 verified successfully.');

    // Test 3.3: calculateHash (CRC32)
    console.log('Testing calculateHash(file, "CRC32")...');
    const hashResCrc = await calculateHash(testFile, 'CRC32', {executablePath: execPath});
    console.log('calculateHash CRC32:', hashResCrc.summary);
    if (hashResCrc.exitCode !== 0) throw new Error('calculateHash CRC32 failed');
    if (!hashResCrc.summary['CRC32']) throw new Error('calculateHash CRC32 summary missing');
    console.log('✓ calculateHash CRC32 verified successfully.');

    // Test 3.4: testArchive (Valid Archive)
    console.log('Testing testArchive() on valid archive...');
    const testValid = await testArchive(sampleArchive, {executablePath: execPath});
    console.log('testArchive valid result:', {
      valid: testValid.valid,
      files: testValid.testedFilesCount,
      exitCode: testValid.exitCode,
    });
    if (!testValid.valid) throw new Error('testArchive reported valid archive as invalid');
    if (testValid.exitCode !== 0) throw new Error('testArchive returned non-zero exit code');
    console.log('✓ testArchive on valid archive verified successfully.');

    // Test 3.5: testArchive (Password Correct)
    console.log('Testing testArchive() with correct password...');
    const testPassOk = await testArchive(encryptedArchive, {
      executablePath: execPath,
      password: 'ProtectedPassword123',
    });
    console.log('testArchive correct password:', {valid: testPassOk.valid});
    if (!testPassOk.valid) throw new Error('testArchive failed with correct password');
    console.log('✓ testArchive with correct password verified successfully.');

    // Test 3.6: testArchive (Wrong Password)
    console.log('Testing testArchive() with wrong password...');
    const testPassWrong = await testArchive(encryptedArchive, {
      executablePath: execPath,
      password: 'IncorrectPassword',
    });
    console.log('testArchive wrong password:', {valid: testPassWrong.valid, exitCode: testPassWrong.exitCode});
    if (testPassWrong.valid) throw new Error('testArchive should return valid: false for wrong password');
    console.log('✓ testArchive with wrong password correctly identified invalid access.');
  } finally {
    if (fs.existsSync(baseTempDir)) {
      fs.rmSync(baseTempDir, {recursive: true, force: true});
    }
  }

  console.log('All Archive Features tests passed successfully!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
