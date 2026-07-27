import path from 'path';
import {execFile} from 'child_process';
import {ensure7ZipExecutable} from './downloader.js';
import type {
  ArchiveItem,
  GetSupportedFeaturesOptions,
  ListArchiveOptions,
  ListArchiveResult,
  SupportedCodecInfo,
  SupportedFeaturesResult,
  SupportedFormatInfo,
  SupportedHasherInfo,
} from './types.js';

/**
 * Constructs command line argument array for 7-Zip `l` (list) command.
 */
export function buildListArchiveArgs(archivePath: string, options?: ListArchiveOptions): string[] {
  const args: string[] = ['l'];

  // Detailed technical list mode -slt (default: true)
  const useSlt = options?.slt ?? options?.technical ?? true;
  if (useSlt) {
    args.push('-slt');
  }

  // Format override -t
  if (options?.format) {
    args.push(`-t${options.format}`);
  }

  // Password -p
  if (options?.password !== undefined) {
    args.push(`-p${options.password}`);
  }

  // Non-interactive switch
  args.push('-y');

  // Recurse subdirectories -r
  if (options?.recursive === false) {
    args.push('-r-');
  } else {
    args.push('-r');
  }

  // Include file patterns -ir!
  if (options?.include) {
    const includes = Array.isArray(options.include) ? options.include : [options.include];
    for (const pattern of includes) {
      args.push(`-ir!${pattern}`);
    }
  }

  // Exclude file patterns -xr!
  if (options?.exclude) {
    const excludes = Array.isArray(options.exclude) ? options.exclude : [options.exclude];
    for (const pattern of excludes) {
      args.push(`-xr!${pattern}`);
    }
  }

  // Custom user CLI flags
  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  // Positional parameter: archive file path
  args.push(archivePath);

  return args;
}

/**
 * Parses 7-Zip `l -slt` stdout into structured items and raw archive metadata.
 */
export function parseListArchiveOutput(stdout: string): {
  items: ArchiveItem[];
  rawInfo: Record<string, string>;
} {
  const items: ArchiveItem[] = [];
  const rawInfo: Record<string, string> = {};

  const lines = stdout.split(/\r?\n/);
  let state: 'header' | 'archive_info' | 'items' = 'header';

  let currentBlock: Record<string, string> | null = null;

  const flushBlock = () => {
    if (!currentBlock || Object.keys(currentBlock).length === 0) return;

    if (currentBlock['Path']) {
      const isFolder =
        currentBlock['Folder'] === '+' ||
        (currentBlock['Attributes'] ? currentBlock['Attributes'].includes('D') : false);

      const item: ArchiveItem = {
        path: currentBlock['Path'],
        size: currentBlock['Size'] !== undefined ? Number(currentBlock['Size']) : undefined,
        packedSize: currentBlock['Packed Size'] !== undefined ? Number(currentBlock['Packed Size']) : undefined,
        modified: currentBlock['Modified'],
        created: currentBlock['Created'],
        accessed: currentBlock['Accessed'],
        attributes: currentBlock['Attributes'],
        encrypted: currentBlock['Encrypted'] === '+',
        crc: currentBlock['CRC'],
        method: currentBlock['Method'],
        block: currentBlock['Block'] !== undefined ? Number(currentBlock['Block']) : undefined,
        comment: currentBlock['Comment'],
        hostOS: currentBlock['Host OS'],
        characteristics: currentBlock['Characteristics'],
        isDir: isFolder,
        raw: {...currentBlock},
      };

      items.push(item);
    }
    currentBlock = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    if (line === '--') {
      state = 'archive_info';
      continue;
    }

    if (line.startsWith('----------')) {
      state = 'items';
      continue;
    }

    if (state === 'archive_info') {
      const eqIndex = line.indexOf(' = ');
      if (eqIndex !== -1) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 3).trim();
        rawInfo[key] = value;
      }
    } else if (state === 'items') {
      const eqIndex = line.indexOf(' = ');
      if (eqIndex !== -1) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 3).trim();

        if (key === 'Path') {
          flushBlock();
          currentBlock = {};
        }

        if (currentBlock) {
          currentBlock[key] = value;
        }
      } else if (line.trim() === '' && currentBlock) {
        flushBlock();
      }
    }
  }

  flushBlock();

  return {items, rawInfo};
}

/**
 * Inspects an archive file using 7-Zip CLI and returns its folder/file metadata without extracting.
 *
 * @param archivePath Path to the input archive file.
 * @param options Configuration options for archive listing.
 */
export async function listArchive(archivePath: string, options?: ListArchiveOptions): Promise<ListArchiveResult> {
  if (!archivePath || archivePath.trim() === '') {
    throw new Error('Archive path must be specified.');
  }

  const workingDirectory = options?.workingDir || process.cwd();
  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildListArchiveArgs(archivePath, options);

  return new Promise((resolve, reject) => {
    execFile(
      execPath,
      args,
      {
        cwd: workingDirectory,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdoutStr, stderrStr) => {
        const stdout = stdoutStr.toString();
        const stderr = stderrStr.toString();
        const exitCode = error && typeof error.code === 'number' ? error.code : 0;

        if (error && exitCode > 1) {
          return reject(
            new Error(`7-Zip list command failed with exit code ${exitCode}:\n${stderr || stdout || error.message}`),
          );
        }

        const {items, rawInfo} = parseListArchiveOutput(stdout);

        resolve({
          archivePath: resolvedArchivePath,
          items,
          rawInfo,
          stdout,
          stderr,
          exitCode,
        });
      },
    );
  });
}

/**
 * Constructs CLI arguments for `7z i` (information/features command).
 */
export function buildGetSupportedFeaturesArgs(options?: GetSupportedFeaturesOptions): string[] {
  const args: string[] = ['i'];

  if (options?.customArgs && options.customArgs.length > 0) {
    args.push(...options.customArgs);
  }

  return args;
}

/**
 * Parses `7z i` stdout into structured formats, codecs, hashers, and version metadata.
 */
export function parseGetSupportedFeaturesOutput(stdout: string): {
  version?: string;
  formats: SupportedFormatInfo[];
  codecs: SupportedCodecInfo[];
  hashers: SupportedHasherInfo[];
  rawInfo: Record<string, string>;
} {
  const formats: SupportedFormatInfo[] = [];
  const codecs: SupportedCodecInfo[] = [];
  const hashers: SupportedHasherInfo[] = [];
  const rawInfo: Record<string, string> = {};

  const lines = stdout.split(/\r?\n/);
  let version: string | undefined;

  let currentSection: 'none' | 'formats' | 'codecs' | 'hashers' = 'none';

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Version banner line
    if (!version && line.includes('7-Zip')) {
      const match = line.match(/7-Zip\s*(\(r\))?\s*([\d\.]+(?:\s*\([^)]+\))?)/i);
      if (match) {
        version = match[2];
      } else {
        version = line.trim();
      }
    }

    if (line.trim() === 'Formats:') {
      currentSection = 'formats';
      continue;
    }

    if (line.trim() === 'Codecs:') {
      currentSection = 'codecs';
      continue;
    }

    if (line.trim() === 'Hashers:') {
      currentSection = 'hashers';
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (currentSection === 'formats') {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const flags = parts[0];
        const name = parts[1];
        const extensions: string[] = [];
        let signature: string | undefined;

        if (parts.length > 2) {
          const rest = parts.slice(2);
          const extParts: string[] = [];
          const sigParts: string[] = [];

          let parsingSig = false;
          for (const item of rest) {
            if (!parsingSig && (item.length <= 4 || item.startsWith('(') || item.endsWith(')'))) {
              extParts.push(item.replace(/[()]/g, ''));
            } else {
              parsingSig = true;
              sigParts.push(item);
            }
          }

          if (extParts.length > 0) {
            extensions.push(...extParts);
          }
          if (sigParts.length > 0) {
            signature = sigParts.join(' ');
          }
        }

        formats.push({
          name,
          flags,
          extensions,
          signature,
          raw: line,
        });
      }
    } else if (currentSection === 'codecs') {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const flags = parts.length >= 3 ? parts[0] : undefined;
        const id = parts.length >= 3 ? parts[1] : parts[0];
        const name = parts.length >= 3 ? parts.slice(2).join(' ') : parts[1];

        codecs.push({
          name,
          id,
          flags,
          raw: line,
        });
      }
    } else if (currentSection === 'hashers') {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const size = parts.length >= 3 ? parts[0] : undefined;
        const id = parts.length >= 3 ? parts[1] : parts[0];
        const name = parts.length >= 3 ? parts.slice(2).join(' ') : parts[1];

        hashers.push({
          name,
          id,
          size,
          raw: line,
        });
      }
    }
  }

  rawInfo['formatsCount'] = String(formats.length);
  rawInfo['codecsCount'] = String(codecs.length);
  rawInfo['hashersCount'] = String(hashers.length);
  if (version) {
    rawInfo['version'] = version;
  }

  return {
    version,
    formats,
    codecs,
    hashers,
    rawInfo,
  };
}

/**
 * Inspects installed codecs, formats, and binary features supported by the 7-Zip executable (`7z i`).
 *
 * @param options Configuration options.
 */
export async function getSupportedFeatures(options?: GetSupportedFeaturesOptions): Promise<SupportedFeaturesResult> {
  const workingDirectory = options?.workingDir || process.cwd();
  const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
  const args = buildGetSupportedFeaturesArgs(options);

  return new Promise((resolve, reject) => {
    execFile(
      execPath,
      args,
      {
        cwd: workingDirectory,
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdoutStr, stderrStr) => {
        const stdout = stdoutStr.toString();
        const stderr = stderrStr.toString();
        const exitCode = error && typeof error.code === 'number' ? error.code : 0;

        if (error && exitCode > 1) {
          const msg = stderr || stdout || error.message;
          return reject(new Error(`7-Zip getSupportedFeatures (7z i) failed with exit code ${exitCode}:\n${msg}`));
        }

        const parsed = parseGetSupportedFeaturesOutput(stdout);

        resolve({
          ...parsed,
          stdout,
          stderr,
          exitCode,
        });
      },
    );
  });
}
