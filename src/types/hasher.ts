import type {ISevenZipRunner} from '../core/runner.js';
import type {DownloadOptions} from './common.js';

export type HashAlgorithm = 'CRC32' | 'CRC64' | 'SHA1' | 'SHA256' | '*' | string;

export interface CalculateHashOptions {
  /**
   * Hash algorithm to calculate (e.g. 'CRC32', 'CRC64', 'SHA1', 'SHA256', '*').
   * Default: 'SHA256'
   */
  hashType?: HashAlgorithm;

  /**
   * Alias for hashType.
   */
  hashAlgorithm?: HashAlgorithm;

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

export interface HashItem {
  /**
   * Relative or absolute path of the hashed file.
   */
  path: string;

  /**
   * File size in bytes.
   */
  size?: number;

  /**
   * Dictionary of calculated hash values per algorithm (e.g. { CRC32: 'A1B2C3D4', SHA256: '...' }).
   */
  hashes: Record<string, string>;
}

export interface CalculateHashResult {
  /**
   * Input target path(s) passed to calculateHash.
   */
  targetPath: string | string[];

  /**
   * List of files with calculated hash values.
   */
  files: HashItem[];

  /**
   * Overall summary hash values for all processed data (e.g. { CRC32: '...', SHA256: '...' }).
   */
  summary: Record<string, string>;

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
