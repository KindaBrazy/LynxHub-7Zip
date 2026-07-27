# @lynxhub/7zip

[![npm version](https://img.shields.io/npm/v/@lynxhub/7zip.svg)](https://www.npmjs.com/package/@lynxhub/7zip)
[![license](https://img.shields.io/github/license/KindaBrazy/LynxHub-7Zip.svg)](https://github.com/KindaBrazy/LynxHub-7Zip/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

> Modern, zero-config, cross-platform 7-Zip wrapper for Node.js and TypeScript.

**@lynxhub/7zip** brings the full speed and feature set of the native 7-Zip CLI to Node.js. It automatically downloads and manages the official 7-Zip executable for Windows, macOS, and Linux out-of-the-box; no pre-installed system binaries required.

---

## Features

- **Zero Configuration**: Automatically downloads and executes the correct 7-Zip binary for your OS and CPU architecture.
- **Full Format Support**: `7z`, `zip`, `tar`, `gzip`, `bzip2`, `xz`, `wim`, `iso`, `rar`, and more.
- **Node.js Stream Support**: Stream compression and decompression directly using Node.js Readable streams and Buffers.
- **Enterprise Features**: AES-256 password encryption, solid archives, multi-threading, custom compression levels (`store` to `ultra`).
- **Archive Utilities**: List contents, test archive health, compute checksums (CRC32, SHA256), delete, rename, or update files without full extraction.
- **TypeScript First**: Full static typing and IDE autocompletion for all options and return values.

---

## Installation

```bash
npm install @lynxhub/7zip
# or
yarn add @lynxhub/7zip
# or
pnpm add @lynxhub/7zip
```

---

## Quick Start

### Basic Compression & Extraction

```typescript
import { compress, decompress } from '@lynxhub/7zip';

// Compress a folder into a 7z archive
await compress('./my-folder', 'archive.7z', {
  level: 'ultra',
  password: 'securePassword123'
});

// Extract archive contents
await decompress('archive.7z', './output-dir', {
  password: 'securePassword123'
});
```

---

## Usage Examples

### 1. Compression Options & Formats

Customize compression level, format, thread count, and passwords:

```typescript
import { compress, createSFX } from '@lynxhub/7zip';

// Compress files into a password-protected ZIP archive
await compress(['src/file1.txt', 'src/file2.txt'], 'backup.zip', {
  format: 'zip',
  level: 'maximum', // 'store' | 'fastest' | 'fast' | 'normal' | 'maximum' | 'ultra' (or 0-9)
  password: 'mySecretPassword',
  threads: 4,
  exclude: ['*.tmp', 'node_modules/*']
});

// Create a Self-Extracting (.exe) archive
await createSFX('./dist', 'Installer.exe', {
  level: 'ultra'
});
```

### 2. Node.js Stream Integration

Compress or extract data in-memory using Node.js streams:

```typescript
import { compressStream, decompressStream } from '@lynxhub/7zip';
import { createReadStream, createWriteStream } from 'fs';

// Stream input file into a compressed .xz stream
const inputStream = createReadStream('data.json');
const outputStream = createWriteStream('data.json.xz');

const result = await compressStream(inputStream, {
  format: 'xz',
  streamName: 'data.json'
});

result.stream.pipe(outputStream);

// Decompress a stream back to raw output
const compressedStream = createReadStream('data.json.xz');
const decompResult = await decompressStream(compressedStream, {
  format: 'xz'
});

decompResult.stream.pipe(process.stdout);
```

### 3. Inspecting Archive Contents

Read detailed metadata, file paths, packed sizes, and modification dates without extracting:

```typescript
import { listArchive } from '@lynxhub/7zip';

const info = await listArchive('archive.7z');

console.log(`Found ${info.items.length} items in archive:`);
for (const item of info.items) {
  console.log(`- ${item.path} (${item.size} bytes, encrypted: ${item.encrypted})`);
}
```

### 4. Integrity Testing & Hash Checksums

Check archive integrity or compute checksums (CRC32, SHA256, etc.):

```typescript
import { testArchive, calculateHash } from '@lynxhub/7zip';

// Verify archive integrity
const testResult = await testArchive('archive.7z', {
  password: 'securePassword123'
});

if (testResult.valid) {
  console.log(`Archive valid! Tested ${testResult.testedFilesCount} files.`);
}

// Calculate file checksums
const hashResult = await calculateHash('./my-file.iso', 'SHA256');
console.log('SHA256 Summary:', hashResult.summary);
```

### 5. In-Place Archive Editing

Delete, rename, or update files directly inside an existing archive:

```typescript
import { deleteFromArchive, renameInArchive, updateArchive } from '@lynxhub/7zip';

// Delete specific files from an archive
await deleteFromArchive('archive.7z', ['*.log', 'temp.txt']);

// Rename files inside the archive
await renameInArchive('archive.7z', [
  { from: 'old-name.txt', to: 'new-name.txt' }
]);

// Add or update files inside an existing archive
await updateArchive('archive.7z', 'new-doc.pdf');
```

---

## Advanced & Binary Management

> [!NOTE]
> By default, `@lynxhub/7zip` automatically downloads and caches the required official 7-Zip binary for your operating system.

If you prefer to specify binary download options or use a custom local system binary:

```typescript
import { compress, ensure7ZipExecutable } from '@lynxhub/7zip';

// Manually trigger binary resolution / download with options.
// Defaults to '7za' for full multi-format support (7z, zip, tar, gzip, bzip2, etc.).
const executablePath = await ensure7ZipExecutable({
  variant: '7za', // '7za' (default - multi-format) | '7zr' (7z format only)
  targetPath: './bin'
});

// Use a custom system 7-Zip binary path
await compress('./folder', 'output.7z', {
  executablePath: '/usr/bin/7z'
});
```

---

## API Reference

| Function | Description |
| :--- | :--- |
| `compress(input, outputArchive, options?)` | Compress files or directories into `.7z`, `.zip`, `.tar.gz`, etc. |
| `decompress(archivePath, outputDir, options?)` | Extract archives (alias: `extract`). |
| `createSFX(input, outputArchive, options?)` | Create self-extracting `.exe` archives. |
| `compressStream(input, options?)` | Compress readable streams or buffers into output stream. |
| `decompressStream(input, options?)` | Decompress input streams into output stream. |
| `listArchive(archivePath, options?)` | Get structured list of files, sizes, attributes, and raw metadata. |
| `testArchive(archivePath, options?)` | Verify archive integrity and password correctness. |
| `calculateHash(path, hashType?, options?)` | Calculate file checksums (CRC32, SHA256, etc.). |
| `deleteFromArchive(archive, targets, options?)` | Remove matching files from an existing archive. |
| `renameInArchive(archive, renames, options?)` | Rename files inside an archive without unpacking. |
| `updateArchive(archive, files, options?)` | Add or update files in an existing archive. |
| `ensure7ZipExecutable()` | Resolves or downloads platform-specific 7-Zip binary. |

---

## Requirements

- **Node.js**: >= 18.0.0
- **Supported Platforms**: Windows (x64, IA32, ARM64), macOS (x64, ARM64), Linux (x64, IA32, ARM64)