import path from 'path';
import {execFile} from 'child_process';
import {ensure7ZipExecutable} from './downloader.js';
import type {TestArchiveOptions, TestArchiveResult} from './types.js';

/**
 * Constructs command line argument array for 7-Zip `t` (test) command.
 */
export function buildTestArchiveArgs(archivePath: string, options?: TestArchiveOptions): string[] {
  const args: string[] = ['t'];

  // Format override -t
  if (options?.format) {
    args.push(`-t${options.format}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Non-interactive switch
  args.push('-y');

  // Recurse subdirectories -r
  if (options?.recursive === false) {
    args.push('-r-');
  } else {
    args.push('-r');
  }

  // Include file patterns -ir!
  if (options?.include) {
    const includes = Array.isArray(options.include) ? options.include : [options.include];
    for (const pattern of includes) {
      args.push(`-ir!${pattern}`);
    }
  }

  // Exclude file patterns -xr!
  if (options?.exclude) {
    const excludes = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
    for (const pattern of excludes) {
      args.push(`-xr!${pattern}`);
    }
  }

  // CPU threads -mmt
  if (options?.threads !== undefined) {
    args.push(`-mmt=${options.threads}`);
  }

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameter: archive file path
  args.push(archivePath);

  return args;
}

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
  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildTestArchiveArgs(archivePath, options);

  return new Promise(resolve => {
    execFile(
      execPath,
      args,
      {
        cwd: workingDirectory,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdoutStr, stderrStr) => {
        const stdout = stdoutStr.toString();
        const stderr = stderrStr.toString();
        const exitCode = error && typeof error.code === 'number' ? error.code : 0;

        const {valid, testedFilesCount, testedFoldersCount, totalSize} = parseTestArchiveOutput(
          stdout,
          stderr,
          exitCode,
        );

        resolve({
          valid,
          archivePath: resolvedArchivePath,
          testedFilesCount,
          testedFoldersCount,
          totalSize,
          stdout,
          stderr,
          exitCode,
        });
      },
    );
  });
}
