import path from 'path';
import {execFile} from 'child_process';
import {ensure7ZipExecutable} from './downloader.js';
import type {ArchiveFormat, CompressionLevel, CompressOptions, CompressResult} from './types.js';

/**
 * Infers target archive format from target output file extension.
 * Defaults to '7z' if extension is unrecognized or missing.
 */
export function inferFormatFromExtension(outputArchive: string): ArchiveFormat {
  const cleanPath = outputArchive.toLowerCase();
  if (cleanPath.endsWith('.tar.gz') || cleanPath.endsWith('.tgz') || cleanPath.endsWith('.gz')) {
    return 'gzip';
  }
  if (cleanPath.endsWith('.tar.bz2') || cleanPath.endsWith('.tbz2') || cleanPath.endsWith('.bz2')) {
    return 'bzip2';
  }
  if (cleanPath.endsWith('.tar.xz') || cleanPath.endsWith('.txz') || cleanPath.endsWith('.xz')) {
    return 'xz';
  }
  if (cleanPath.endsWith('.zip')) {
    return 'zip';
  }
  if (cleanPath.endsWith('.tar')) {
    return 'tar';
  }
  if (cleanPath.endsWith('.wim')) {
    return 'wim';
  }
  if (cleanPath.endsWith('.7z')) {
    return '7z';
  }
  return '7z';
}

/**
 * Converts CompressionLevel input into 7-Zip -mx argument string switch value.
 */
export function mapCompressionLevel(level?: CompressionLevel): string | undefined {
  if (level === undefined) return undefined;
  if (typeof level === 'number') {
    return `-mx=${Math.max(0, Math.min(9, Math.floor(level)))}`;
  }

  const levelStr = level.toString().toLowerCase();
  switch (levelStr) {
    case 'store':
    case '0':
      return '-mx=0';
    case 'fastest':
    case '1':
      return '-mx=1';
    case 'fast':
    case '3':
      return '-mx=3';
    case 'normal':
    case '5':
      return '-mx=5';
    case 'maximum':
    case '7':
      return '-mx=7';
    case 'ultra':
    case '9':
      return '-mx=9';
    default:
      if (!isNaN(Number(levelStr))) {
        return `-mx=${levelStr}`;
      }
      return undefined;
  }
}

/**
 * Constructs command line argument array for 7-Zip executable based on CompressOptions.
 */
export function buildCompressArgs(
  input: string | string[],
  outputArchive: string,
  options?: CompressOptions,
): string[] {
  const args: string[] = ['a'];

  // Archive format switch -t
  const format = options?.format || options?.archiveFormat || inferFormatFromExtension(outputArchive);
  if (format) {
    args.push(`-t${format}`);
  }

  // Compression level switch -mx
  const levelFlag = mapCompressionLevel(options?.level ?? options?.compressionLevel);
  if (levelFlag) {
    args.push(levelFlag);
  }

  // Compression method -m0=
  if (options?.method) {
    args.push(`-m0=${options.method}`);
  }

  // Dictionary size -md=
  if (options?.dictionarySize) {
    args.push(`-md=${options.dictionarySize}`);
  }

  // Solid mode -ms=on/off
  if (options?.solid !== undefined) {
    args.push(`-ms=${options.solid ? 'on' : 'off'}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Header encryption -mhe=on/off
  if (options?.encryptHeader !== undefined) {
    args.push(`-mhe=${options.encryptHeader ? 'on' : 'off'}`);
  }

  // Volume size -v
  if (options?.volumeSize) {
    args.push(`-v${options.volumeSize}`);
  }

  // Overwrite mode -ao
  if (options?.overwriteMode) {
    switch (options.overwriteMode) {
      case 'overwrite':
        args.push('-aoa');
        break;
      case 'skip':
        args.push('-aos');
        break;
      case 'renameExisting':
        args.push('-aou');
        break;
      case 'autoRenameNew':
        args.push('-aot');
        break;
    }
  }

  // Recursive mode -r (default enabled)
  if (options?.recursive === false) {
    args.push('-r-');
  } else {
    args.push('-r');
  }

  // Exclude patterns -xr!
  if (options?.exclude) {
    const excludes = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
    for (const pattern of excludes) {
      args.push(`-xr!${pattern}`);
    }
  }

  // Include patterns -ir!
  if (options?.include) {
    const includes = Array.isArray(options.include) ? options.include : [options.include];
    for (const pattern of includes) {
      args.push(`-ir!${pattern}`);
    }
  }

  // Delete source files switch -sdel
  if (options?.deleteSource) {
    args.push('-sdel');
  }

  // Thread count -mmt
  if (options?.threads !== undefined) {
    args.push(`-mmt=${options.threads}`);
  }

  // Self-Extracting Archive switch -sfx
  if (options?.sfx !== undefined && options?.sfx !== false) {
    if (typeof options.sfx === 'string' && options.sfx.trim() !== '') {
      args.push(`-sfx${options.sfx}`);
    } else {
      args.push('-sfx');
    }
  }

  // Always assume Yes to prompts (non-interactive)
  args.push('-y');

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameters: Output Archive, then Input Target(s)
  args.push(outputArchive);

  const inputList = Array.isArray(input) ? input : [input];
  args.push(...inputList);

  return args;
}

/**
 * Compresses files or directories using 7-Zip CLI binary.
 *
 * Defaults to auto-resolving/downloading 7-Zip executable if options.executablePath is omitted.
 *
 * @param input Single file/directory path or array of paths to compress.
 * @param outputArchive Output archive file path.
 * @param options Optional configuration parameters.
 */
export async function compress(
  input: string | string[],
  outputArchive: string,
  options?: CompressOptions,
): Promise<CompressResult> {
  const inputList = Array.isArray(input) ? input : [input];
  if (inputList.length === 0 || inputList.some(i => !i || i.trim() === '')) {
    throw new Error('Input path(s) must be specified and non-empty.');
  }
  if (!outputArchive || outputArchive.trim() === '') {
    throw new Error('Output archive path must be specified.');
  }

  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const args = buildCompressArgs(inputList, outputArchive, options);

  return new Promise((resolve, reject) => {
    execFile(
      execPath,
      args,
      {
        cwd: options?.workingDir || process.cwd(),
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === 'number' ? error.code : 0;

        // 7-Zip exit code 0 = normal, exit code 1 = non-fatal warning (e.g. locked file)
        if (error && exitCode > 1) {
          return reject(
            new Error(`7-Zip compression failed with exit code ${exitCode}:\n${stderr || stdout || error.message}`),
          );
        }

        resolve({
          archivePath: path.resolve(options?.workingDir || process.cwd(), outputArchive),
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode,
        });
      },
    );
  });
}

/**
 * Creates a Self-Extracting (.exe) archive using 7-Zip CLI binary.
 *
 * @param input Single file/directory path or array of paths to compress.
 * @param outputArchive Target SFX executable path (typically ends in .exe).
 * @param options Optional configuration parameters.
 */
export async function createSFX(
  input: string | string[],
  outputArchive: string,
  options?: CompressOptions,
): Promise<CompressResult> {
  const sfxOptions: CompressOptions = {
    ...options,
    sfx: options?.sfx ?? true,
  };
  return compress(input, outputArchive, sfxOptions);
}
