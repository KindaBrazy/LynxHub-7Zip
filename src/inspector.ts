import path from 'path';
import {execFile} from 'child_process';
import {ensure7ZipExecutable} from './downloader.js';
import type {ArchiveItem, ListArchiveOptions, ListArchiveResult} from './types.js';

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
