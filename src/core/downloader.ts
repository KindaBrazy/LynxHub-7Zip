import fs from 'fs';
import path from 'path';
import os from 'os';
import {execSync} from 'child_process';
import {Buffer} from 'buffer';
import type {DownloadOptions, ReleaseAsset, ReleaseInfo, SupportedArch, SupportedOS} from '../types/index.js';

/**
 * Gets default user download directory: ~/Downloads/LynxHub
 */
export function getDefaultDownloadPath(): string {
  return path.join(os.homedir(), 'Downloads', 'LynxHub');
}

/**
 * Fetch latest 7-Zip release metadata from GitHub API with fallback
 */
export async function fetchLatestRelease(version?: string): Promise<ReleaseInfo> {
  const url = version
    ? `https://api.github.com/repos/ip7z/7zip/releases/tags/${encodeURIComponent(version)}`
    : 'https://api.github.com/repos/ip7z/7zip/releases/latest';

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LynxHub-7Zip-Downloader',
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.ok) {
      const data = (await response.json()) as ReleaseInfo;
      if (data && data.tag_name && Array.isArray(data.assets)) {
        return data;
      }
    }
  } catch {
    // Fallback if API is unreachable or rate limited
  }

  // Fallback version metadata
  const resolvedVersion = version || '26.02';
  const cleanVer = resolvedVersion.replace(/^v/, '').replace(/\./g, '');
  const baseUrl = `https://github.com/ip7z/7zip/releases/download/${resolvedVersion}`;

  return {
    tag_name: resolvedVersion,
    name: `7-Zip ${resolvedVersion}`,
    published_at: new Date().toISOString(),
    assets: [
      {
        name: '7zr.exe',
        browser_download_url: `${baseUrl}/7zr.exe`,
        size: 602112,
      },
      {
        name: `7z${cleanVer}-extra.7z`,
        browser_download_url: `${baseUrl}/7z${cleanVer}-extra.7z`,
        size: 1758916,
      },
      {
        name: `7z${cleanVer}-linux-x64.tar.xz`,
        browser_download_url: `${baseUrl}/7z${cleanVer}-linux-x64.tar.xz`,
        size: 1571416,
      },
      {
        name: `7z${cleanVer}-linux-x86.tar.xz`,
        browser_download_url: `${baseUrl}/7z${cleanVer}-linux-x86.tar.xz`,
        size: 1724368,
      },
      {
        name: `7z${cleanVer}-linux-arm64.tar.xz`,
        browser_download_url: `${baseUrl}/7z${cleanVer}-linux-arm64.tar.xz`,
        size: 1326944,
      },
      {
        name: `7z${cleanVer}-linux-arm.tar.xz`,
        browser_download_url: `${baseUrl}/7z${cleanVer}-linux-arm.tar.xz`,
        size: 1215796,
      },
      {
        name: `7z${cleanVer}-mac.tar.xz`,
        browser_download_url: `${baseUrl}/7z${cleanVer}-mac.tar.xz`,
        size: 1859992,
      },
    ],
  };
}

/**
 * Normalizes host architecture to 7-Zip naming conventions
 */
export function normalizeArch(arch: SupportedArch): string {
  switch (arch) {
    case 'x64':
    case 'x86_64':
      return 'x64';
    case 'ia32':
    case 'x86':
      return 'x86';
    case 'arm64':
    case 'aarch64':
      return 'arm64';
    case 'arm':
      return 'arm';
    default:
      return arch;
  }
}

/**
 * Selects appropriate release asset for specified OS and Architecture
 */
export function selectAssetForPlatform(
  assets: ReleaseAsset[],
  targetOS: SupportedOS,
  targetArch: SupportedArch,
  variant: '7za' | '7zr' = '7za',
): ReleaseAsset {
  const normArch = normalizeArch(targetArch);

  if (targetOS === 'win32') {
    if (variant === '7zr') {
      const standaloneAsset = assets.find(a => a.name.toLowerCase() === '7zr.exe');
      if (standaloneAsset) return standaloneAsset;
    } else {
      // Default: '7za'
      const extraAsset = assets.find(a => a.name.toLowerCase().includes('extra.7z'));
      if (extraAsset) return extraAsset;

      const standaloneAsset = assets.find(a => a.name.toLowerCase() === '7zr.exe');
      if (standaloneAsset) return standaloneAsset;
    }

    const exeAsset = assets.find(a => a.name.toLowerCase().endsWith('.exe') && a.name.toLowerCase().includes(normArch));
    if (exeAsset) return exeAsset;
  } else if (targetOS === 'linux') {
    const linuxAsset = assets.find(
      a => a.name.toLowerCase().includes('linux') && a.name.toLowerCase().includes(normArch),
    );
    if (linuxAsset) return linuxAsset;
  } else if (targetOS === 'darwin') {
    const macAsset = assets.find(a => a.name.toLowerCase().includes('mac'));
    if (macAsset) return macAsset;
  }

  // Fallback to first matching asset or first available asset
  return assets[0];
}

/**
 * Downloads file from URL following redirects and saving to target location
 */
export async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'LynxHub-7Zip-Downloader',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download from ${url}: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.mkdir(path.dirname(destPath), {recursive: true});
  await fs.promises.writeFile(destPath, buffer);
}

/**
 * Extracts binary from archive (.tar.xz or .7z) if needed
 */
export function extractBinaryIfNeeded(archivePath: string, extractDir: string, targetOS: SupportedOS): string {
  const ext = path.extname(archivePath).toLowerCase();
  const filename = path.basename(archivePath);

  // Direct standalone executable
  if (filename.toLowerCase() === '7zr.exe' || filename.toLowerCase().endsWith('.exe')) {
    const targetFile = path.join(extractDir, filename);
    if (archivePath !== targetFile) {
      fs.mkdirSync(extractDir, {recursive: true});
      fs.copyFileSync(archivePath, targetFile);
    }
    return targetFile;
  }

  // Tar archive (.tar.xz)
  if (archivePath.toLowerCase().endsWith('.tar.xz') || ext === '.xz') {
    fs.mkdirSync(extractDir, {recursive: true});
    try {
      execSync(`tar -xf "${archivePath}" -C "${extractDir}"`, {stdio: 'pipe'});
    } catch (err) {
      throw new Error(`Failed to extract tar archive ${archivePath}: ${String(err)}`, {cause: err});
    }

    // Console executable in tar.xz is '7zz' or '7zzs'
    const expectedNames = ['7zz', '7zzs'];
    for (const name of expectedNames) {
      const p = path.join(extractDir, name);
      if (fs.existsSync(p)) return p;
    }
  }

  // 7z archive (.7z, e.g. extra.7z)
  if (archivePath.toLowerCase().endsWith('.7z') || ext === '.7z') {
    fs.mkdirSync(extractDir, {recursive: true});
    const existingExtractors = ['7zr.exe', '7za.exe', '7z.exe', '7zz', '7zzs'];
    let extractorPath: string | undefined;
    for (const name of existingExtractors) {
      const p = path.join(extractDir, name);
      if (fs.existsSync(p) && fs.statSync(p).size > 0) {
        extractorPath = p;
        break;
      }
    }

    if (extractorPath) {
      try {
        execSync(`"${extractorPath}" x "${archivePath}" -o"${extractDir}" -y`, {stdio: 'pipe'});
      } catch (err) {
        throw new Error(`Failed to extract 7z archive ${archivePath}: ${String(err)}`, {cause: err});
      }
    }
  }

  // Fallback search in extract directory
  if (fs.existsSync(extractDir)) {
    const files = fs.readdirSync(extractDir);
    const exeCandidate = files.find(
      (f: string) => f === '7za.exe' || f === '7z.exe' || f === '7zz' || f === '7zzs' || f === '7zr.exe',
    );
    if (exeCandidate) {
      return path.join(extractDir, exeCandidate);
    }
  }

  return archivePath;
}

/**
 * Main method:
 * 1. Checks if target 7-Zip executable is already downloaded at targetPath (default: ~/Downloads/LynxHub)
 * 2. If already downloaded and valid, returns executable path immediately.
 * 3. If not, queries GitHub releases at runtime, downloads target file, extracts if necessary, and returns executable path.
 */
export async function ensure7ZipExecutable(options?: DownloadOptions): Promise<string> {
  const targetOS = options?.os || process.platform;
  const targetArch = options?.arch || process.arch;
  const targetDir = options?.targetPath || getDefaultDownloadPath();
  const variant = options?.variant || '7za';

  const expectedExecNames =
    targetOS === 'win32'
      ? variant === '7zr'
        ? ['7zr.exe', '7za.exe', '7z.exe']
        : ['7za.exe', '7z.exe', '7zr.exe']
      : ['7zz', '7zzs'];

  // Check if executable already exists in target directory
  if (!options?.forceDownload && fs.existsSync(targetDir)) {
    for (const name of expectedExecNames) {
      const candidatePath = path.join(targetDir, name);
      if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).size > 0) {
        return candidatePath;
      }
    }
  }

  // Fetch release info from GitHub at runtime
  const release = await fetchLatestRelease(options?.version);
  const asset = selectAssetForPlatform(release.assets, targetOS, targetArch, variant);

  fs.mkdirSync(targetDir, {recursive: true});
  const downloadedPath = path.join(targetDir, asset.name);

  // Download asset if missing or force requested
  if (options?.forceDownload || !fs.existsSync(downloadedPath)) {
    await downloadFile(asset.browser_download_url, downloadedPath);
  }

  // Extract or relocate executable
  let execPath = extractBinaryIfNeeded(downloadedPath, targetDir, targetOS);

  // If extraction returned the .7z archive path itself because no extractor was present, fetch 7zr.exe to extract it
  if (downloadedPath.toLowerCase().endsWith('.7z') && execPath === downloadedPath) {
    const standaloneAsset = release.assets.find(a => a.name.toLowerCase() === '7zr.exe');
    const zrPath = path.join(targetDir, '7zr.exe');
    if (standaloneAsset && !fs.existsSync(zrPath)) {
      await downloadFile(standaloneAsset.browser_download_url, zrPath);
    }
    if (fs.existsSync(zrPath)) {
      try {
        execSync(`"${zrPath}" x "${downloadedPath}" -o"${targetDir}" -y`, {stdio: 'pipe'});
      } catch (err) {
        throw new Error(`Failed to extract 7z archive ${downloadedPath}: ${String(err)}`, {cause: err});
      }
    }
    execPath = extractBinaryIfNeeded(downloadedPath, targetDir, targetOS);
  }

  // Ensure executable permissions on Unix-like systems
  if (targetOS !== 'win32' && fs.existsSync(execPath)) {
    try {
      fs.chmodSync(execPath, 0o755);
    } catch {
      // Ignore permission edit failures if user lacks permission
    }
  }

  return execPath;
}
