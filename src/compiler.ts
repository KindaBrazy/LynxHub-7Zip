import type {
  ArchiveFormat,
  BenchmarkOptions,
  CalculateHashOptions,
  CompressOptions,
  CompressStreamOptions,
  CompressionLevel,
  DecompressOptions,
  DecompressStreamOptions,
  DeleteFromArchiveOptions,
  GetSupportedFeaturesOptions,
  ListArchiveOptions,
  RenameInArchiveOptions,
  RenamePair,
  TestArchiveOptions,
  UpdateArchiveOptions,
} from './types.js';

function normalizeTargets(targets?: string | string[]): string[] {
  if (!targets) return [];
  return Array.isArray(targets) ? targets : [targets];
}

function normalizeRenamePairs(renames: RenamePair | RenamePair[]): Array<{from: string; to: string}> {
  if (Array.isArray(renames)) {
    if (renames.length === 2 && typeof renames[0] === 'string' && typeof renames[1] === 'string') {
      return [{from: renames[0], to: renames[1]}];
    }
    return (renames as RenamePair[]).map(pair => {
      if (Array.isArray(pair)) {
        return {from: pair[0], to: pair[1]};
      }
      return {from: pair.from, to: pair.to};
    });
  }
  return [{from: renames.from, to: renames.to}];
}

/**
 * Central compiler for 7-Zip CLI command-line arguments.
 * Consolidates all option flags, defaults, format inference, and argument construction.
 */
export class CommandCompiler {
  /**
   * Infers target archive format from target output file extension.
   * Defaults to '7z' if extension is unrecognized or missing.
   */
  static inferFormatFromExtension(outputArchive: string): ArchiveFormat {
    const cleanPath = outputArchive.toLowerCase();
    if (cleanPath.endsWith('.tar.gz') || cleanPath.endsWith('.tgz') || cleanPath.endsWith('.gz')) {
      return 'gzip';
    }
    if (cleanPath.endsWith('.tar.bz2') || cleanPath.endsWith('.tbz2') || cleanPath.endsWith('.bz2')) {
      return 'bzip2';
    }
    if (cleanPath.endsWith('.tar.xz') || cleanPath.endsWith('.txz') || cleanPath.endsWith('.xz')) {
      return 'xz';
    }
    if (cleanPath.endsWith('.zip')) {
      return 'zip';
    }
    if (cleanPath.endsWith('.tar')) {
      return 'tar';
    }
    if (cleanPath.endsWith('.wim')) {
      return 'wim';
    }
    if (cleanPath.endsWith('.7z')) {
      return '7z';
    }
    return '7z';
  }

  /**
   * Converts CompressionLevel input into 7-Zip -mx argument string switch value.
   */
  static mapCompressionLevel(level?: CompressionLevel): string | undefined {
    if (level === undefined) return undefined;
    if (typeof level === 'number') {
      return `-mx=${Math.max(0, Math.min(9, Math.floor(level)))}`;
    }

    const levelStr = level.toString().toLowerCase();
    switch (levelStr) {
      case 'store':
      case '0':
        return '-mx=0';
      case 'fastest':
      case '1':
        return '-mx=1';
      case 'fast':
      case '3':
        return '-mx=3';
      case 'normal':
      case '5':
        return '-mx=5';
      case 'maximum':
      case '7':
        return '-mx=7';
      case 'ultra':
      case '9':
        return '-mx=9';
      default:
        if (!isNaN(Number(levelStr))) {
          return `-mx=${levelStr}`;
        }
        return undefined;
    }
  }

  /**
   * Constructs CLI arguments for 7-Zip compression (`7z a`).
   */
  static compress(input: string | string[], outputArchive: string, options?: CompressOptions): string[] {
    const args: string[] = ['a'];

    const format = options?.format || options?.archiveFormat || CommandCompiler.inferFormatFromExtension(outputArchive);
    if (format) {
      args.push(`-t${format}`);
    }

    const levelFlag = CommandCompiler.mapCompressionLevel(options?.level ?? options?.compressionLevel);
    if (levelFlag) {
      args.push(levelFlag);
    }

    if (options?.method) {
      args.push(`-m0=${options.method}`);
    }

    if (options?.dictionarySize) {
      args.push(`-md=${options.dictionarySize}`);
    }

    if (options?.solid !== undefined) {
      args.push(`-ms=${options.solid ? 'on' : 'off'}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    if (options?.encryptHeader !== undefined) {
      args.push(`-mhe=${options.encryptHeader ? 'on' : 'off'}`);
    }

    if (options?.volumeSize) {
      args.push(`-v${options.volumeSize}`);
    }

    if (options?.overwriteMode) {
      switch (options.overwriteMode) {
        case 'overwrite':
          args.push('-aoa');
          break;
        case 'skip':
          args.push('-aos');
          break;
        case 'renameExisting':
          args.push('-aou');
          break;
        case 'autoRenameNew':
          args.push('-aot');
          break;
      }
    }

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.deleteSource) {
      args.push('-sdel');
    }

    if (options?.threads !== undefined) {
      args.push(`-mmt=${options.threads}`);
    }

    if (options?.sfx !== undefined && options?.sfx !== false) {
      if (typeof options.sfx === 'string' && options.sfx.trim() !== '') {
        args.push(`-sfx${options.sfx}`);
      } else {
        args.push('-sfx');
      }
    }

    args.push('-y');

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(outputArchive);

    const inputList = normalizeTargets(input);
    args.push(...inputList);

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip stream compression (`7z a -so`).
   */
  static compressStream(
    options?: CompressStreamOptions,
    isStreamInput: boolean = true,
    fileInputs?: string[],
  ): string[] {
    const args: string[] = ['a'];

    const format = options?.format || 'xz';
    args.push(`-t${format}`);
    args.push('-so');

    if (isStreamInput) {
      if (options?.streamName) {
        args.push(`-si${options.streamName}`);
      } else {
        args.push('-si');
      }
    }

    const levelFlag = CommandCompiler.mapCompressionLevel(options?.level);
    if (levelFlag) {
      args.push(levelFlag);
    }

    if (options?.method) {
      args.push(`-m0=${options.method}`);
    }

    if (options?.dictionarySize) {
      args.push(`-md=${options.dictionarySize}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    if (options?.encryptHeader !== undefined) {
      args.push(`-mhe=${options.encryptHeader ? 'on' : 'off'}`);
    }

    if (options?.threads !== undefined) {
      args.push(`-mmt=${options.threads}`);
    }

    args.push('-y');

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    const dummyArchive = options?.archiveName || `dummy.${format}`;
    args.push(dummyArchive);

    if (!isStreamInput && fileInputs && fileInputs.length > 0) {
      args.push(...fileInputs);
    }

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip decompression (`7z x`, `7z e`, `7z t`).
   */
  static decompress(archivePath: string, outputDir?: string, options?: DecompressOptions): string[] {
    let command: string;
    if (options?.testOnly || options?.mode === 'test') {
      command = 't';
    } else if (options?.preservePaths === false || options?.mode === 'flat') {
      command = 'e';
    } else {
      command = 'x';
    }

    const args: string[] = [command];

    if (options?.format) {
      args.push(`-t${options.format}`);
    }

    const targetOutputDir = options?.outputDir || options?.destination || outputDir;
    if (targetOutputDir && command !== 't') {
      args.push(`-o${targetOutputDir}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    const overwriteMode = options?.overwriteMode || 'overwrite';
    switch (overwriteMode) {
      case 'skip':
        args.push('-aos');
        break;
      case 'renameExisting':
        args.push('-aou');
        break;
      case 'autoRenameNew':
        args.push('-aot');
        break;
      case 'overwrite':
      default:
        args.push('-aoa');
        break;
    }

    args.push('-y');

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.eliminateRootFolder) {
      args.push('-spe');
    }

    if (options?.fullPaths === 2) {
      args.push('-spf2');
    } else if (options?.fullPaths === true) {
      args.push('-spf');
    }

    if (options?.hashFunction) {
      args.push(`-scrc${options.hashFunction}`);
    }

    if (options?.threads !== undefined) {
      args.push(`-mmt=${options.threads}`);
    }

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(archivePath);

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip stream decompression (`7z e -so`).
   */
  static decompressStream(
    options?: DecompressStreamOptions,
    isStreamInput: boolean = true,
    archivePath?: string,
  ): string[] {
    const args: string[] = ['e'];

    args.push('-so');

    if (isStreamInput) {
      args.push('-si');
    }

    if (options?.format) {
      args.push(`-t${options.format}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    if (options?.threads !== undefined) {
      args.push(`-mmt=${options.threads}`);
    }

    args.push('-y');

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    if (!isStreamInput && archivePath) {
      args.push(archivePath);
    }

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip listing (`7z l`).
   */
  static listArchive(archivePath: string, options?: ListArchiveOptions): string[] {
    const args: string[] = ['l'];

    const useSlt = options?.slt ?? options?.technical ?? true;
    if (useSlt) {
      args.push('-slt');
    }

    if (options?.format) {
      args.push(`-t${options.format}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    args.push('-y');

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(archivePath);

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip information / supported features (`7z i`).
   */
  static getSupportedFeatures(options?: GetSupportedFeaturesOptions): string[] {
    const args: string[] = ['i'];

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip hash calculation (`7z h`).
   */
  static calculateHash(targetPath: string | string[], options?: CalculateHashOptions): string[] {
    const args: string[] = ['h'];

    const hashType = options?.hashType || options?.hashAlgorithm || 'SHA256';
    args.push(`-scrc${hashType}`);

    args.push('-y');

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    const targets = normalizeTargets(targetPath);
    for (const target of targets) {
      args.push(target);
    }

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip testing (`7z t`).
   */
  static testArchive(archivePath: string, options?: TestArchiveOptions): string[] {
    const args: string[] = ['t'];

    if (options?.format) {
      args.push(`-t${options.format}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    args.push('-y');

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.threads !== undefined) {
      args.push(`-mmt=${options.threads}`);
    }

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(archivePath);

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip benchmark (`7z b`).
   */
  static benchmark(options?: BenchmarkOptions): string[] {
    const args: string[] = ['b'];

    if (options?.iterations !== undefined && options.iterations > 0) {
      args.push(options.iterations.toString());
    }

    if (options?.dictionarySize) {
      args.push(`-md=${options.dictionarySize}`);
    }

    if (options?.threads !== undefined) {
      args.push(`-mmt=${options.threads}`);
    }

    if (options?.method) {
      args.push(`-mm=${options.method}`);
    }

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip deletion (`7z d`).
   */
  static deleteFromArchive(
    archivePath: string,
    targets: string | string[],
    options?: DeleteFromArchiveOptions,
  ): string[] {
    const args: string[] = ['d'];

    if (options?.format) {
      args.push(`-t${options.format}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.workDir) {
      args.push(`-w${options.workDir}`);
    }

    args.push('-y');

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(archivePath);

    const targetList = normalizeTargets(targets);
    args.push(...targetList);

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip renaming (`7z rn`).
   */
  static renameInArchive(
    archivePath: string,
    renames: RenamePair | RenamePair[],
    options?: RenameInArchiveOptions,
  ): string[] {
    const args: string[] = ['rn'];

    if (options?.format) {
      args.push(`-t${options.format}`);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.workDir) {
      args.push(`-w${options.workDir}`);
    }

    args.push('-y');

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(archivePath);

    const pairs = normalizeRenamePairs(renames);
    for (const pair of pairs) {
      args.push(pair.from, pair.to);
    }

    return args;
  }

  /**
   * Constructs CLI arguments for 7-Zip update (`7z u`).
   */
  static updateArchive(
    archivePath: string,
    targets?: string | string[],
    options?: UpdateArchiveOptions,
  ): string[] {
    const args: string[] = ['u'];

    const format = options?.format || options?.archiveFormat;
    if (format) {
      args.push(`-t${format}`);
    }

    const levelFlag = CommandCompiler.mapCompressionLevel(options?.level ?? options?.compressionLevel);
    if (levelFlag) {
      args.push(levelFlag);
    }

    if (options?.password !== undefined) {
      args.push(`-p${options.password}`);
    }

    if (options?.encryptHeader !== undefined) {
      args.push(`-mhe=${options.encryptHeader ? 'on' : 'off'}`);
    }

    if (options?.recursive === false) {
      args.push('-r-');
    } else {
      args.push('-r');
    }

    if (options?.include) {
      const includes = normalizeTargets(options.include);
      for (const pattern of includes) {
        args.push(`-ir!${pattern}`);
      }
    }

    if (options?.exclude) {
      const excludes = normalizeTargets(options.exclude);
      for (const pattern of excludes) {
        args.push(`-xr!${pattern}`);
      }
    }

    if (options?.deleteSource) {
      args.push('-sdel');
    }

    if (options?.updateSwitch) {
      args.push(options.updateSwitch.startsWith('-u') ? options.updateSwitch : `-u${options.updateSwitch}`);
    }

    if (options?.workDir) {
      args.push(`-w${options.workDir}`);
    }

    args.push('-y');

    if (options?.customArgs && options.customArgs.length > 0) {
      args.push(...options.customArgs);
    }

    args.push(archivePath);

    const targetList = normalizeTargets(targets);
    if (targetList.length > 0) {
      args.push(...targetList);
    }

    return args;
  }
}
