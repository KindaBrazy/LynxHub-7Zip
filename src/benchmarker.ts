import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import type {BenchmarkMetric, BenchmarkOptions, BenchmarkResult} from './types.js';

export const buildBenchmarkArgs = CommandCompiler.benchmark;

/**
 * Parses raw stdout text from `7z b` into a structured BenchmarkResult object.
 */
export function parseBenchmarkOutput(stdout: string, stderr: string, exitCode: number): BenchmarkResult {
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

    // RAM size / CPU threads line: e.g. "RAM size: 32490 MB, CPU threads: 16" or "RAM size:    4095 MB,  # CPU hardware threads:   6"
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

    // RAM usage line: e.g. "RAM usage: 441 MB, CPU threads: 16" or "RAM usage:   1334 MB"
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

    // Single-line block metrics: "Compressing", "Decompressing", "Tot:" in vertical layout format
    if (trimmed.startsWith('Compressing')) {
      // Look at next lines for metric numbers if formatted vertically
    }

    // Header info key-values
    if (trimmed.includes(':') && !trimmed.startsWith('Speed') && !trimmed.startsWith('Dict')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const val = trimmed.slice(colonIdx + 1).trim();
      if (key && val && !rawInfo[key]) {
        rawInfo[key] = val;
      }
    }
  }

  // Parse metrics table (supports both vertical block format and tabular multi-column format)
  // Format 1 (Vertical block format):
  // Compressing
  //   62391       1363   4307   4307
  // Decompressing
  //  777273       1536   4779   4779
  // Tot:          1449   4543   4543

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

  // Format 2 (Tabular multi-column format with Avr: / Tot: lines):
  // Avr:     17628   377   4880  18365  |     160062   386   3619  13939
  // Tot:             382   4250  16152
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

/**
 * Runs 7-Zip CPU and RAM compression performance benchmark (`7z b`).
 *
 * @param options Optional configuration parameters for benchmark.
 */
export async function runBenchmark(options?: BenchmarkOptions): Promise<BenchmarkResult> {
  const runner = options?.runner || getDefaultRunner();
  const args = buildBenchmarkArgs(options);
  const result = await runner.exec(args, options);
  return parseBenchmarkOutput(result.stdout, result.stderr, result.exitCode);
}
