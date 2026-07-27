import fs from 'fs';
import path from 'path';
import {
  compress,
  listArchive,
  deleteFromArchive,
  buildDeleteFromArchiveArgs,
  renameInArchive,
  buildRenameInArchiveArgs,
  updateArchive,
  buildUpdateArchiveArgs,
  ensure7ZipExecutable,
} from './index.js';

async function runTests() {
  console.log('--- Starting Archive Editing (deleteFromArchive, renameInArchive, updateArchive) Tests ---');

  // =========================================================================
  // 1. Unit Tests: Argument Builders
  // =========================================================================
  console.log('1. Testing argument builders...');

  // deleteFromArchive args
  const delArgs = buildDeleteFromArchiveArgs('archive.7z', ['file1.txt', 'file2.txt'], {
    password: 'secretPassword',
    format: '7z',
    exclude: '*.tmp',
    workDir: './tempWork',
  });
  console.log('buildDeleteFromArchiveArgs:', delArgs.join(' '));
  if (delArgs[0] !== 'd') throw new Error('deleteFromArchive command should be "d"');
  if (!delArgs.includes('-t7z')) throw new Error('Missing format switch in deleteFromArchive');
  if (!delArgs.includes('-psecretPassword')) throw new Error('Missing password switch in deleteFromArchive');
  if (!delArgs.includes('-xr!*.tmp')) throw new Error('Missing exclude switch in deleteFromArchive');
  if (!delArgs.includes('-w./tempWork')) throw new Error('Missing workDir switch in deleteFromArchive');
  if (delArgs[delArgs.length - 2] !== 'file1.txt' || delArgs[delArgs.length - 1] !== 'file2.txt') {
    throw new Error('Deletion targets should be appended at the end');
  }

  // renameInArchive args
  const rnArgs = buildRenameInArchiveArgs(
    'archive.7z',
    [{from: 'old1.txt', to: 'new1.txt'}, ['folder/old2.txt', 'folder/new2.txt']],
    {
      password: 'pass',
      format: '7z',
    },
  );
  console.log('buildRenameInArchiveArgs:', rnArgs.join(' '));
  if (rnArgs[0] !== 'rn') throw new Error('renameInArchive command should be "rn"');
  if (!rnArgs.includes('-ppass')) throw new Error('Missing password switch in renameInArchive');
  if (!rnArgs.includes('-t7z')) throw new Error('Missing format switch in renameInArchive');
  const archiveIdx = rnArgs.indexOf('archive.7z');
  if (archiveIdx === -1) throw new Error('Missing archivePath in renameInArchive args');
  if (
    rnArgs[archiveIdx + 1] !== 'old1.txt' ||
    rnArgs[archiveIdx + 2] !== 'new1.txt' ||
    rnArgs[archiveIdx + 3] !== 'folder/old2.txt' ||
    rnArgs[archiveIdx + 4] !== 'folder/new2.txt'
  ) {
    throw new Error('Rename pairs should follow archivePath sequentially');
  }

  // updateArchive args
  const updateArgs = buildUpdateArchiveArgs('archive.7z', ['updated.txt'], {
    level: 9,
    password: 'p',
    encryptHeader: true,
    deleteSource: true,
  });
  console.log('buildUpdateArchiveArgs:', updateArgs.join(' '));
  if (updateArgs[0] !== 'u') throw new Error('updateArchive command should be "u"');
  if (!updateArgs.includes('-mx=9')) throw new Error('Missing compression level in updateArchive');
  if (!updateArgs.includes('-pp')) throw new Error('Missing password in updateArchive');
  if (!updateArgs.includes('-mhe=on')) throw new Error('Missing header encryption in updateArchive');
  if (!updateArgs.includes('-sdel')) throw new Error('Missing deleteSource switch in updateArchive');

  console.log('✓ Argument building unit tests passed.');

  // =========================================================================
  // 2. Real Process Execution Tests
  // =========================================================================
  console.log('2. Testing real process execution...');
  const execPath = await ensure7ZipExecutable();
  console.log('Using 7-Zip executable:', execPath);

  const testTmpDir = path.join(process.cwd(), 'out_edit_test');
  if (fs.existsSync(testTmpDir)) {
    fs.rmSync(testTmpDir, {recursive: true, force: true});
  }
  fs.mkdirSync(testTmpDir, {recursive: true});

  try {
    const fileA = path.join(testTmpDir, 'fileA.txt');
    const fileB = path.join(testTmpDir, 'fileB.txt');
    const fileC = path.join(testTmpDir, 'fileC.txt');
    const archivePath = path.join(testTmpDir, 'edit_test.7z');

    fs.writeFileSync(fileA, 'Initial Content A');
    fs.writeFileSync(fileB, 'Initial Content B');
    fs.writeFileSync(fileC, 'Initial Content C');

    // Create initial archive with 3 files
    await compress([fileA, fileB, fileC], archivePath, {executablePath: execPath});

    let listRes = await listArchive(archivePath, {executablePath: execPath});
    let itemPaths = listRes.items.map(i => i.path);
    console.log('Initial archive items:', itemPaths);
    if (!itemPaths.includes('fileA.txt') || !itemPaths.includes('fileB.txt') || !itemPaths.includes('fileC.txt')) {
      throw new Error('Initial archive creation failed');
    }

    // -----------------------------------------------------------------------
    // Test renameInArchive (7z rn fileB.txt -> fileB_renamed.txt)
    // -----------------------------------------------------------------------
    console.log('Testing renameInArchive()...');
    const rnRes = await renameInArchive(
      archivePath,
      {from: 'fileB.txt', to: 'fileB_renamed.txt'},
      {executablePath: execPath},
    );
    if (rnRes.exitCode !== 0) throw new Error(`renameInArchive failed with exit code ${rnRes.exitCode}`);

    listRes = await listArchive(archivePath, {executablePath: execPath});
    itemPaths = listRes.items.map(i => i.path);
    console.log('Archive items after rename:', itemPaths);
    if (itemPaths.includes('fileB.txt')) throw new Error('fileB.txt should no longer exist');
    if (!itemPaths.includes('fileB_renamed.txt')) throw new Error('fileB_renamed.txt should exist');
    console.log('✓ renameInArchive verified successfully.');

    // -----------------------------------------------------------------------
    // Test deleteFromArchive (7z d fileC.txt)
    // -----------------------------------------------------------------------
    console.log('Testing deleteFromArchive()...');
    const delRes = await deleteFromArchive(archivePath, 'fileC.txt', {executablePath: execPath});
    if (delRes.exitCode !== 0) throw new Error(`deleteFromArchive failed with exit code ${delRes.exitCode}`);

    listRes = await listArchive(archivePath, {executablePath: execPath});
    itemPaths = listRes.items.map(i => i.path);
    console.log('Archive items after deletion:', itemPaths);
    if (itemPaths.includes('fileC.txt')) throw new Error('fileC.txt was not deleted');
    console.log('✓ deleteFromArchive verified successfully.');

    // -----------------------------------------------------------------------
    // Test updateArchive (7z u fileD.txt)
    // -----------------------------------------------------------------------
    console.log('Testing updateArchive()...');
    const fileD = path.join(testTmpDir, 'fileD.txt');
    fs.writeFileSync(fileD, 'New Content D');

    const updateRes = await updateArchive(archivePath, fileD, {
      executablePath: execPath,
      workingDir: testTmpDir,
    });
    if (updateRes.exitCode !== 0) throw new Error(`updateArchive failed with exit code ${updateRes.exitCode}`);

    listRes = await listArchive(archivePath, {executablePath: execPath});
    itemPaths = listRes.items.map(i => i.path);
    console.log('Archive items after update:', itemPaths);
    if (!itemPaths.includes('fileD.txt')) throw new Error('fileD.txt was not added/updated in archive');
    console.log('✓ updateArchive verified successfully.');

    console.log('All Archive Editing tests passed successfully!');
  } finally {
    if (fs.existsSync(testTmpDir)) {
      fs.rmSync(testTmpDir, {recursive: true, force: true});
    }
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
