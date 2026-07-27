import type {ISevenZipRunner} from '../core/runner.js';
import type {ArchiveFormat, CompressionLevel, DownloadOptions} from './common.js';

export interface DeleteFromArchiveOptions {
  /**
   * Password for password-protected archive (-p<password>).
   */
  password?: string;

  /**
   * Archive format override (e.g. '7z', 'zip', 'tar', 'wim').
   */
  format?: ArchiveFormat;

  /**
   * Recursively process subdirectories (-r) (default: true).
   */
  recursive?: boolean;

  /**
   * File pattern or array of patterns to include (-ir!).
   */
  include?: string | string[];

  /**
   * File pattern or array of patterns to exclude (-xr!).
   */
  exclude?: string | string[];

  /**
   * Assign working directory for temporary archive operations (-w<dir>).
   */
  workDir?: string;

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

export interface DeleteFromArchiveResult {
  /**
   * Absolute path to the modified archive file.
   */
  archivePath: string;

  /**
   * Array of targets requested for deletion.
   */
  targets: string[];

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

export type RenamePair = {from: string; to: string} | [string, string];

export interface RenameInArchiveOptions {
  /**
   * Password for password-protected archive (-p<password>).
   */
  password?: string;

  /**
   * Archive format override (e.g. '7z', 'zip', 'tar', 'wim').
   */
  format?: ArchiveFormat;

  /**
   * Recursively process subdirectories (-r) (default: true).
   */
  recursive?: boolean;

  /**
   * Assign working directory for temporary archive operations (-w<dir>).
   */
  workDir?: string;

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

export interface RenameInArchiveResult {
  /**
   * Absolute path to the modified archive file.
   */
  archivePath: string;

  /**
   * Normalized array of rename pairs processed.
   */
  renames: Array<{from: string; to: string}>;

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

export interface UpdateArchiveOptions {
  /**
   * Compression format (e.g. '7z', 'zip', 'tar', 'wim').
   */
  format?: ArchiveFormat;

  /**
   * Alias for format.
   */
  archiveFormat?: ArchiveFormat;

  /**
   * Compression level (0 to 9, or 'store', 'fastest', 'fast', 'normal', 'maximum', 'ultra').
   */
  level?: CompressionLevel;

  /**
   * Alias for level.
   */
  compressionLevel?: CompressionLevel;

  /**
   * Password for encrypted archives.
   */
  password?: string;

  /**
   * Encrypt archive header / filenames (-mhe=on/off).
   */
  encryptHeader?: boolean;

  /**
   * Recursively process subdirectories (-r) (default: true).
   */
  recursive?: boolean;

  /**
   * File pattern or array of patterns to include (-ir!).
   */
  include?: string | string[];

  /**
   * File pattern or array of patterns to exclude (-xr!).
   */
  exclude?: string | string[];

  /**
   * Delete source files after updating archive (-sdel).
   */
  deleteSource?: boolean;

  /**
   * Specific update action configuration switch (e.g. '-up0q0r2x1y2z0w2').
   */
  updateSwitch?: string;

  /**
   * Assign working directory for temporary archive operations (-w<dir>).
   */
  workDir?: string;

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

export interface UpdateArchiveResult {
  /**
   * Absolute path to the modified archive file.
   */
  archivePath: string;

  /**
   * Targets passed to update operation.
   */
  targets: string[];

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
