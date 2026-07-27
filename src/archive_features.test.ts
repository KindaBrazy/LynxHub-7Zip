import {describe, it, expect, beforeAll, afterAll} from 'vitest';
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

describe('Archive Features Module', () => {
  describe('Unit Tests: Argument Builders', () => {
    it('should build listArchive arguments accurately', () => {
      const listArgs = buildListArchiveArgs('my_archive.7z', {
        password: 'secretPassword',
        format: 'zip',
        exclude: '*.tmp',
      });
      expect(listArgs[0]).toBe('l');
      expect(listArgs).toContain('-slt');
      expect(listArgs).toContain('-psecretPassword');
      expect(listArgs).toContain('-tzip');
      expect(listArgs).toContain('-xr!*.tmp');
    });

    it('should build calculateHash arguments accurately', () => {
      const hashArgs = buildCalculateHashArgs('file.txt', {
        hashType: 'SHA256',
        recursive: true,
      });
      expect(hashArgs[0]).toBe('h');
      expect(hashArgs).toContain('-scrcSHA256');
    });

    it('should build testArchive arguments accurately', () => {
      const testArgs = buildTestArchiveArgs('my_archive.7z', {
        password: 'myPass',
        threads: 4,
      });
      expect(testArgs[0]).toBe('t');
      expect(testArgs).toContain('-pmyPass');
      expect(testArgs).toContain('-mmt=4');
    });
  });

  describe('Unit Tests: Output Parsers', () => {
    it('should parse listArchive stdout accurately', () => {
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
      expect(parsedList.rawInfo['Type']).toBe('7z');
      expect(parsedList.items).toHaveLength(2);
      expect(parsedList.items[0].path).toBe('file1.txt');
      expect(parsedList.items[0].size).toBe(100);
      expect(parsedList.items[0].crc).toBe('A1B2C3D4');
      expect(parsedList.items[1].isDir).toBe(true);
    });

    it('should parse calculateHash stdout accurately', () => {
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
      expect(parsedHash.files).toHaveLength(1);
      expect(parsedHash.files[0].path).toBe('file1.txt');
      expect(parsedHash.files[0].hashes['SHA256']).toBe(
        'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855',
      );
      expect(parsedHash.summary['SHA256']).toBe('E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855');
    });

    it('should parse testArchive stdout accurately', () => {
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
      expect(parsedTest.valid).toBe(true);
      expect(parsedTest.testedFilesCount).toBe(2);
      expect(parsedTest.testedFoldersCount).toBe(1);
      expect(parsedTest.totalSize).toBe(500);
    });
  });

  describe('Integration Tests with Real 7-Zip Executable', () => {
    const baseTempDir = path.join(process.cwd(), 'temp_test_archive_features_workspace');
    const sourceFolder = path.join(baseTempDir, 'source');
    const subFolder = path.join(sourceFolder, 'docs');
    const testFile = path.join(sourceFolder, 'hello.txt');
    const sampleArchive = path.join(baseTempDir, 'archive.7z');
    const encryptedArchive = path.join(baseTempDir, 'encrypted.7z');
    let execPath: string;

    beforeAll(async () => {
      if (fs.existsSync(baseTempDir)) {
        fs.rmSync(baseTempDir, {recursive: true, force: true});
      }
      fs.mkdirSync(subFolder, {recursive: true});
      fs.writeFileSync(testFile, 'Hello LynxHub 7-Zip features!');
      fs.writeFileSync(path.join(subFolder, 'nested.txt'), 'Nested text content');

      execPath = await ensure7ZipExecutable();

      await compress(sourceFolder, sampleArchive, {executablePath: execPath});
      await compress(sourceFolder, encryptedArchive, {
        executablePath: execPath,
        password: 'ProtectedPassword123',
      });
    });

    afterAll(() => {
      if (fs.existsSync(baseTempDir)) {
        fs.rmSync(baseTempDir, {recursive: true, force: true});
      }
    });

    it('should list items in archive using listArchive()', async () => {
      const listRes = await listArchive(sampleArchive, {executablePath: execPath});
      expect(listRes.exitCode).toBe(0);
      expect(listRes.items.length).toBeGreaterThanOrEqual(2);
      expect(listRes.items.some(it => it.path.includes('hello.txt'))).toBe(true);
    });

    it('should calculate SHA256 hash using calculateHash()', async () => {
      const hashRes256 = await calculateHash(testFile, 'SHA256', {executablePath: execPath});
      expect(hashRes256.exitCode).toBe(0);
      expect(hashRes256.summary['SHA256']).toBeDefined();
      expect(hashRes256.summary['SHA256'].length).toBe(64);
    });

    it('should calculate CRC32 hash using calculateHash()', async () => {
      const hashResCrc = await calculateHash(testFile, 'CRC32', {executablePath: execPath});
      expect(hashResCrc.exitCode).toBe(0);
      expect(hashResCrc.summary['CRC32']).toBeDefined();
    });

    it('should test valid archive using testArchive()', async () => {
      const testValid = await testArchive(sampleArchive, {executablePath: execPath});
      expect(testValid.valid).toBe(true);
      expect(testValid.exitCode).toBe(0);
    });

    it('should test encrypted archive with correct password', async () => {
      const testPassOk = await testArchive(encryptedArchive, {
        executablePath: execPath,
        password: 'ProtectedPassword123',
      });
      expect(testPassOk.valid).toBe(true);
    });

    it('should test encrypted archive with wrong password and detect failure', async () => {
      const testPassWrong = await testArchive(encryptedArchive, {
        executablePath: execPath,
        password: 'IncorrectPassword',
      });
      expect(testPassWrong.valid).toBe(false);
    });
  });
});
