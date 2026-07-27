import {describe, it, expect} from 'vitest';
import {selectAssetForPlatform, fetchLatestRelease} from '../core/downloader.js';
import type {ReleaseAsset} from '../types/common.js';

describe('7-Zip Downloader & Asset Selection', () => {
  const mockAssets: ReleaseAsset[] = [
    {
      name: '7zr.exe',
      browser_download_url: 'https://example.com/7zr.exe',
      size: 600000,
    },
    {
      name: '7z2602-extra.7z',
      browser_download_url: 'https://example.com/7z2602-extra.7z',
      size: 1700000,
    },
    {
      name: '7z2602-linux-x64.tar.xz',
      browser_download_url: 'https://example.com/7z2602-linux-x64.tar.xz',
      size: 1500000,
    },
    {
      name: '7z2602-mac.tar.xz',
      browser_download_url: 'https://example.com/7z2602-mac.tar.xz',
      size: 1800000,
    },
  ];

  it('selects 7za (extra.7z) by default on Windows win32', () => {
    const asset = selectAssetForPlatform(mockAssets, 'win32', 'x64');
    expect(asset.name).toBe('7z2602-extra.7z');
  });

  it('selects 7za (extra.7z) explicitly on Windows win32 when variant is 7za', () => {
    const asset = selectAssetForPlatform(mockAssets, 'win32', 'x64', '7za');
    expect(asset.name).toBe('7z2602-extra.7z');
  });

  it('selects 7zr.exe on Windows win32 when variant is 7zr', () => {
    const asset = selectAssetForPlatform(mockAssets, 'win32', 'x64', '7zr');
    expect(asset.name).toBe('7zr.exe');
  });

  it('selects linux tar.xz on linux platform regardless of variant', () => {
    const assetDefault = selectAssetForPlatform(mockAssets, 'linux', 'x64');
    expect(assetDefault.name).toBe('7z2602-linux-x64.tar.xz');

    const assetZr = selectAssetForPlatform(mockAssets, 'linux', 'x64', '7zr');
    expect(assetZr.name).toBe('7z2602-linux-x64.tar.xz');
  });

  it('selects mac tar.xz on darwin platform', () => {
    const asset = selectAssetForPlatform(mockAssets, 'darwin', 'x64');
    expect(asset.name).toBe('7z2602-mac.tar.xz');
  });

  it('fetches release metadata with 7za extra asset included in fallback', async () => {
    const release = await fetchLatestRelease();
    expect(release.assets.length).toBeGreaterThan(0);
    const extra = release.assets.find(a => a.name.includes('extra.7z'));
    expect(extra).toBeDefined();
  });
});
