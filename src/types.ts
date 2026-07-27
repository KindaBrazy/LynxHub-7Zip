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
