import path from 'path';
import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import type {
  DeleteFromArchiveOptions,
  DeleteFromArchiveResult,
  RenameInArchiveOptions,
  RenameInArchiveResult,
  RenamePair,
  UpdateArchiveOptions,
  UpdateArchiveResult,
} from './types.js';

export const buildDeleteFromArchiveArgs = CommandCompiler.deleteFromArchive;

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
  const runner = options?.runner || getDefaultRunner();
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildDeleteFromArchiveArgs(archivePath, targets, options);
  const result = await runner.exec(args, options);

  return {
    archivePath: resolvedArchivePath,
    targets: targetList,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

/**
 * Constructs command line argument array for 7-Zip `rn` (rename) command.
 */
export const buildRenameInArchiveArgs = CommandCompiler.renameInArchive;
export const buildUpdateArchiveArgs = CommandCompiler.updateArchive;

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
  const runner = options?.runner || getDefaultRunner();
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildRenameInArchiveArgs(archivePath, renames, options);
  const result = await runner.exec(args, options);

  return {
    archivePath: resolvedArchivePath,
    renames: pairs,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
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
  const runner = options?.runner || getDefaultRunner();
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildUpdateArchiveArgs(archivePath, targets, options);
  const result = await runner.exec(args, options);

  return {
    archivePath: resolvedArchivePath,
    targets: targetList,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
