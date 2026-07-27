import {describe, expect, it} from 'vitest';
import {Readable} from 'stream';
import {EventEmitter} from 'events';
import type {ChildProcess} from 'child_process';
import {StreamAdapter} from '../index.js';

describe('StreamAdapter', () => {
  describe('parseArgs', () => {
    it('should correctly parse StreamInput when input is a Readable stream', () => {
      const mockStream = new Readable();
      const options = {format: 'xz' as const};
      const result = StreamAdapter.parseArgs(mockStream, options);

      expect(result.input).toBe(mockStream);
      expect(result.options).toBe(options);
    });

    it('should correctly parse StreamInput when input is a Buffer', () => {
      const buf = Buffer.from('hello world');
      const options = {format: 'zip' as const};
      const result = StreamAdapter.parseArgs(buf, options);

      expect(result.input).toBe(buf);
      expect(result.options).toBe(options);
    });

    it('should correctly parse StreamInput when input is a Uint8Array', () => {
      const arr = new Uint8Array([1, 2, 3]);
      const options = {format: '7z' as const};
      const result = StreamAdapter.parseArgs(arr, options);

      expect(result.input).toBe(arr);
      expect(result.options).toBe(options);
    });

    it('should parse options when options is passed as 1st argument', () => {
      const options = {format: 'gzip' as const};
      const result = StreamAdapter.parseArgs(options);

      expect(result.input).toBeUndefined();
      expect(result.options).toBe(options);
    });

    it('should parse file path array as input when 1st argument is string array', () => {
      const files = ['file1.txt', 'file2.txt'];
      const options = {format: 'zip' as const};
      const result = StreamAdapter.parseArgs(files, options);

      expect(result.input).toEqual(files);
      expect(result.options).toBe(options);
    });
  });

  describe('wrapProcess', () => {
    it('should return a StreamResult attached with stdin and promise', async () => {
      const fakeChild = new EventEmitter() as unknown as ChildProcess;
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const stdin = new EventEmitter();
      fakeChild.stdin = stdin as any;
      fakeChild.stdout = stdout as any;
      fakeChild.stderr = stderr as any;

      const streamResult = StreamAdapter.wrapProcess(Promise.resolve(fakeChild));

      expect(streamResult.stdin).toBeDefined();
      expect(streamResult.promise).toBeDefined();

      setImmediate(() => {
        stdout.emit('data', Buffer.from('output chunk'));
        fakeChild.emit('close', 0);
      });

      const res = await streamResult.promise;
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toBe('output chunk');
    });

    it('should handle process failure exit code > 1', async () => {
      const fakeChild = new EventEmitter() as unknown as ChildProcess;
      const stdout = new EventEmitter();
      const stderr = new EventEmitter();
      const stdin = new EventEmitter();
      fakeChild.stdin = stdin as any;
      fakeChild.stdout = stdout as any;
      fakeChild.stderr = stderr as any;

      const streamResult = StreamAdapter.wrapProcess(fakeChild);

      setImmediate(() => {
        stderr.emit('data', Buffer.from('fatal error'));
        fakeChild.emit('close', 2);
      });

      await expect(streamResult.promise).rejects.toThrow('7-Zip stream command failed with exit code 2');
    });
  });
});
