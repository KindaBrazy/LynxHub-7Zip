import {execFile, spawn, type ChildProcess} from 'child_process';
import {PassThrough} from 'stream';
import {ensure7ZipExecutable} from './downloader.js';
import {StreamAdapter} from './stream_adapter.js';
import type {DownloadOptions, StreamDoneResult, StreamInput} from '../types/index.js';

export interface ExecOptions {
  /**
   * Path to custom 7-Zip executable. If omitted, resolved via downloader.
   */
  executablePath?: string;

  /**
   * Options for downloading 7-Zip binary if executablePath is omitted.
   */
  downloadOptions?: DownloadOptions;

  /**
   * Working directory for process execution.
   */
  workingDir?: string;

  /**
   * Maximum buffer size in bytes for stdout/stderr (default: 10 * 1024 * 1024).
   */
  maxBuffer?: number;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface StreamResult extends PassThrough {
  stdin: import('stream').Writable;
  process: ChildProcess;
  promise: Promise<StreamDoneResult>;
}

export interface ISevenZipRunner {
  /**
   * Executes a 7-Zip CLI command using execFile and returns output result.
   */
  exec(args: string[], options?: ExecOptions): Promise<ExecResult>;

  /**
   * Executes a 7-Zip CLI command using child_process spawn for stream processing.
   */
  stream(args: string[], input?: StreamInput, options?: ExecOptions): StreamResult;
}

/**
 * Default production implementation of 7-Zip runner backed by Node child_process.
 */
export class DefaultSevenZipRunner implements ISevenZipRunner {
  async exec(args: string[], options?: ExecOptions): Promise<ExecResult> {
    const workingDir = options?.workingDir || process.cwd();
    const execPath = options?.executablePath || (await ensure7ZipExecutable(options?.downloadOptions));
    const maxBuffer = options?.maxBuffer || 10 * 1024 * 1024;

    return new Promise((resolve, reject) => {
      execFile(
        execPath,
        args,
        {
          cwd: workingDir,
          maxBuffer,
        },
        (error, stdoutStr, stderrStr) => {
          const stdout = stdoutStr.toString();
          const stderr = stderrStr.toString();
          const exitCode = error && typeof error.code === 'number' ? error.code : 0;

          if (error && exitCode > 1) {
            const msg = stderr || stdout || error.message;
            return reject(new Error(`7-Zip command failed with exit code ${exitCode}:\n${msg}`));
          }

          resolve({
            stdout,
            stderr,
            exitCode,
          });
        },
      );
    });
  }

  stream(args: string[], input?: StreamInput, options?: ExecOptions): StreamResult {
    const workingDir = options?.workingDir || process.cwd();

    const childPromise = (
      options?.executablePath ? Promise.resolve(options.executablePath) : ensure7ZipExecutable(options?.downloadOptions)
    ).then(execPath =>
      spawn(execPath, args, {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      }),
    );

    return StreamAdapter.wrapProcess(childPromise, input);
  }
}

/**
 * Mock implementation of 7-Zip runner for binary-free testing.
 */
export class MockSevenZipRunner implements ISevenZipRunner {
  public executedCommands: {args: string[]; options?: ExecOptions}[] = [];
  public mockExecResult: ExecResult = {
    stdout: '7-Zip 26.02 (x64) : Copyright (c) 1999-2026 Igor Pavlov',
    stderr: '',
    exitCode: 0,
  };
  public mockStreamResult?: StreamDoneResult;

  async exec(args: string[], options?: ExecOptions): Promise<ExecResult> {
    this.executedCommands.push({args, options});
    return this.mockExecResult;
  }

  stream(args: string[], _input?: StreamInput, options?: ExecOptions): StreamResult {
    this.executedCommands.push({args, options});
    const outStream = new PassThrough() as StreamResult;
    outStream.stdin = new PassThrough();
    outStream.process = {} as ChildProcess;
    outStream.promise = Promise.resolve(
      this.mockStreamResult || {
        exitCode: 0,
        stdout: this.mockExecResult.stdout,
        stderr: this.mockExecResult.stderr,
      },
    );
    setImmediate(() => {
      outStream.push(null);
    });
    return outStream;
  }
}

let activeRunner: ISevenZipRunner = new DefaultSevenZipRunner();

export function getDefaultRunner(): ISevenZipRunner {
  return activeRunner;
}

export function setDefaultRunner(runner: ISevenZipRunner): void {
  activeRunner = runner;
}
