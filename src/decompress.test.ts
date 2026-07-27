import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'fs';
import path from 'path';
import {compress, decompress, extract, buildDecompressArgs, ensure7ZipExecutable} from './index.js';

describe('Decompress Module', () => {
  describe('Argument Building', () => {
    it('should build default decompress arguments', () => {
      const defaultArgs = buildDecompressArgs('archive.7z', './out');
      expect(defaultArgs[0]).toBe('x');
      expect(defaultArgs.some(a => a.startsWith('-o'))).toBe(true);
      expect(defaultArgs).toContain('-aoa');
      expect(defaultArgs).toContain('-y');
    });

    it('should handle flat mode and preservePaths options', () => {
      const flatArgs = buildDecompressArgs('archive.zip', './out', {mode: 'flat'});
      expect(flatArgs[0]).toBe('e');

      const preservePathsFalseArgs = buildDecompressArgs('archive.zip', './out', {preservePaths: false});
      expect(preservePathsFalseArgs[0]).toBe('e');
    });

    it('should handle testOnly mode arguments', () => {
      const testArgs = buildDecompressArgs('archive.7z', './out', {testOnly: true});
      expect(testArgs[0]).toBe('t');
      expect(testArgs.some(a => a.startsWith('-o'))).toBe(false);
    });

    it('should include custom switches correctly', () => {
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

      expect(customOptionsArgs).toContain('-pmyPassword123');
      expect(customOptionsArgs).toContain('-tzip');
      expect(customOptionsArgs).toContain('-aos');
      expect(customOptionsArgs).toContain('-ir!*.txt');
      expect(customOptionsArgs).toContain('-xr!*.tmp');
      expect(customOptionsArgs).toContain('-xr!*.log');
      expect(customOptionsArgs).toContain('-spe');
      expect(customOptionsArgs).toContain('-spf2');
      expect(customOptionsArgs).toContain('-scrcSHA256');
      expect(customOptionsArgs).toContain('-mmt=2');
      expect(customOptionsArgs).toContain('-bb3');
    });
  });

  describe('Integration Tests with Real 7-Zip CLI', () => {
    const baseTempDir = path.join(process.cwd(), 'temp_test_decompress_workspace');
    const sourceFolder = path.join(baseTempDir, 'source');
    const subFolder = path.join(sourceFolder, 'nested');
    const testArchive = path.join(baseTempDir, 'sample_archive.7z');
    const passArchive = path.join(baseTempDir, 'encrypted_archive.7z');

    const extractDirX = path.join(baseTempDir, 'out_x');
    const extractDirE = path.join(baseTempDir, 'out_e');
    const extractDirPass = path.join(baseTempDir, 'out_pass');
    const deleteTestArchive = path.join(baseTempDir, 'archive_to_delete.7z');

    let execPath: string;

    beforeAll(async () => {
      if (fs.existsSync(baseTempDir)) {
        fs.rmSync(baseTempDir, {recursive: true, force: true});
      }
      fs.mkdirSync(subFolder, {recursive: true});
      fs.writeFileSync(path.join(sourceFolder, 'root_file.txt'), 'Root file content 123');
      fs.writeFileSync(path.join(subFolder, 'nested_file.txt'), 'Nested file content 456');

      execPath = await ensure7ZipExecutable();

      // Create standard archive
      await compress(sourceFolder, testArchive, {executablePath: execPath});

      // Create encrypted archive
      await compress(sourceFolder, passArchive, {
        executablePath: execPath,
        password: 'SecretPassword99',
      });
    });

    afterAll(() => {
      if (fs.existsSync(baseTempDir)) {
        fs.rmSync(baseTempDir, {recursive: true, force: true});
      }
    });

    it('should extract with full paths (x mode)', async () => {
      const resultX = await decompress(testArchive, extractDirX, {executablePath: execPath});
      expect(resultX.exitCode).toBe(0);

      const rootExtracted = path.join(extractDirX, 'source', 'root_file.txt');
      const nestedExtracted = path.join(extractDirX, 'source', 'nested', 'nested_file.txt');
      expect(fs.existsSync(rootExtracted)).toBe(true);
      expect(fs.existsSync(nestedExtracted)).toBe(true);
    });

    it('should extract flat without directory structure (e mode)', async () => {
      const resultE = await extract(testArchive, extractDirE, {
        executablePath: execPath,
        mode: 'flat',
      });
      expect(resultE.exitCode).toBe(0);

      const flatRootFile = path.join(extractDirE, 'root_file.txt');
      const flatNestedFile = path.join(extractDirE, 'nested_file.txt');
      expect(fs.existsSync(flatRootFile)).toBe(true);
      expect(fs.existsSync(flatNestedFile)).toBe(true);
    });

    it('should verify archive integrity (t mode)', async () => {
      const resultT = await decompress(testArchive, {
        executablePath: execPath,
        testOnly: true,
      });
      expect(resultT.exitCode).toBe(0);
    });

    it('should extract password protected archive', async () => {
      const resultPass = await decompress(passArchive, extractDirPass, {
        executablePath: execPath,
        password: 'SecretPassword99',
      });
      expect(resultPass.exitCode).toBe(0);
    });

    it('should delete archive after extraction when deleteArchive is set', async () => {
      await compress(sourceFolder, deleteTestArchive, {executablePath: execPath});
      expect(fs.existsSync(deleteTestArchive)).toBe(true);

      await decompress(deleteTestArchive, {
        executablePath: execPath,
        deleteArchive: true,
      });

      expect(fs.existsSync(deleteTestArchive)).toBe(false);
    });
  });
});
