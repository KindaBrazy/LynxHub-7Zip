import path from 'path';
import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import {StreamAdapter} from './stream_adapter.js';
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

export const inferFormatFromExtension = CommandCompiler.inferFormatFromExtension;
export const mapCompressionLevel = CommandCompiler.mapCompressionLevel;
export const buildCompressArgs = CommandCompiler.compress;
export const buildCompressStreamArgs = CommandCompiler.compressStream;

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

  const runner = options?.runner || getDefaultRunner();
  const args = buildCompressArgs(inputList, outputArchive, options);
  const result = await runner.exec(args, options);

  return {
    archivePath: path.resolve(options?.workingDir || process.cwd(), outputArchive),
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
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
  const {input, options} = StreamAdapter.parseArgs(inputOrOptions, optionsArg);

  let isStreamInput = true;
  let fileInputs: string[] | undefined = undefined;

  if (typeof input === 'string') {
    isStreamInput = false;
    fileInputs = [input];
  } else if (Array.isArray(input) && input.every(i => typeof i === 'string')) {
    isStreamInput = false;
    fileInputs = input as string[];
  }

  const runner = options?.runner || getDefaultRunner();
  const args = buildCompressStreamArgs(options, isStreamInput, fileInputs);
  return runner.stream(args, isStreamInput ? input : undefined, options);
}
