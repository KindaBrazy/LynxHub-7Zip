import fs from 'fs';
import path from 'path';
import {execFile, spawn} from 'child_process';
import {PassThrough, Readable} from 'stream';
import {ensure7ZipExecutable} from './downloader.js';
import type {
  DecompressOptions,
  DecompressResult,
  DecompressStreamOptions,
  DecompressStreamResult,
  StreamDoneResult,
  StreamInput,
} from './types.js';

/**
 * Constructs command line argument array for 7-Zip executable based on DecompressOptions.
 */
export function buildDecompressArgs(archivePath: string, outputDir?: string, options?: DecompressOptions): string[] {
  let command: string;
  if (options?.testOnly || options?.mode === 'test') {
    command = 't';
  } else if (options?.preservePaths === false || options?.mode === 'flat') {
    command = 'e';
  } else {
    command = 'x';
  }

  const args: string[] = [command];

  // Archive format override -t
  if (options?.format) {
    args.push(`-t${options.format}`);
  }

  // Target output directory switch -o<dir> (no space)
  const targetOutputDir = options?.outputDir || options?.destination || outputDir;
  if (targetOutputDir && command !== 't') {
    args.push(`-o${targetOutputDir}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Overwrite mode -ao
  const overwriteMode = options?.overwriteMode || 'overwrite';
  switch (overwriteMode) {
    case 'skip':
      args.push('-aos');
      break;
    case 'renameExisting':
      args.push('-aou');
      break;
    case 'autoRenameNew':
      args.push('-aot');
      break;
    case 'overwrite':
    default:
      args.push('-aoa');
      break;
  }

  // Non-interactive switch
  args.push('-y');

  // Recurse subdirectories for matching files -r
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

  // Eliminate root folder duplication -spe
  if (options?.eliminateRootFolder) {
    args.push('-spe');
  }

  // Full qualified paths -spf / -spf2
  if (options?.fullPaths === 2) {
    args.push('-spf2');
  } else if (options?.fullPaths === true) {
    args.push('-spf');
  }

  // Hash calculation switch -scrc
  if (options?.hashFunction) {
    args.push(`-scrc${options.hashFunction}`);
  }

  // CPU threads -mmt
  if (options?.threads !== undefined) {
    args.push(`-mmt=${options.threads}`);
  }

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameter: input archive path
  args.push(archivePath);

  return args;
}

/**
 * Decompresses (extracts) an archive file using 7-Zip CLI binary.
 *
 * Supports flexible call signatures:
 * - `decompress('archive.7z')` -> extracts to working directory
 * - `decompress('archive.7z', './output')` -> extracts to specified directory
 * - `decompress('archive.7z', { outputDir: './output', password: 'pass' })`
 * - `decompress('archive.7z', './output', { password: 'pass' })`
 *
 * @param archivePath Path to the input archive file.
 * @param outputDirOrOptions Output directory string OR configuration options.
 * @param options Configuration parameters if outputDir is passed as 2nd parameter.
 */
export async function decompress(
  archivePath: string,
  outputDirOrOptions?: string | DecompressOptions,
  options?: DecompressOptions,
): Promise<DecompressResult> {
  if (!archivePath || archivePath.trim() === '') {
    throw new Error('Archive path must be specified.');
  }

  let finalOutputDir: string | undefined;
  let finalOptions: DecompressOptions | undefined;

  if (typeof outputDirOrOptions === 'string') {
    finalOutputDir = outputDirOrOptions;
    finalOptions = options;
  } else if (typeof outputDirOrOptions === 'object' && outputDirOrOptions !== null) {
    finalOptions = outputDirOrOptions;
    finalOutputDir = finalOptions.outputDir || finalOptions.destination;
  } else {
    finalOptions = options;
    finalOutputDir = options?.outputDir || options?.destination;
  }

  const workingDirectory = finalOptions?.workingDir || process.cwd();
  const targetDir = finalOutputDir ? path.resolve(workingDirectory, finalOutputDir) : workingDirectory;

  const execPath = finalOptions?.executablePath || (await ensure7ZipExecutable(finalOptions?.downloadOptions));
  const args = buildDecompressArgs(archivePath, targetDir, finalOptions);

  return new Promise((resolve, reject) => {
    execFile(
      execPath,
      args,
      {
        cwd: workingDirectory,
        maxBuffer: 10 * 1024 * 1024,
      },
      async (error, stdout, stderr) => {
        const exitCode = error && typeof error.code === 'number' ? error.code : 0;

        // 7-Zip exit code 0 = normal, exit code 1 = non-fatal warning
        if (error && exitCode > 1) {
          return reject(
            new Error(`7-Zip extraction failed with exit code ${exitCode}:\n${stderr || stdout || error.message}`),
          );
        }

        const resolvedArchivePath = path.resolve(workingDirectory, archivePath);

        // Delete archive if user requested deleteArchive on successful extraction
        if (finalOptions?.deleteArchive) {
          try {
            if (fs.existsSync(resolvedArchivePath)) {
              await fs.promises.unlink(resolvedArchivePath);
            }
          } catch (unlinkErr) {
            console.warn(`Failed to delete source archive after extraction: ${unlinkErr}`);
          }
        }

        resolve({
          archivePath: resolvedArchivePath,
          outputDir: targetDir,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          exitCode,
        });
      },
    );
  });
}

/**
 * Alias for `decompress`.
 */
export const extract = decompress;

/**
 * Constructs CLI arguments for 7-Zip stream decompression (`e -so ...`).
 *
 * @param options Configuration options.
 * @param isStreamInput True if reading from stdin (-si), false if reading from disk file path.
 * @param archivePath Optional path to archive file on disk.
 */
export function buildDecompressStreamArgs(
  options?: DecompressStreamOptions,
  isStreamInput: boolean = true,
  archivePath?: string,
): string[] {
  const args: string[] = ['e'];

  // Stream output switch -so
  args.push('-so');

  // Stream input switch -si
  if (isStreamInput) {
    args.push('-si');
  }

  // Format override -t
  if (options?.format) {
    args.push(`-t${options.format}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // CPU threads -mmt
  if (options?.threads !== undefined) {
    args.push(`-mmt=${options.threads}`);
  }

  // Non-interactive switch
  args.push('-y');

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameter: archive file path when not reading from stdin
  if (!isStreamInput && archivePath) {
    args.push(archivePath);
  }

  return args;
}

/**
 * Decompresses archive streams or files in-memory using 7-Zip CLI (`-so`, `-si`).
 * Returns standard Readable stream enriched with `.stdin`, `.process`, and `.promise`.
 *
 * Supported signatures:
 * - `decompressStream(readableStream, options)`
 * - `decompressStream(buffer, options)`
 * - `decompressStream('archive.xz', options)`
 * - `decompressStream(options)` -> user writes compressed data into returned `.stdin`
 *
 * @param inputOrOptions Compressed stream/Buffer/file path OR options object.
 * @param optionsArg Configuration options if input is passed as 1st argument.
 */
export function decompressStream(
  inputOrOptions?: StreamInput | DecompressStreamOptions,
  optionsArg?: DecompressStreamOptions,
): DecompressStreamResult {
  let input: StreamInput;
  let options: DecompressStreamOptions | undefined;

  if (
    inputOrOptions &&
    typeof inputOrOptions === 'object' &&
    !Buffer.isBuffer(inputOrOptions) &&
    !(inputOrOptions instanceof Uint8Array) &&
    !(inputOrOptions instanceof Readable)
  ) {
    input = undefined;
    options = inputOrOptions as DecompressStreamOptions;
  } else {
    input = inputOrOptions as StreamInput;
    options = optionsArg;
  }

  let isStreamInput = true;
  let archivePath: string | undefined = options?.archivePath;

  if (typeof input === 'string') {
    isStreamInput = false;
    archivePath = input;
  }

  const workingDir = options?.workingDir || process.cwd();
  const args = buildDecompressStreamArgs(options, isStreamInput, archivePath);

  const inStream = new PassThrough();
  const outStream = new Readable({
    read() {},
  }) as DecompressStreamResult;

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
          const errorMsg = `7-Zip stream decompression failed with exit code ${exitCode}:\n${stderrStr || stdoutStr}`;
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
