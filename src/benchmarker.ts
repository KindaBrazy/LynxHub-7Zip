import {getDefaultRunner} from './runner.js';
import {CommandCompiler} from './compiler.js';
import {ArchiveInspector} from './inspector.js';
import type {BenchmarkOptions, BenchmarkResult} from './types.js';

export const buildBenchmarkArgs = CommandCompiler.benchmark;

/**
 * Parses raw stdout text from `7z b` into a structured BenchmarkResult object.
 */
export function parseBenchmarkOutput(stdout: string, stderr: string, exitCode: number): BenchmarkResult {
  return ArchiveInspector.benchmark(stdout, stderr, exitCode);
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
