import type {ISevenZipRunner} from '../core/runner.js';
import type {DownloadOptions} from './common.js';

export interface BenchmarkOptions {
  /**
   * Number of benchmark iterations/passes (e.g. 1, 2, 5).
   */
  iterations?: number;

  /**
   * Dictionary size for benchmark (e.g. '22', '24', '16m', '64m').
   */
  dictionarySize?: string;

  /**
   * Number of CPU threads to use for benchmarking (e.g. 2, 4, 'on', 'off').
   */
  threads?: number | string;

  /**
   * Compression method to benchmark (e.g. 'LZMA', 'LZMA2', '*').
   */
  method?: string;

  /**
   * Working directory for process execution.
   */
  workingDir?: string;

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

  /**
   * Custom runner instance for executing 7-Zip CLI commands.
   */
  runner?: ISevenZipRunner;
}

export interface BenchmarkMetric {
  /**
   * Speed in KiB/s.
   */
  speedKiBs?: number;

  /**
   * CPU usage percentage (e.g. 382).
   */
  usagePercent?: number;

  /**
   * Rating in MIPS (Million Instructions Per Second) per CPU usage (R/U).
   */
  ratingMips?: number;

  /**
   * Rating in MIPS average.
   */
  ratingMipsAvg?: number;

  /**
   * Overall / average rating in MIPS.
   */
  overallRatingMips?: number;
}

export interface BenchmarkResult {
  ramSize?: number;
  cpuThreads?: number;
  ramUsage?: number;

  /**
   * Compressing benchmark metrics (if parsed from output).
   */
  compressing?: BenchmarkMetric;

  /**
   * Decompressing benchmark metrics (if parsed from output).
   */
  decompressing?: BenchmarkMetric;

  /**
   * Total benchmark metrics.
   */
  total?: BenchmarkMetric;

  /**
   * Total average rating MIPS across all steps.
   */
  totalRatingMips?: number;

  /**
   * Raw key-value info map parsed from output.
   */
  rawInfo?: Record<string, string>;

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
