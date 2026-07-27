import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  compress,
  listArchive,
  deleteFromArchive,
  renameInArchive,
  updateArchive,
  CommandCompiler,
  ensure7ZipExecutable,
} from './index.js';

describe('Archive Editing Module', () => {
  describe('Unit Tests: Argument Builders', () => {
    it('should build deleteFromArchive arguments accurately', () => {
      const delArgs = CommandCompiler.deleteFromArchive('archive.7z', ['file1.txt', 'file2.txt'], {
        password: 'secretPassword',
        format: '7z',
        exclude: '*.tmp',
        workDir: './tempWork',
      });

      expect(delArgs[0]).toBe('d');
      expect(delArgs).toContain('-t7z');
      expect(delArgs).toContain('-psecretPassword');
      expect(delArgs).toContain('-xr!*.tmp');
      expect(delArgs).toContain('-w./tempWork');
      expect(delArgs[delArgs.length - 2]).toBe('file1.txt');
      expect(delArgs[delArgs.length - 1]).toBe('file2.txt');
    });

    it('should build renameInArchive arguments accurately', () => {
      const rnArgs = CommandCompiler.renameInArchive(
        'archive.7z',
        [{from: 'old1.txt', to: 'new1.txt'}, ['folder/old2.txt', 'folder/new2.txt']],
        {
          password: 'pass',
          format: '7z',
        },
      );

      expect(rnArgs[0]).toBe('rn');
      expect(rnArgs).toContain('-ppass');
      expect(rnArgs).toContain('-t7z');
      const archiveIdx = rnArgs.indexOf('archive.7z');
      expect(archiveIdx).not.toBe(-1);
      expect(rnArgs[archiveIdx + 1]).toBe('old1.txt');
      expect(rnArgs[archiveIdx + 2]).toBe('new1.txt');
      expect(rnArgs[archiveIdx + 3]).toBe('folder/old2.txt');
      expect(rnArgs[archiveIdx + 4]).toBe('folder/new2.txt');
    });

    it('should build updateArchive arguments accurately', () => {
      const updateArgs = CommandCompiler.updateArchive('archive.7z', ['updated.txt'], {
        level: 9,
        password: 'p',
        encryptHeader: true,
        deleteSource: true,
      });

      expect(updateArgs[0]).toBe('u');
      expect(updateArgs).toContain('-mx=9');
      expect(updateArgs).toContain('-pp');
      expect(updateArgs).toContain('-mhe=on');
      expect(updateArgs).toContain('-sdel');
    });
  });

  describe('Real Process Execution Tests', () => {
    const testTmpDir = path.join(process.cwd(), 'out_edit_test');
    const fileA = path.join(testTmpDir, 'fileA.txt');
    const fileB = path.join(testTmpDir, 'fileB.txt');
    const fileC = path.join(testTmpDir, 'fileC.txt');
    const archivePath = path.join(testTmpDir, 'edit_test.7z');
    let execPath: string;

    beforeAll(async () => {
      if (fs.existsSync(testTmpDir)) {
        fs.rmSync(testTmpDir, {recursive: true, force: true});
      }
      fs.mkdirSync(testTmpDir, {recursive: true});

      execPath = await ensure7ZipExecutable();

      fs.writeFileSync(fileA, 'Initial Content A');
      fs.writeFileSync(fileB, 'Initial Content B');
      fs.writeFileSync(fileC, 'Initial Content C');

      await compress([fileA, fileB, fileC], archivePath, {executablePath: execPath});
    });

    afterAll(() => {
      if (fs.existsSync(testTmpDir)) {
        fs.rmSync(testTmpDir, {recursive: true, force: true});
      }
    });

    it('should create initial archive with 3 files', async () => {
      const listRes = await listArchive(archivePath, {executablePath: execPath});
      const itemPaths = listRes.items.map(i => i.path);
      expect(itemPaths).toContain('fileA.txt');
      expect(itemPaths).toContain('fileB.txt');
      expect(itemPaths).toContain('fileC.txt');
    });

    it('should rename a file inside the archive using renameInArchive()', async () => {
      const rnRes = await renameInArchive(
        archivePath,
        {from: 'fileB.txt', to: 'fileB_renamed.txt'},
        {executablePath: execPath},
      );
      expect(rnRes.exitCode).toBe(0);

      const listRes = await listArchive(archivePath, {executablePath: execPath});
      const itemPaths = listRes.items.map(i => i.path);
      expect(itemPaths).not.toContain('fileB.txt');
      expect(itemPaths).toContain('fileB_renamed.txt');
    });

    it('should delete a file from the archive using deleteFromArchive()', async () => {
      const delRes = await deleteFromArchive(archivePath, 'fileC.txt', {executablePath: execPath});
      expect(delRes.exitCode).toBe(0);

      const listRes = await listArchive(archivePath, {executablePath: execPath});
      const itemPaths = listRes.items.map(i => i.path);
      expect(itemPaths).not.toContain('fileC.txt');
    });

    it('should update/add a file in the archive using updateArchive()', async () => {
      const fileD = path.join(testTmpDir, 'fileD.txt');
      fs.writeFileSync(fileD, 'New Content D');

      const updateRes = await updateArchive(archivePath, fileD, {
        executablePath: execPath,
        workingDir: testTmpDir,
      });
      expect(updateRes.exitCode).toBe(0);

      const listRes = await listArchive(archivePath, {executablePath: execPath});
      const itemPaths = listRes.items.map(i => i.path);
      expect(itemPaths).toContain('fileD.txt');
    });
  });
});
