import path from 'path';
import {execFile, spawn} from 'child_process';
import {PassThrough, Readable} from 'stream';
import {ensure7ZipExecutable} from './downloader.js';
import type {
  ArchiveFormat,
  CompressionLevel,
  CompressOptions,
  CompressResult,
  CompressStreamOptions,
  CompressStreamResult,
  StreamDoneResult,
  StreamInput,
} from './types.js';

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

/**
 * Constructs CLI arguments for 7-Zip stream compression (`a -so ...`).
 *
 * @param options Configuration parameters for stream compression.
 * @param isStreamInput True if reading from stdin (-si), false if compressing files from disk.
 * @param fileInputs Optional array of file/directory paths on disk.
 */
export function buildCompressStreamArgs(
  options?: CompressStreamOptions,
  isStreamInput: boolean = true,
  fileInputs?: string[],
): string[] {
  const args: string[] = ['a'];

  const format = options?.format || 'xz';
  args.push(`-t${format}`);

  // Stream output switch -so
  args.push('-so');

  // Stream input switch -si[streamName]
  if (isStreamInput) {
    if (options?.streamName) {
      args.push(`-si${options.streamName}`);
    } else {
      args.push('-si');
    }
  }

  // Compression level switch -mx
  const levelFlag = mapCompressionLevel(options?.level);
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

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Header encryption -mhe=on/off
  if (options?.encryptHeader !== undefined) {
    args.push(`-mhe=${options.encryptHeader ? 'on' : 'off'}`);
  }

  // Thread count -mmt
  if (options?.threads !== undefined) {
    args.push(`-mmt=${options.threads}`);
  }

  // Always non-interactive
  args.push('-y');

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameters: Dummy archive name (required by 7-Zip CLI when using -so)
  const dummyArchive = options?.archiveName || `dummy.${format}`;
  args.push(dummyArchive);

  // File inputs when not reading from stdin
  if (!isStreamInput && fileInputs && fileInputs.length > 0) {
    args.push(...fileInputs);
  }

  return args;
}

/**
 * Compresses data or file streams in-memory using 7-Zip CLI (`-si`, `-so`).
 * Returns standard Readable stream enriched with `.stdin`, `.process`, and `.promise`.
 *
 * Supported signatures:
 * - `compressStream(readableStream, options)`
 * - `compressStream(buffer, options)`
 * - `compressStream('filepath', options)`
 * - `compressStream(['file1', 'file2'], options)`
 * - `compressStream(options)` -> user writes/pipes into returned `.stdin`
 *
 * @param inputOrOptions Input data (stream, buffer, string path) OR options object.
 * @param optionsArg Options object if input is passed as 1st argument.
 */
export function compressStream(
  inputOrOptions?: StreamInput | CompressStreamOptions,
  optionsArg?: CompressStreamOptions,
): CompressStreamResult {
  let input: StreamInput;
  let options: CompressStreamOptions | undefined;

  if (
    inputOrOptions &&
    typeof inputOrOptions === 'object' &&
    !Buffer.isBuffer(inputOrOptions) &&
    !(inputOrOptions instanceof Uint8Array) &&
    !(inputOrOptions instanceof Readable)
  ) {
    if (Array.isArray(inputOrOptions) && inputOrOptions.every(i => typeof i === 'string')) {
      input = inputOrOptions as string[];
      options = optionsArg;
    } else {
      input = undefined;
      options = inputOrOptions as CompressStreamOptions;
    }
  } else {
    input = inputOrOptions as StreamInput;
    options = optionsArg;
  }

  let isStreamInput = true;
  let fileInputs: string[] | undefined = undefined;

  if (typeof input === 'string') {
    isStreamInput = false;
    fileInputs = [input];
  } else if (Array.isArray(input) && input.every(i => typeof i === 'string')) {
    isStreamInput = false;
    fileInputs = input as string[];
  }

  const workingDir = options?.workingDir || process.cwd();
  const args = buildCompressStreamArgs(options, isStreamInput, fileInputs);

  const inStream = new PassThrough();
  const outStream = new Readable({
    read() {},
  }) as CompressStreamResult;

  let resolvePromise: (res: StreamDoneResult) => void;
  let rejectPromise: (err: Error) => void;

  const donePromise = new Promise<StreamDoneResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  (outStream as any).stdin = inStream;
  (outStream as any).promise = donePromise;

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];

  let execPathPromise: Promise<string>;
  if (options?.executablePath) {
    execPathPromise = Promise.resolve(options.executablePath);
  } else {
    execPathPromise = ensure7ZipExecutable(options?.downloadOptions);
  }

  execPathPromise
    .then(execPath => {
      const child = spawn(execPath, args, {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      (outStream as any).process = child;

      inStream.pipe(child.stdin);

      child.stdout.on('data', chunk => {
        const buf = Buffer.from(chunk);
        stdoutChunks.push(buf);
        outStream.push(buf);
      });

      child.stderr.on('data', chunk => {
        stderrChunks.push(Buffer.from(chunk));
      });

      child.on('error', err => {
        outStream.destroy(err);
        rejectPromise(err);
      });

      child.on('close', code => {
        const exitCode = code ?? 0;
        const stdoutStr = Buffer.concat(stdoutChunks).toString();
        const stderrStr = Buffer.concat(stderrChunks).toString();

        outStream.push(null);

        if (exitCode > 1) {
          const errorMsg = `7-Zip stream compression failed with exit code ${exitCode}:\n${stderrStr || stdoutStr}`;
          const err = new Error(errorMsg);
          outStream.destroy(err);
          rejectPromise(err);
        } else {
          resolvePromise({
            exitCode,
            stdout: stdoutStr,
            stderr: stderrStr,
          });
        }
      });

      // Handle piped / buffer input if provided
      if (isStreamInput && input) {
        if (input instanceof Readable) {
          input.pipe(inStream);
        } else if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
          inStream.write(input);
          inStream.end();
        }
      }
    })
    .catch(err => {
      outStream.destroy(err);
      rejectPromise(err);
    });

  return outStream;
}
