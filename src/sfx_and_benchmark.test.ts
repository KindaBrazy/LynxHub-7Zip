import {describe, it, expect} from 'vitest';
import {CommandCompiler, parseBenchmarkOutput, runBenchmark, ensure7ZipExecutable} from './index.js';

describe('SFX & Benchmarking Module', () => {
  describe('Unit Tests: SFX Argument Building', () => {
    it('should include -sfx when sfx: true', () => {
      const sfxBoolArgs = CommandCompiler.compress('input.txt', 'output.exe', {sfx: true});
      expect(sfxBoolArgs).toContain('-sfx');
    });

    it('should include custom sfx module when string is provided', () => {
      const sfxCustomArgs = CommandCompiler.compress('input.txt', 'output.exe', {sfx: '7zCon.sfx'});
      expect(sfxCustomArgs).toContain('-sfx7zCon.sfx');
    });

    it('should not include -sfx when sfx: false', () => {
      const sfxFalseArgs = CommandCompiler.compress('input.txt', 'output.7z', {sfx: false});
      expect(sfxFalseArgs.some(arg => arg.startsWith('-sfx'))).toBe(false);
    });
  });

  describe('Unit Tests: Benchmark Argument Building', () => {
    it('should build default benchmark arguments', () => {
      const benchArgsDefault = CommandCompiler.benchmark();
      expect(benchArgsDefault).toEqual(['b']);
    });

    it('should build customized benchmark arguments', () => {
      const benchArgsFull = CommandCompiler.benchmark({
        iterations: 2,
        dictionarySize: '22',
        threads: 4,
        method: 'LZMA2',
        customArgs: ['-so'],
      });

      expect(benchArgsFull[0]).toBe('b');
      expect(benchArgsFull).toContain('2');
      expect(benchArgsFull).toContain('-md=22');
      expect(benchArgsFull).toContain('-mmt=4');
      expect(benchArgsFull).toContain('-mm=LZMA2');
      expect(benchArgsFull).toContain('-so');
    });
  });

  describe('Unit Tests: parseBenchmarkOutput', () => {
    it('should parse benchmark vertical stdout accurately', () => {
      const sampleVerticalStdout = `
7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-28

RAM size: 32490 MB, CPU threads: 16
RAM usage: 441 MB, CPU threads: 16

LZMA 19:

Speed      Usage       RATING
     KiB/s          %  MIPS MIPS (AVG)
Compressing
  62391       1363   4307   4307
Decompressing
 777273       1536   4779   4779
Tot:          1449   4543   4543
`;

      const parsedVertical = parseBenchmarkOutput(sampleVerticalStdout, '', 0);
      expect(parsedVertical.ramSize).toBe(32490);
      expect(parsedVertical.cpuThreads).toBe(16);
      expect(parsedVertical.ramUsage).toBe(441);
      expect(parsedVertical.compressing?.speedKiBs).toBe(62391);
      expect(parsedVertical.decompressing?.speedKiBs).toBe(777273);
      expect(parsedVertical.total?.ratingMips).toBe(4543);
    });
  });

  describe('Integration Tests: runBenchmark Execution', () => {
    it('should execute 7-Zip benchmark successfully', async () => {
      const execPath = await ensure7ZipExecutable();
      const benchResult = await runBenchmark({
        executablePath: execPath,
        iterations: 1,
      });

      expect(benchResult.exitCode).toBe(0);
      expect(benchResult.stdout).toBeDefined();
      expect(benchResult.stdout.trim()).not.toBe('');
    });
  });
});
