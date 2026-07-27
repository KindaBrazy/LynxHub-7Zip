## [0.10.0] - 2026-07-27

- **Automatic Binary Downloader**: Automatically downloads, verifies, and caches the official native 7-Zip binaries for Windows, macOS, and Linux (x64, arm64, ia32).
- **Full Archive Operations**:
  - `compress`: Create archives (`.7z`, `.zip`, `.tar`, `.gz`, `.bz2`, `.xz`, `.wim`, etc.) with customizable compression levels (`store` to `ultra`), solid archiving, and multi-threading.
  - `decompress`: Extract archives with full directory structure preservation.
  - `list`: Inspect archive contents and retrieve detailed file metadata (sizes, timestamps, attributes).
  - `test`: Test archive health and integrity.
  - `hash`: Compute CRC32, CRC64, SHA1, and SHA256 hashes.
- **Stream & Buffer Support**: Direct compression/decompression using Node.js `Readable` streams and `Buffer` instances without writing temporary disk files.
- **Archive Editing**: Add, update, delete, or rename files within existing archives without re-compressing from scratch.
- **Security**: AES-256 password encryption and header encryption (`-mhe=on`).
- **SFX**: Support for creating self-extracting (`.exe`) archives.
- **TypeScript**: Built from the ground up with TypeScript for strict type checking and full IDE autocompletion.
