import path from 'path';
import {getDefaultRunner} from '../core/runner.js';
import {CommandCompiler} from '../core/compiler.js';
import type {
  ArchiveItem,
  BenchmarkMetric,
  BenchmarkResult,
  GetSupportedFeaturesOptions,
  HashItem,
  ListArchiveOptions,
  ListArchiveResult,
  SupportedCodecInfo,
  SupportedFeaturesResult,
  SupportedFormatInfo,
  SupportedHasherInfo,
} from '../types/index.js';

export const buildListArchiveArgs = CommandCompiler.listArchive;

/**
 * Encapsulates all 7-Zip text stdout parsing state machines and pure parsing functions.
 */
export class ArchiveInspector {
  /**
   * Parses 7-Zip `l -slt` stdout into structured items and raw archive metadata.
   */
  static listArchive(stdout: string): {
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
   * Parses `7z i` stdout into structured formats, codecs, hashers, and version metadata.
   */
  static supportedFeatures(stdout: string): {
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
   * Parses 7-Zip `h` stdout into structured HashItem[] and summary map.
   */
  static calculateHash(stdout: string): {
    files: HashItem[];
    summary: Record<string, string>;
  } {
    const files: HashItem[] = [];
    const summary: Record<string, string> = {};

    const lines = stdout.split(/\r?\n/);

    // Parse explicit summary lines like "CRC32 for data: 12345678"
    for (const line of lines) {
      const dataMatch = line.match(/^([A-Z0-9_*]+)\s+for data:\s+([A-Fa-f0-9]+)/i);
      if (dataMatch) {
        summary[dataMatch[1].toUpperCase()] = dataMatch[2].toUpperCase();
      }
    }

    // Find table header and dashed line index
    let headerIndex = -1;
    let dashIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.includes('Size') && (trimmed.endsWith('Name') || trimmed.includes('Name'))) {
        headerIndex = i;
      } else if (headerIndex !== -1 && lines[i].includes('---')) {
        dashIndex = i;
        break;
      }
    }

    if (headerIndex !== -1 && dashIndex !== -1) {
      const headerLine = lines[headerIndex];

      // Identify active hash column names from header
      const knownHashes = ['CRC32', 'CRC64', 'SHA1', 'SHA256', 'BLAKE2SP'];
      const hashColumns: {name: string; start: number}[] = [];

      for (const hName of knownHashes) {
        const idx = headerLine.indexOf(hName);
        if (idx !== -1) {
          hashColumns.push({name: hName, start: idx});
        }
      }
      hashColumns.sort((a, b) => a.start - b.start);

      // Default to generic hash column if none match known list
      const columnNames = hashColumns.map(h => h.name);
      if (columnNames.length === 0) {
        const headerTokens = headerLine.trim().split(/\s+/);
        const firstCol = headerTokens[0] || 'HASH';
        columnNames.push(firstCol.toUpperCase());
      }

      const expectedHashCount = columnNames.length;

      // Parse data rows between first dash separator and second dash separator (or end)
      for (let i = dashIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes('---')) {
          break;
        }

        if (!line) continue;

        const tokens = line.split(/\s+/);
        if (tokens.length < expectedHashCount) continue;

        // Check if second-to-last or middle token is numeric size
        let sizeIdx = expectedHashCount;
        if (tokens.length > expectedHashCount && !isNaN(Number(tokens[expectedHashCount]))) {
          sizeIdx = expectedHashCount;
        }

        const hashes: Record<string, string> = {};
        for (let c = 0; c < expectedHashCount; c++) {
          hashes[columnNames[c]] = tokens[c].toUpperCase();
        }

        const sizeStr = tokens[sizeIdx];
        const size = sizeStr !== undefined && !isNaN(Number(sizeStr)) ? Number(sizeStr) : undefined;
        const name = tokens.slice(sizeIdx + 1).join(' ');

        if (name) {
          files.push({
            path: name,
            size,
            hashes,
          });

          // Store first file's hash into summary fallback if summary is empty
          for (const [k, v] of Object.entries(hashes)) {
            if (!summary[k]) {
              summary[k] = v;
            }
          }
        } else {
          // Summary row for total data (empty filename)
          for (const [k, v] of Object.entries(hashes)) {
            summary[k] = v;
          }
        }
      }
    }

    return {files, summary};
  }

  /**
   * Parses 7-Zip `t` stdout and exit code to determine archive health and metadata.
   */
  static testArchive(
    stdout: string,
    _stderr?: string,
    exitCode: number = 0,
  ): {
    valid: boolean;
    testedFilesCount?: number;
    testedFoldersCount?: number;
    totalSize?: number;
  } {
    const isValid = exitCode === 0 && /Everything is O[kK]/i.test(stdout);

    let testedFilesCount: number | undefined;
    let testedFoldersCount: number | undefined;
    let totalSize: number | undefined;

    const filesMatch = stdout.match(/^Files:\s*(\d+)/m);
    if (filesMatch) {
      testedFilesCount = parseInt(filesMatch[1], 10);
    }

    const foldersMatch = stdout.match(/^Folders:\s*(\d+)/m);
    if (foldersMatch) {
      testedFoldersCount = parseInt(foldersMatch[1], 10);
    }

    const sizeMatch = stdout.match(/^Size:\s*(\d+)/m);
    if (sizeMatch) {
      totalSize = parseInt(sizeMatch[1], 10);
    }

    return {
      valid: isValid,
      testedFilesCount,
      testedFoldersCount,
      totalSize,
    };
  }

  /**
   * Parses raw stdout text from `7z b` into a structured BenchmarkResult object.
   */
  static benchmark(stdout: string, stderr: string = '', exitCode: number = 0): BenchmarkResult {
    const rawInfo: Record<string, string> = {};
    const lines = stdout.split(/\r?\n/);

    let ramSize: number | undefined;
    let cpuThreads: number | undefined;
    let ramUsage: number | undefined;

    let compressing: BenchmarkMetric | undefined;
    let decompressing: BenchmarkMetric | undefined;
    let total: BenchmarkMetric | undefined;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('RAM size:')) {
        const ramMatch = trimmed.match(/RAM size:\s*(\d+)\s*MB/i);
        if (ramMatch) {
          ramSize = parseInt(ramMatch[1], 10);
        }
        const cpuMatch = trimmed.match(/(?:CPU threads|CPU hardware threads):\s*(\d+)/i);
        if (cpuMatch) {
          cpuThreads = parseInt(cpuMatch[1], 10);
        }
      }

      if (trimmed.includes('RAM usage:')) {
        const usageMatch = trimmed.match(/RAM usage:\s*(\d+)\s*MB/i);
        if (usageMatch) {
          ramUsage = parseInt(usageMatch[1], 10);
        }
        if (cpuThreads === undefined) {
          const cpuMatch = trimmed.match(/(?:CPU threads|Benchmark threads):\s*(\d+)/i);
          if (cpuMatch) {
            cpuThreads = parseInt(cpuMatch[1], 10);
          }
        }
      }

      if (trimmed.includes(':') && !trimmed.startsWith('Speed') && !trimmed.startsWith('Dict')) {
        const colonIdx = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIdx).trim();
        const val = trimmed.slice(colonIdx + 1).trim();
        if (key && val && !rawInfo[key]) {
          rawInfo[key] = val;
        }
      }
    }

    const compressingBlockMatch = stdout.match(/Compressing\s*\r?\n\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    if (compressingBlockMatch) {
      compressing = {
        speedKiBs: parseInt(compressingBlockMatch[1], 10),
        usagePercent: parseInt(compressingBlockMatch[2], 10),
        ratingMips: parseInt(compressingBlockMatch[3], 10),
        ratingMipsAvg: parseInt(compressingBlockMatch[4], 10),
      };
    }

    const decompressingBlockMatch = stdout.match(/Decompressing\s*\r?\n\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    if (decompressingBlockMatch) {
      decompressing = {
        speedKiBs: parseInt(decompressingBlockMatch[1], 10),
        usagePercent: parseInt(decompressingBlockMatch[2], 10),
        ratingMips: parseInt(decompressingBlockMatch[3], 10),
        ratingMipsAvg: parseInt(decompressingBlockMatch[4], 10),
      };
    }

    const totBlockMatch = stdout.match(/Tot:\s*(\d+)\s+(\d+)\s+(\d+)/i);
    if (totBlockMatch) {
      total = {
        usagePercent: parseInt(totBlockMatch[1], 10),
        ratingMips: parseInt(totBlockMatch[2], 10),
        ratingMipsAvg: parseInt(totBlockMatch[3], 10),
      };
    }

    const avrLineMatch = stdout.match(/Avr:\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\|\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/i);
    if (avrLineMatch) {
      compressing = {
        speedKiBs: parseInt(avrLineMatch[1], 10),
        usagePercent: parseInt(avrLineMatch[2], 10),
        ratingMips: parseInt(avrLineMatch[3], 10),
        ratingMipsAvg: parseInt(avrLineMatch[4], 10),
      };
      decompressing = {
        speedKiBs: parseInt(avrLineMatch[5], 10),
        usagePercent: parseInt(avrLineMatch[6], 10),
        ratingMips: parseInt(avrLineMatch[7], 10),
        ratingMipsAvg: parseInt(avrLineMatch[8], 10),
      };
    }

    const totTabularMatch = stdout.match(/Tot:\s*(\d+)\s+(\d+)\s+(\d+)/i);
    if (totTabularMatch && !total) {
      total = {
        usagePercent: parseInt(totTabularMatch[1], 10),
        ratingMips: parseInt(totTabularMatch[2], 10),
        ratingMipsAvg: parseInt(totTabularMatch[3], 10),
      };
    }

    return {
      ramSize,
      cpuThreads,
      ramUsage,
      compressing,
      decompressing,
      total,
      rawInfo,
      stdout,
      stderr,
      exitCode,
    };
  }
}

/**
 * Parses 7-Zip `l -slt` stdout into structured items and raw archive metadata.
 */
export function parseListArchiveOutput(stdout: string): {
  items: ArchiveItem[];
  rawInfo: Record<string, string>;
} {
  return ArchiveInspector.listArchive(stdout);
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
  const runner = options?.runner || getDefaultRunner();
  const resolvedArchivePath = path.resolve(workingDirectory, archivePath);
  const args = buildListArchiveArgs(archivePath, options);
  const result = await runner.exec(args, options);

  const {items, rawInfo} = ArchiveInspector.listArchive(result.stdout);

  return {
    archivePath: resolvedArchivePath,
    items,
    rawInfo,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

export const buildGetSupportedFeaturesArgs = CommandCompiler.getSupportedFeatures;

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
  return ArchiveInspector.supportedFeatures(stdout);
}

/**
 * Inspects installed codecs, formats, and binary features supported by the 7-Zip executable (`7z i`).
 *
 * @param options Configuration options.
 */
export async function getSupportedFeatures(options?: GetSupportedFeaturesOptions): Promise<SupportedFeaturesResult> {
  const runner = options?.runner || getDefaultRunner();
  const args = buildGetSupportedFeaturesArgs(options);
  const result = await runner.exec(args, options);
  const parsed = ArchiveInspector.supportedFeatures(result.stdout);

  return {
    ...parsed,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
