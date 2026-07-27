import type {Readable, Writable} from 'stream';
import type {ChildProcess} from 'child_process';
import type {ISevenZipRunner} from '../core/runner.js';
import type {ArchiveFormat, CompressionLevel, DownloadOptions, OverwriteMode} from './common.js';

export interface CompressOptions {
  /**
   * Compression format (e.g. '7z', 'zip', 'tar', 'gzip', 'bzip2', 'xz', 'wim').
   * If omitted, auto-detected from output file extension (defaulting to '7z').
   */
  format?: ArchiveFormat;

  /**
   * Alias for format.
   */
  archiveFormat?: ArchiveFormat;

  /**
   * Compression level (0 to 9, or 'store', 'fastest', 'fast', 'normal', 'maximum', 'ultra').
   * Default: 5 ('normal')
   */
  level?: CompressionLevel;

  /**
   * Alias for level.
   */
  compressionLevel?: CompressionLevel;

  /**
   * Compression method (e.g. 'LZMA', 'LZMA2', 'PPMd', 'BZip2', 'Deflate', 'Copy').
   */
  method?: string;

  /**
   * Dictionary size (e.g. '16m', '64m', '128m').
   */
  dictionarySize?: string;

  /**
   * Enable or disable solid archive mode (7z format).
   */
  solid?: boolean;

  /**
   * Password for archive encryption.
   */
  password?: string;

  /**
   * Encrypt archive header / filenames (-mhe=on/off, 7z format).
   */
  encryptHeader?: boolean;

  /**
   * Split archive into volumes of specified size (e.g. '10m', '700m', '4g').
   */
  volumeSize?: string;

  /**
   * Overwrite mode when destination archive or existing files collide.
   * - 'overwrite': Overwrite all existing files (-aoa)
   * - 'skip': Skip existing files (-aos)
   * - 'renameExisting': Auto rename existing files (-aou)
   * - 'autoRenameNew': Auto rename new files (-aot)
   */
  overwriteMode?: OverwriteMode;

  /**
   * Working directory for process execution.
   */
  workingDir?: string;

  /**
   * Recursively compress directory subfolders (default: true).
   */
  recursive?: boolean;

  /**
   * File exclusion pattern or array of patterns (e.g. '*.tmp', 'node_modules').
   */
  exclude?: string | string[];

  /**
   * File inclusion pattern or array of patterns (e.g. '*.txt').
   */
  include?: string | string[];

  /**
   * Delete source files after archiving (-sdel).
   */
  deleteSource?: boolean;

  /**
   * Number of CPU threads to use for compression (e.g. 4, or 'on', 'off').
   */
  threads?: number | string;

  /**
   * Generate Self-Extracting executable archive (-sfx[module]).
   * If true, generates a standalone executable archive (-sfx).
   * If a string is provided, specifies custom SFX module path or name (e.g. '7z.sfx' or '7zCon.sfx').
   */
  sfx?: boolean | string;

  /**
   * Additional raw 7-Zip CLI arguments.
   */
  customArgs?: string[];

  /**
   * Path to custom 7-Zip executable. If omitted, automatically resolved/downloaded.
   */
  executablePath?: string;

  /**
   * Options for downloading 7-Zip binary if executablePath is not specified.
   */
  downloadOptions?: DownloadOptions;

  /**
   * Custom runner instance for executing 7-Zip CLI commands.
   */
  runner?: ISevenZipRunner;
}

export interface CompressResult {
  /**
   * Path to the created archive file.
   */
  archivePath: string;
  /**
   * Standard output from 7-Zip CLI process.
   */
  stdout: string;
  /**
   * Standard error from 7-Zip CLI process.
   */
  stderr: string;
  /**
   * Exit code of 7-Zip CLI process.
   */
  exitCode: number;
}

export type StreamInput = Readable | Buffer | Uint8Array | string | string[] | null | undefined;

export interface CompressStreamOptions {
  /**
   * Target archive format for output stream (e.g. 'xz', '7z', 'zip', 'gzip', 'bzip2', 'tar').
   * Default: 'xz'
   */
  format?: ArchiveFormat;

  /**
   * Compression level (0 to 9, or 'store', 'fastest', 'fast', 'normal', 'maximum', 'ultra').
   */
  level?: CompressionLevel;

  /**
   * Compression method (e.g. 'LZMA2', 'LZMA', 'Deflate').
   */
  method?: string;

  /**
   * Dictionary size (e.g. '16m', '64m').
   */
  dictionarySize?: string;

  /**
   * Password for archive encryption.
   */
  password?: string;

  /**
   * Encrypt archive header / filenames (-mhe=on/off, 7z format).
   */
  encryptHeader?: boolean;

  /**
   * Virtual stream filename inside archive when streaming stdin (-si<name>).
   */
  streamName?: string;

  /**
   * Target output dummy archive filename argument required by 7-Zip CLI when streaming (-so).
   * Defaults to 'dummy.<format>' or 'dummy.xz'.
   */
  archiveName?: string;

  /**
   * CPU threads (-mmt).
   */
  threads?: number;

  /**
   * Working directory for process execution.
   */
  workingDir?: string;

  /**
   * Additional raw 7-Zip CLI arguments.
   */
  customArgs?: string[];

  /**
   * Path to custom 7-Zip executable. If omitted, automatically resolved/downloaded.
   */
  executablePath?: string;

  /**
   * Options for downloading 7-Zip binary if executablePath is not specified.
   */
  downloadOptions?: DownloadOptions;

  /**
   * Custom runner instance for executing 7-Zip CLI commands.
   */
  runner?: ISevenZipRunner;
}

export interface StreamDoneResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface CompressStreamResult extends Readable {
  stdin: Writable;
  process: ChildProcess;
  promise: Promise<StreamDoneResult>;
}
