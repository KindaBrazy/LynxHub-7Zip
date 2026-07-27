import type {ISevenZipRunner} from '../core/runner.js';
import type {ArchiveFormat, DownloadOptions} from './common.js';

export interface TestArchiveOptions {
  /**
   * Password for password-protected archive integrity test (-p<password>).
   */
  password?: string;

  /**
   * Archive format override (e.g. '7z', 'zip', 'tar', 'rar').
   */
  format?: ArchiveFormat;

  /**
   * Recursively test matching wildcards/subdirectories (-r) (default: true).
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
   * Number of CPU threads to use (-mmt).
   */
  threads?: number | string;

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

export interface TestArchiveResult {
  /**
   * True if archive is healthy and password (if any) is correct ("Everything is Ok").
   */
  valid: boolean;

  /**
   * Absolute path to the tested archive file.
   */
  archivePath: string;

  /**
   * Total number of files verified inside archive (if parsed from output).
   */
  testedFilesCount?: number;

  /**
   * Total number of folders verified inside archive (if parsed from output).
   */
  testedFoldersCount?: number;

  /**
   * Total uncompressed size in bytes verified inside archive (if parsed from output).
   */
  totalSize?: number;

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
