import path from 'path';
import {execFile} from 'child_process';
import {ensure7ZipExecutable} from './downloader.js';
import {mapCompressionLevel} from './compressor.js';
import type {
  DeleteFromArchiveOptions,
  DeleteFromArchiveResult,
  RenameInArchiveOptions,
  RenameInArchiveResult,
  RenamePair,
  UpdateArchiveOptions,
  UpdateArchiveResult,
} from './types.js';

/**
 * Normalizes single or array of targets into an array of string paths.
 */
function normalizeTargets(targets?: string | string[]): string[] {
  if (!targets) return [];
  return Array.isArray(targets) ? targets : [targets];
}

/**
 * Normalizes rename input into an array of { from: string, to: string } pairs.
 */
function normalizeRenamePairs(renames: RenamePair | RenamePair[]): Array<{from: string; to: string}> {
  if (Array.isArray(renames)) {
    if (renames.length === 2 && typeof renames[0] === 'string' && typeof renames[1] === 'string') {
      return [{from: renames[0], to: renames[1]}];
    }
    return (renames as RenamePair[]).map(pair => {
      if (Array.isArray(pair)) {
        return {from: pair[0], to: pair[1]};
      }
      return {from: pair.from, to: pair.to};
    });
  }
  return [{from: renames.from, to: renames.to}];
}

/**
 * Constructs command line argument array for 7-Zip `d` (delete) command.
 */
export function buildDeleteFromArchiveArgs(
  archivePath: string,
  targets: string | string[],
  options?: DeleteFromArchiveOptions,
): string[] {
  const args: string[] = ['d'];

  // Archive format switch -t
  if (options?.format) {
    args.push(`-t${options.format}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Recurse subdirectories -r (default: true)
  if (options?.recursive === false) {
    args.push('-r-');
  } else {
    args.push('-r');
  }

  // Include file patterns -ir!
  if (options?.include) {
    const includes = normalizeTargets(options.include);
    for (const pattern of includes) {
      args.push(`-ir!${pattern}`);
    }
  }

  // Exclude file patterns -xr!
  if (options?.exclude) {
    const excludes = normalizeTargets(options.exclude);
    for (const pattern of excludes) {
      args.push(`-xr!${pattern}`);
    }
  }

  // Temporary working directory -w
  if (options?.workDir) {
    args.push(`-w${options.workDir}`);
  }

  // Non-interactive switch
  args.push('-y');

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameters: archive path and file/directory targets to delete
  args.push(archivePath);

  const targetList = normalizeTargets(targets);
  args.push(...targetList);

  return args;
}

/**
 * Deletes files or folders from an existing archive without full unpack/re-pack (`7z d`).
 *
 * @param archivePath Path to target archive file.
 * @param targets File names, folder names, or wildcards to remove inside the archive.
 * @param options Configuration options for archive deletion.
 */
export async function deleteFromArchive(
  archivePath: string,
  targets: string | string[],
  options?: DeleteFromArchiveOptions,
): Promise<DeleteFromArchiveResult> {
  if (!archivePath || archivePath.trim() === '') {
    throw new Error('Archive path must be specified.');
  }

  const targetList = normalizeTargets(targets);
  if (targetList.length === 0) {
    throw new Error('At least one deletion target must be specified.');
  }

  const workingDirectory = options?.workingDir || process.cwd();
  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildDeleteFromArchiveArgs(archivePath, targets, options);

  return new Promise((resolve, reject) => {
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

        if (error && exitCode > 1) {
          return reject(
            new Error(`7-Zip delete command failed with exit code ${exitCode}:\n${stderr || stdout || error.message}`),
          );
        }

        resolve({
          archivePath: resolvedArchivePath,
          targets: targetList,
          stdout,
          stderr,
          exitCode,
        });
      },
    );
  });
}

/**
 * Constructs command line argument array for 7-Zip `rn` (rename) command.
 */
export function buildRenameInArchiveArgs(
  archivePath: string,
  renames: RenamePair | RenamePair[],
  options?: RenameInArchiveOptions,
): string[] {
  const args: string[] = ['rn'];

  // Archive format switch -t
  if (options?.format) {
    args.push(`-t${options.format}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Recurse subdirectories -r (default: true)
  if (options?.recursive === false) {
    args.push('-r-');
  } else {
    args.push('-r');
  }

  // Temporary working directory -w
  if (options?.workDir) {
    args.push(`-w${options.workDir}`);
  }

  // Non-interactive switch
  args.push('-y');

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameters: archive path and source/destination pairs
  args.push(archivePath);

  const pairs = normalizeRenamePairs(renames);
  for (const pair of pairs) {
    args.push(pair.from, pair.to);
  }

  return args;
}

/**
 * Renames files or folders inside an existing archive (`7z rn`).
 *
 * @param archivePath Path to target archive file.
 * @param renames Single or array of rename pairs ({ from: string, to: string } or [from, to]).
 * @param options Configuration options for archive renaming.
 */
export async function renameInArchive(
  archivePath: string,
  renames: RenamePair | RenamePair[],
  options?: RenameInArchiveOptions,
): Promise<RenameInArchiveResult> {
  if (!archivePath || archivePath.trim() === '') {
    throw new Error('Archive path must be specified.');
  }

  const pairs = normalizeRenamePairs(renames);
  if (pairs.length === 0) {
    throw new Error('At least one rename pair must be specified.');
  }

  const workingDirectory = options?.workingDir || process.cwd();
  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildRenameInArchiveArgs(archivePath, renames, options);

  return new Promise((resolve, reject) => {
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

        if (error && exitCode > 1) {
          return reject(
            new Error(`7-Zip rename command failed with exit code ${exitCode}:\n${stderr || stdout || error.message}`),
          );
        }

        resolve({
          archivePath: resolvedArchivePath,
          renames: pairs,
          stdout,
          stderr,
          exitCode,
        });
      },
    );
  });
}

/**
 * Constructs command line argument array for 7-Zip `u` (update) command.
 */
export function buildUpdateArchiveArgs(
  archivePath: string,
  targets?: string | string[],
  options?: UpdateArchiveOptions,
): string[] {
  const args: string[] = ['u'];

  // Archive format switch -t
  const format = options?.format || options?.archiveFormat;
  if (format) {
    args.push(`-t${format}`);
  }

  // Compression level switch -mx
  const levelFlag = mapCompressionLevel(options?.level ?? options?.compressionLevel);
  if (levelFlag) {
    args.push(levelFlag);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Encrypt header switch -mhe=on/off
  if (options?.encryptHeader !== undefined) {
    args.push(`-mhe=${options.encryptHeader ? 'on' : 'off'}`);
  }

  // Recurse subdirectories -r (default: true)
  if (options?.recursive === false) {
    args.push('-r-');
  } else {
    args.push('-r');
  }

  // Include file patterns -ir!
  if (options?.include) {
    const includes = normalizeTargets(options.include);
    for (const pattern of includes) {
      args.push(`-ir!${pattern}`);
    }
  }

  // Exclude file patterns -xr!
  if (options?.exclude) {
    const excludes = normalizeTargets(options.exclude);
    for (const pattern of excludes) {
      args.push(`-xr!${pattern}`);
    }
  }

  // Delete source files after archiving -sdel
  if (options?.deleteSource) {
    args.push('-sdel');
  }

  // Custom update action specification -u<spec>
  if (options?.updateSwitch) {
    args.push(options.updateSwitch.startsWith('-u') ? options.updateSwitch : `-u${options.updateSwitch}`);
  }

  // Temporary working directory -w
  if (options?.workDir) {
    args.push(`-w${options.workDir}`);
  }

  // Non-interactive switch
  args.push('-y');

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameters: archive path and file/directory targets to update
  args.push(archivePath);

  const targetList = normalizeTargets(targets);
  if (targetList.length > 0) {
    args.push(...targetList);
  }

  return args;
}

/**
 * Updates or adds files in an existing archive (`7z u`).
 *
 * @param archivePath Path to target archive file.
 * @param targets File names, folder names, or wildcards to update/add into the archive.
 * @param options Configuration options for archive update.
 */
export async function updateArchive(
  archivePath: string,
  targets?: string | string[],
  options?: UpdateArchiveOptions,
): Promise<UpdateArchiveResult> {
  if (!archivePath || archivePath.trim() === '') {
    throw new Error('Archive path must be specified.');
  }

  const targetList = normalizeTargets(targets);
  const workingDirectory = options?.workingDir || process.cwd();
  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildUpdateArchiveArgs(archivePath, targets, options);

  return new Promise((resolve, reject) => {
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

        if (error && exitCode > 1) {
          return reject(
            new Error(`7-Zip update command failed with exit code ${exitCode}:\n${stderr || stdout || error.message}`),
          );
        }

        resolve({
          archivePath: resolvedArchivePath,
          targets: targetList,
          stdout,
          stderr,
          exitCode,
        });
      },
    );
  });
}
