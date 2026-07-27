import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import type {
  DecompressOptions,
  DecompressResult,
  DecompressStreamOptions,
  DecompressStreamResult,
  StreamDoneResult,
  StreamInput,
} from './types.js';

export const buildDecompressArgs = CommandCompiler.decompress;
export const buildDecompressStreamArgs = CommandCompiler.decompressStream;


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

  const runner = finalOptions?.runner || getDefaultRunner();
  const args = buildDecompressArgs(archivePath, targetDir, finalOptions);
  const result = await runner.exec(args, finalOptions);

  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);

  if (finalOptions?.deleteArchive) {
    try {
      if (fs.existsSync(resolvedArchivePath)) {
        await fs.promises.unlink(resolvedArchivePath);
      }
    } catch (unlinkErr) {
      console.warn(`Failed to delete source archive after extraction: ${unlinkErr}`);
    }
  }

  return {
    archivePath: resolvedArchivePath,
    outputDir: targetDir,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

/**
 * Alias for `decompress`.
 */
export const extract = decompress;



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

  const runner = options?.runner || getDefaultRunner();
  const args = buildDecompressStreamArgs(options, isStreamInput, archivePath);
  return runner.stream(args, isStreamInput ? input : undefined, options);
}
