import path from 'path';
import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import type {TestArchiveOptions, TestArchiveResult} from './types.js';

export const buildTestArchiveArgs = CommandCompiler.testArchive;


/**
 * Parses 7-Zip `t` stdout and exit code to determine archive health and metadata.
 */
export function parseTestArchiveOutput(
  stdout: string,
  _stderr: string,
  exitCode: number,
): {
  valid: boolean;
  testedFilesCount?: number;
  testedFoldersCount?: number;
  totalSize?: number;
} {
  const isValid = exitCode === 0 && /Everything is O[kK]/i.test(stdout);

  let testedFilesCount: number | undefined;
  let testedFoldersCount: number | undefined;
  let totalSize: number | undefined;

  const filesMatch = stdout.match(/^Files:\s*(\d+)/m);
  if (filesMatch) {
    testedFilesCount = parseInt(filesMatch[1], 10);
  }

  const foldersMatch = stdout.match(/^Folders:\s*(\d+)/m);
  if (foldersMatch) {
    testedFoldersCount = parseInt(foldersMatch[1], 10);
  }

  const sizeMatch = stdout.match(/^Size:\s*(\d+)/m);
  if (sizeMatch) {
    totalSize = parseInt(sizeMatch[1], 10);
  }

  return {
    valid: isValid,
    testedFilesCount,
    testedFoldersCount,
    totalSize,
  };
}

/**
 * Tests archive health and verifies password correctness using 7-Zip CLI without extracting files.
 *
 * @param archivePath Path to the input archive file.
 * @param options Configuration options for testing archive.
 */
export async function testArchive(archivePath: string, options?: TestArchiveOptions): Promise<TestArchiveResult> {
  if (!archivePath || archivePath.trim() === '') {
    throw new Error('Archive path must be specified.');
  }

  const workingDirectory = options?.workingDir || process.cwd();
  const runner = options?.runner || getDefaultRunner();
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildTestArchiveArgs(archivePath, options);

  let stdout: string;
  let stderr: string;
  let exitCode: number;

  try {
    const result = await runner.exec(args, options);
    stdout = result.stdout;
    stderr = result.stderr;
    exitCode = result.exitCode;
  } catch (err: any) {
    stdout = err.stdout || '';
    stderr = err.stderr || err.message || '';
    exitCode = err.exitCode || 2;
  }

  const {valid, testedFilesCount, testedFoldersCount, totalSize} = parseTestArchiveOutput(stdout, stderr, exitCode);

  return {
    valid,
    archivePath: resolvedArchivePath,
    testedFilesCount,
    testedFoldersCount,
    totalSize,
    stdout,
    stderr,
    exitCode,
  };
}
