import path from 'path';
import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import type {CalculateHashOptions, CalculateHashResult, HashAlgorithm, HashItem} from './types.js';

export const buildCalculateHashArgs = CommandCompiler.calculateHash;

/**
 * Parses 7-Zip `h` stdout into structured HashItem[] and summary map.
 */
export function parseCalculateHashOutput(stdout: string): {
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
      // Format: [hash1, hash2, ..., size, namePart1, namePart2, ...]
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
 * Calculates hash checksums (CRC32, SHA256, etc.) for local files/directories using 7-Zip CLI.
 *
 * Supports flexible call signatures:
 * - `calculateHash('file.txt')`
 * - `calculateHash('file.txt', 'SHA256')`
 * - `calculateHash('file.txt', { hashType: 'CRC32', recursive: true })`
 * - `calculateHash(['file1.txt', 'file2.txt'], 'SHA256', { workingDir: './' })`
 *
 * @param targetPath Target file/directory path or array of paths.
 * @param hashTypeOrOptions Hash algorithm string OR configuration options object.
 * @param options Configuration parameters if algorithm string is passed as 2nd parameter.
 */
export async function calculateHash(
  targetPath: string | string[],
  hashTypeOrOptions?: HashAlgorithm | CalculateHashOptions,
  options?: CalculateHashOptions,
): Promise<CalculateHashResult> {
  if (!targetPath || (Array.isArray(targetPath) && targetPath.length === 0)) {
    throw new Error('Target path must be specified.');
  }

  let finalOptions: CalculateHashOptions | undefined;

  if (typeof hashTypeOrOptions === 'string') {
    finalOptions = {...options, hashType: hashTypeOrOptions};
  } else if (typeof hashTypeOrOptions === 'object' && hashTypeOrOptions !== null) {
    finalOptions = hashTypeOrOptions;
  } else {
    finalOptions = options;
  }

  const runner = finalOptions?.runner || getDefaultRunner();
  const args = buildCalculateHashArgs(targetPath, finalOptions);
  const result = await runner.exec(args, finalOptions);

  const {files, summary} = parseCalculateHashOutput(result.stdout);

  return {
    targetPath,
    files,
    summary,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
