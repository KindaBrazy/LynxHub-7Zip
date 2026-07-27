import {describe, it, expect, beforeEach, afterEach} from 'vitest';
import {
  DefaultSevenZipRunner,
  MockSevenZipRunner,
  getDefaultRunner,
  setDefaultRunner,
  compress,
  decompress,
  listArchive,
  calculateHash,
  testArchive,
  runBenchmark,
} from '../index.js';

describe('SevenZipRunner Seam & Mock Integration', () => {
  let mockRunner: MockSevenZipRunner;
  const originalRunner = getDefaultRunner();

  beforeEach(() => {
    mockRunner = new MockSevenZipRunner();
    setDefaultRunner(mockRunner);
  });

  afterEach(() => {
    setDefaultRunner(originalRunner);
  });

  it('allows global runner override with setDefaultRunner', () => {
    expect(getDefaultRunner()).toBe(mockRunner);
  });

  it('routes compress through active runner without spawning binaries', async () => {
    mockRunner.mockExecResult = {
      stdout: '7-Zip 26.02 : Everything is Ok',
      stderr: '',
      exitCode: 0,
    };

    const res = await compress('input.txt', 'archive.7z');

    expect(res.exitCode).toBe(0);
    expect(mockRunner.executedCommands).toHaveLength(1);
    expect(mockRunner.executedCommands[0].args).toEqual(['a', '-t7z', '-r', '-y', 'archive.7z', 'input.txt']);
  });

  it('allows per-call runner override in options', async () => {
    const customMock = new MockSevenZipRunner();
    customMock.mockExecResult = {
      stdout: 'Path = archive.7z\nType = 7z',
      stderr: '',
      exitCode: 0,
    };

    const res = await listArchive('archive.7z', {runner: customMock});

    expect(res.exitCode).toBe(0);
    expect(customMock.executedCommands).toHaveLength(1);
    expect(mockRunner.executedCommands).toHaveLength(0);
  });

  it('routes calculateHash, testArchive, runBenchmark, and decompress through MockSevenZipRunner', async () => {
    mockRunner.mockExecResult = {
      stdout: 'Everything is Ok\nFiles: 2\nFolders: 1\nSize: 1024',
      stderr: '',
      exitCode: 0,
    };

    const testRes = await testArchive('test.7z');
    expect(testRes.valid).toBe(true);
    expect(testRes.testedFilesCount).toBe(2);

    mockRunner.mockExecResult = {
      stdout: 'SHA256 1234567890abcdef file.txt',
      stderr: '',
      exitCode: 0,
    };

    const hashRes = await calculateHash('file.txt');
    expect(hashRes.exitCode).toBe(0);

    mockRunner.mockExecResult = {
      stdout: '7-Zip 26.02 Benchmark',
      stderr: '',
      exitCode: 0,
    };

    const benchRes = await runBenchmark();
    expect(benchRes.exitCode).toBe(0);

    mockRunner.mockExecResult = {
      stdout: 'Extracting archive.7z',
      stderr: '',
      exitCode: 0,
    };

    const decompRes = await decompress('archive.7z', 'out_dir');
    expect(decompRes.exitCode).toBe(0);

    expect(mockRunner.executedCommands).toHaveLength(4);
  });
});
