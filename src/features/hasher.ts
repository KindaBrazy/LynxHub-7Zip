import path from 'path';
import {getDefaultRunner} from '../core/runner.js';
import {CommandCompiler} from '../core/compiler.js';
import {ArchiveInspector} from './inspector.js';
import type {CalculateHashOptions, CalculateHashResult, HashAlgorithm, HashItem} from '../types/index.js';

export const buildCalculateHashArgs = CommandCompiler.calculateHash;

/**
 * Parses 7-Zip `h` stdout into structured HashItem[] and summary map.
 */
export function parseCalculateHashOutput(stdout: string): {
  files: HashItem[];
  summary: Record<string, string>;
} {
  return ArchiveInspector.calculateHash(stdout);
}

/**
 * Calculates hash checksums (CRC32, SHA256, etc.) for local files/directories using 7-Zip CLI.
 *
 * Supports flexible call signatures:
 * - `calculateHash('file.txt')`
 * - `calculateHash('file.txt', 'SHA256')`
 * - `calculateHash('file.txt', { hashType: 'CRC32', recursive: true })`
 * - `calculateHash(['file1.txt', 'file2.txt'], 'SHA256', { workingDir: './' })`
 *
 * @param targetPath Target file/directory path or array of paths.
 * @param hashTypeOrOptions Hash algorithm string OR configuration options object.
 * @param options Configuration parameters if algorithm string is passed as 2nd parameter.
 */
export async function calculateHash(
  targetPath: string | string[],
  hashTypeOrOptions?: HashAlgorithm | CalculateHashOptions,
  options?: CalculateHashOptions,
): Promise<CalculateHashResult> {
  if (!targetPath || (Array.isArray(targetPath) && targetPath.length === 0)) {
    throw new Error('Target path must be specified.');
  }

  let finalOptions: CalculateHashOptions | undefined;

  if (typeof hashTypeOrOptions === 'string') {
    finalOptions = {...options, hashType: hashTypeOrOptions};
  } else if (typeof hashTypeOrOptions === 'object' && hashTypeOrOptions !== null) {
    finalOptions = hashTypeOrOptions;
  } else {
    finalOptions = options;
  }

  const runner = finalOptions?.runner || getDefaultRunner();
  const args = buildCalculateHashArgs(targetPath, finalOptions);
  const result = await runner.exec(args, finalOptions);

  const {files, summary} = parseCalculateHashOutput(result.stdout);

  return {
    targetPath,
    files,
    summary,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
