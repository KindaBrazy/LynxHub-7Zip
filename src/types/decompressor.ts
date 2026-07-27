import type {ISevenZipRunner} from '../core/runner.js';
import type {ArchiveFormat, DownloadOptions, OverwriteMode} from './common.js';
import type {CompressStreamResult, StreamDoneResult} from './compressor.js';

export type ExtractionMode = 'fullPath' | 'flat' | 'test';

export interface DecompressOptions {
  /**
   * Target destination directory for extracted files (-o<dir>).
   * Defaults to process.cwd() or current working directory if omitted.
   */
  outputDir?: string;

  /**
   * Alias for outputDir.
   */
  destination?: string;

  /**
   * Extraction mode:
   * - 'fullPath' (default): Extract preserving directory structure ('x' command)
   * - 'flat': Extract all files to root output folder ignoring directory paths ('e' command)
   * - 'test': Test archive integrity without extracting files ('t' command)
   */
  mode?: ExtractionMode;

  /**
   * Enable/disable directory structure preservation.
   * If true (default), preserves directory structure ('x').
   * If false, extracts flat without directory hierarchy ('e').
   */
  preservePaths?: boolean;

  /**
   * Shortcut to perform integrity test only ('t' command).
   */
  testOnly?: boolean;

  /**
   * Archive format override (e.g. '7z', 'zip', 'rar', 'tar', 'gzip', 'bzip2', 'xz', 'wim').
   * Optional. 7-Zip auto-detects format if omitted.
   */
  format?: ArchiveFormat;

  /**
   * Password for encrypted archives (-p<password>).
   */
  password?: string;

  /**
   * Overwrite mode when existing files collide:
   * - 'overwrite' (default): Overwrite all existing files (-aoa)
   * - 'skip': Skip existing files (-aos)
   * - 'renameExisting': Auto-rename existing destination files (-aou)
   * - 'autoRenameNew': Auto-rename newly extracted files (-aot)
   */
  overwriteMode?: OverwriteMode;

  /**
   * Recursively match wildcards/subdirectories (-r) (default: true).
   */
  recursive?: boolean;

  /**
   * File pattern or array of patterns to include/extract (e.g. '*.txt', 'docs/*').
   */
  include?: string | string[];

  /**
   * File pattern or array of patterns to exclude from extraction (e.g. '*.tmp', '*.log').
   */
  exclude?: string | string[];

  /**
   * Eliminate root directory duplication upon extraction (-spe).
   */
  eliminateRootFolder?: boolean;

  /**
   * Use fully qualified file paths (-spf or -spf2).
   */
  fullPaths?: boolean | 2;

  /**
   * Set hash calculation function during extraction/testing (-scrc).
   * e.g. 'CRC32', 'CRC64', 'SHA256', '*'
   */
  hashFunction?: 'CRC32' | 'CRC64' | 'SHA256' | '*';

  /**
   * Number of CPU threads to use (-mmt).
   */
  threads?: number | string;

  /**
   * Delete archive file after successful extraction.
   */
  deleteArchive?: boolean;

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

export type ExtractOptions = DecompressOptions;

export interface DecompressResult {
  /**
   * Absolute path to the extracted archive file.
   */
  archivePath: string;
  /**
   * Absolute path to the output directory.
   */
  outputDir: string;
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

export type ExtractResult = DecompressResult;

export interface DecompressStreamOptions {
  /**
   * Format override (-t). Required when decompressing from raw stdin if auto-detection is unavailable.
   */
  format?: ArchiveFormat;

  /**
   * Password for protected archives.
   */
  password?: string;

  /**
   * CPU threads (-mmt).
   */
  threads?: number;

  /**
   * Path to input archive file on disk (if not reading from stream/Buffer).
   */
  archivePath?: string;

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

export type DecompressStreamResult = CompressStreamResult;
export type {StreamDoneResult};
