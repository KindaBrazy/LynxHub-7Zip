import type {ISevenZipRunner} from '../core/runner.js';
import type {ArchiveFormat, DownloadOptions} from './common.js';

export interface ArchiveItem {
  /**
   * Relative path of the file or folder inside the archive.
   */
  path: string;

  /**
   * Uncompressed file size in bytes (if available).
   */
  size?: number;

  /**
   * Compressed / packed size in bytes (if available).
   */
  packedSize?: number;

  /**
   * Last modified timestamp string (e.g. "2026-01-01 12:00:00").
   */
  modified?: string;

  /**
   * Creation timestamp string (if available).
   */
  created?: string;

  /**
   * Last access timestamp string (if available).
   */
  accessed?: string;

  /**
   * Attributes string (e.g. "A", "D", "RSHD").
   */
  attributes?: string;

  /**
   * Indicates whether the item is encrypted.
   */
  encrypted?: boolean;

  /**
   * Checksum / CRC hash string of the item (if available).
   */
  crc?: string;

  /**
   * Compression method / algorithm (e.g. "LZMA2:12k", "Deflate").
   */
  method?: string;

  /**
   * Block index inside solid archive.
   */
  block?: number;

  /**
   * Comment string attached to item (if available).
   */
  comment?: string;

  /**
   * Host operating system name (e.g. "FAT", "NTFS", "Unix").
   */
  hostOS?: string;

  /**
   * Characteristics string (if available).
   */
  characteristics?: string;

  /**
   * True if item is a directory/folder.
   */
  isDir?: boolean;

  /**
   * Raw key-value metadata map parsed from 7-Zip -slt output.
   */
  raw: Record<string, string>;
}

export interface ListArchiveOptions {
  /**
   * Password for password-protected archive (-p<password>).
   */
  password?: string;

  /**
   * Enable technical detailed listing output (-slt).
   * Default: true
   */
  slt?: boolean;

  /**
   * Alias for slt.
   */
  technical?: boolean;

  /**
   * Archive format override (e.g. '7z', 'zip', 'tar', 'rar').
   */
  format?: ArchiveFormat;

  /**
   * Recursively match wildcards/subdirectories (-r) (default: true).
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

export interface ListArchiveResult {
  /**
   * Absolute path to the inspected archive file.
   */
  archivePath: string;

  /**
   * List of files and folders contained inside the archive.
   */
  items: ArchiveItem[];

  /**
   * Technical archive-level properties (e.g. Type, Physical Size, Headers Size, Method, Solid, Blocks).
   */
  rawInfo: Record<string, string>;

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

export interface SupportedFormatInfo {
  name: string;
  flags?: string;
  extensions: string[];
  signature?: string;
  raw: string;
}

export interface SupportedCodecInfo {
  name: string;
  id?: string;
  flags?: string;
  raw: string;
}

export interface SupportedHasherInfo {
  name: string;
  id?: string;
  size?: string;
  raw: string;
}

export interface GetSupportedFeaturesOptions {
  workingDir?: string;
  customArgs?: string[];
  executablePath?: string;
  downloadOptions?: DownloadOptions;
  runner?: ISevenZipRunner;
}

export interface SupportedFeaturesResult {
  version?: string;
  formats: SupportedFormatInfo[];
  codecs: SupportedCodecInfo[];
  hashers: SupportedHasherInfo[];
  rawInfo: Record<string, string>;
  stdout: string;
  stderr: string;
  exitCode: number;
}
