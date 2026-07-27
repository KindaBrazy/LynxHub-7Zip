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
