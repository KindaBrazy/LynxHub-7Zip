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
   * Preferred 7-Zip binary variant to download:
   * - '7za': Standalone 7-Zip console executable supporting 7z, ZIP, CAB, GZIP, BZIP2, TAR, etc. (Default)
   * - '7zr': Light reduced 7-Zip console executable supporting 7z format only.
   */
  variant?: '7za' | '7zr';
  /**
   * Force re-download even if executable already exists in target path.
   */
  forceDownload?: boolean;
}

export type CompressionLevel = 0 | 1 | 3 | 5 | 7 | 9 | 'store' | 'fastest' | 'fast' | 'normal' | 'maximum' | 'ultra';

export type OverwriteMode = 'overwrite' | 'skip' | 'renameExisting' | 'autoRenameNew';

export type ArchiveFormat = '7z' | 'zip' | 'tar' | 'gzip' | 'bzip2' | 'xz' | 'wim' | string;
