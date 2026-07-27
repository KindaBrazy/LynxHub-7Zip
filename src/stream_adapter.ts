import type {ChildProcess} from 'child_process';
import {PassThrough, Readable} from 'stream';
import type {StreamDoneResult, StreamInput} from './types.js';
import type {StreamResult} from './runner.js';

export class StreamAdapter {
  /**
   * Normalizes polymorphic stream arguments (inputOrOptions, optionsArg).
   */
  static parseArgs<T extends object>(
    inputOrOptions?: StreamInput | T,
    optionsArg?: T,
  ): {input: StreamInput; options: T | undefined} {
    if (
      inputOrOptions &&
      typeof inputOrOptions === 'object' &&
      !Buffer.isBuffer(inputOrOptions) &&
      !(inputOrOptions instanceof Uint8Array) &&
      !(inputOrOptions instanceof Readable)
    ) {
      if (Array.isArray(inputOrOptions) && inputOrOptions.every(i => typeof i === 'string')) {
        return {input: inputOrOptions as string[], options: optionsArg};
      }
      return {input: undefined, options: inputOrOptions as T};
    }
    return {input: inputOrOptions as StreamInput, options: optionsArg};
  }

  /**
   * Adapts a child process and optional stream input into a unified StreamResult.
   * Manages stdio stream piping, backpressure, chunk collection, error propagation, and process termination.
   */
  static wrapProcess(childPromise: Promise<ChildProcess> | ChildProcess, input?: StreamInput): StreamResult {
    const inStream = new PassThrough();
    const outStream = new PassThrough() as StreamResult;

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    let resolvePromise: (res: StreamDoneResult) => void;
    let rejectPromise: (err: Error) => void;

    outStream.promise = new Promise<StreamDoneResult>((res, rej) => {
      resolvePromise = res;
      rejectPromise = rej;
    });

    outStream.stdin = inStream;
    // Suppress unhandled stream error crashes when caller relies solely on outStream.promise
    outStream.on('error', () => {});

    Promise.resolve(childPromise)
      .then(child => {
        outStream.process = child;

        if (child.stdin) {
          child.stdin.on('error', err => {
            if ((err as {code?: string}).code !== 'EPIPE') {
              outStream.destroy(err);
              rejectPromise(err);
            }
          });
          inStream.pipe(child.stdin);
        }

        if (child.stdout) {
          child.stdout.on('data', (chunk: Buffer | string) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            stdoutChunks.push(buf);
            outStream.push(buf);
          });
        }

        if (child.stderr) {
          child.stderr.on('data', (chunk: Buffer | string) => {
            stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
        }

        child.on('error', err => {
          outStream.destroy(err);
          rejectPromise(err);
        });

        child.on('close', code => {
          const exitCode = code ?? 0;
          const stdoutStr = Buffer.concat(stdoutChunks).toString();
          const stderrStr = Buffer.concat(stderrChunks).toString();

          outStream.push(null);

          if (exitCode > 1) {
            const errorMsg = `7-Zip stream command failed with exit code ${exitCode}:\n${stderrStr || stdoutStr}`;
            const err = new Error(errorMsg);
            outStream.destroy(err);
            rejectPromise(err);
          } else {
            resolvePromise({
              exitCode,
              stdout: stdoutStr,
              stderr: stderrStr,
            });
          }
        });

        if (input) {
          if (input instanceof Readable) {
            input.on('error', err => {
              inStream.destroy(err);
              outStream.destroy(err);
              rejectPromise(err);
            });
            input.pipe(inStream);
          } else if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
            inStream.write(input);
            inStream.end();
          }
        }
      })
      .catch(err => {
        outStream.destroy(err);
        rejectPromise(err);
      });

    return outStream;
  }
}
