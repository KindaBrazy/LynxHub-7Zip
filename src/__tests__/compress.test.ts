import {describe, it, expect, beforeAll, afterAll} from 'vitest';
import fs from 'fs';
import path from 'path';
import {compress, CommandCompiler, ensure7ZipExecutable} from '../index.js';

describe('Compress Module', () => {
  it('should infer correct format from file extension', () => {
    expect(CommandCompiler.inferFormatFromExtension('test.7z')).toBe('7z');
    expect(CommandCompiler.inferFormatFromExtension('archive.zip')).toBe('zip');
    expect(CommandCompiler.inferFormatFromExtension('file.tar.gz')).toBe('gzip');
    expect(CommandCompiler.inferFormatFromExtension('file.tar.xz')).toBe('xz');
    expect(CommandCompiler.inferFormatFromExtension('file.unknown')).toBe('7z');
  });

  it('should map compression levels correctly', () => {
    expect(CommandCompiler.mapCompressionLevel('ultra')).toBe('-mx=9');
    expect(CommandCompiler.mapCompressionLevel('fastest')).toBe('-mx=1');
    expect(CommandCompiler.mapCompressionLevel(5)).toBe('-mx=5');
    expect(CommandCompiler.mapCompressionLevel()).toBeUndefined();
  });

  it('should build compression arguments accurately', () => {
    const defaultArgs = CommandCompiler.compress('inputDir', 'output.7z');
    expect(defaultArgs).toContain('-t7z');
    expect(defaultArgs).toContain('-r');

    const customArgs = CommandCompiler.compress(['file1.txt', 'file2.txt'], 'archive.zip', {
      level: 'maximum',
      password: 'secret',
      exclude: ['*.tmp'],
      threads: 4,
      solid: true,
    });
    expect(customArgs).toContain('-tzip');
    expect(customArgs).toContain('-mx=7');
    expect(customArgs).toContain('-psecret');
    expect(customArgs).toContain('-xr!*.tmp');
    expect(customArgs).toContain('-mmt=4');
    expect(customArgs).toContain('-ms=on');
  });

  describe('Integration Test: Real compression execution', () => {
    const testDir = path.join(process.cwd(), 'temp_test_compress_folder');
    const testOutputFile = path.join(process.cwd(), 'temp_test_compress_output.7z');
    let execPath: string;

    beforeAll(async () => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, {recursive: true, force: true});
      }
      fs.mkdirSync(testDir, {recursive: true});
      fs.writeFileSync(path.join(testDir, 'sample1.txt'), 'Hello LynxHub 7Zip compression test 1');
      fs.writeFileSync(path.join(testDir, 'sample2.txt'), 'Hello LynxHub 7Zip compression test 2');

      if (fs.existsSync(testOutputFile)) {
        fs.rmSync(testOutputFile, {force: true});
      }

      execPath = await ensure7ZipExecutable();
    });

    afterAll(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, {recursive: true, force: true});
      }
      if (fs.existsSync(testOutputFile)) {
        fs.rmSync(testOutputFile, {force: true});
      }
    });

    it('should compress directory into 7z archive', async () => {
      const result = await compress(testDir, testOutputFile, {
        executablePath: execPath,
        level: 'normal',
      });

      expect(result.exitCode).toBe(0);
      expect(fs.existsSync(result.archivePath)).toBe(true);

      const stats = fs.statSync(result.archivePath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });
});
