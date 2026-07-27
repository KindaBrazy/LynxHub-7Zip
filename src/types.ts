export type SupportedOS = 'win32' | 'linux' | 'darwin' | string;
export type SupportedArch = 'x64' | 'ia32' | 'arm64' | 'arm' | string;

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tag_name: string;
  name: string;
  published_at: string;
  assets: ReleaseAsset[];
}

export interface DownloadOptions {
  /**
   * Target directory where the binary will be downloaded and stored.
   * Defaults to ~/Downloads/LynxHub
   */
  targetPath?: string;
  /**
   * Version of 7-Zip to fetch (e.g. "26.02").
   * If omitted, latest version is resolved at runtime from GitHub releases.
   */
  version?: string;
  /**
   * Operating system override (defaults to process.platform: "win32", "linux", "darwin")
   */
  os?: SupportedOS;
  /**
   * Architecture override (defaults to process.arch: "x64", "ia32", "arm64", "arm")
   */
  arch?: SupportedArch;
  /**
   * Force re-download even if executable already exists in target path.
   */
  forceDownload?: boolean;
}

export type CompressionLevel = 0 | 1 | 3 | 5 | 7 | 9 | 'store' | 'fastest' | 'fast' | 'normal' | 'maximum' | 'ultra';

export type OverwriteMode = 'overwrite' | 'skip' | 'renameExisting' | 'autoRenameNew';

export type ArchiveFormat = '7z' | 'zip' | 'tar' | 'gzip' | 'bzip2' | 'xz' | 'wim' | string;

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

/* ========================================================================== */
/* Archive Inspection Types (listArchive)                                     */
/* ========================================================================== */

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

/* ========================================================================== */
/* File Hashing Types (calculateHash)                                         */
/* ========================================================================== */

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

/* ========================================================================== */
/* Archive Integrity Testing Types (testArchive)                              */
/* ========================================================================== */

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

/* ========================================================================== */
/* CPU/RAM Benchmarking Types (runBenchmark)                                 */
/* ========================================================================== */

export interface BenchmarkOptions {
  /**
   * Number of benchmark iterations/passes (e.g. 1, 2, 5).
   */
  iterations?: number;

  /**
   * Dictionary size for benchmark (e.g. '22', '24', '16m', '64m').
   */
  dictionarySize?: string;

  /**
   * Number of CPU threads to use for benchmarking (e.g. 2, 4, 'on', 'off').
   */
  threads?: number | string;

  /**
   * Compression method to benchmark (e.g. 'LZMA', 'LZMA2', '*').
   */
  method?: string;

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
}

export interface BenchmarkMetric {
  /**
   * Speed in KiB/s.
   */
  speedKiBs?: number;

  /**
   * CPU usage percentage (e.g. 382).
   */
  usagePercent?: number;

  /**
   * Rating in MIPS (Million Instructions Per Second) per CPU usage (R/U).
   */
  ratingMips?: number;

  /**
   * Overall / average rating in MIPS.
   */
  ratingMipsAvg?: number;
}

export interface BenchmarkResult {
  /**
   * Total host system RAM in MB (if reported by 7-Zip CLI).
   */
  ramSize?: number;

  /**
   * Total host system CPU hardware threads (if reported by 7-Zip CLI).
   */
  cpuThreads?: number;

  /**
   * RAM usage during benchmark run in MB (if reported by 7-Zip CLI).
   */
  ramUsage?: number;

  /**
   * Compression performance metrics.
   */
  compressing?: BenchmarkMetric;

  /**
   * Decompression performance metrics.
   */
  decompressing?: BenchmarkMetric;

  /**
   * Total combined benchmark summary score.
   */
  total?: BenchmarkMetric;

  /**
   * Dictionary of raw parsed properties / header info from benchmark output.
   */
  rawInfo?: Record<string, string>;

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
