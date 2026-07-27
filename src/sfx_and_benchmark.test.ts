import {
  buildCompressArgs,
  buildBenchmarkArgs,
  parseBenchmarkOutput,
  runBenchmark,
  ensure7ZipExecutable,
} from './index.js';

async function runTests() {
  console.log('--- Starting SFX & Benchmarking Feature Tests ---');

  // 1. Unit Tests: buildCompressArgs with SFX
  console.log('1. Testing SFX argument building...');
  const sfxBoolArgs = buildCompressArgs('input.txt', 'output.exe', {sfx: true});
  if (!sfxBoolArgs.includes('-sfx')) {
    throw new Error('Expected -sfx flag when sfx: true');
  }

  const sfxCustomArgs = buildCompressArgs('input.txt', 'output.exe', {sfx: '7zCon.sfx'});
  if (!sfxCustomArgs.includes('-sfx7zCon.sfx')) {
    throw new Error('Expected -sfx7zCon.sfx flag when custom sfx string specified');
  }

  const sfxFalseArgs = buildCompressArgs('input.txt', 'output.7z', {sfx: false});
  if (sfxFalseArgs.some(arg => arg.startsWith('-sfx'))) {
    throw new Error('Should not include -sfx flag when sfx: false');
  }
  console.log('✓ SFX argument building unit tests passed.');

  // 2. Unit Tests: buildBenchmarkArgs
  console.log('2. Testing Benchmark argument building...');
  const benchArgsDefault = buildBenchmarkArgs();
  if (benchArgsDefault[0] !== 'b' || benchArgsDefault.length !== 1) {
    throw new Error('Default benchmark args should just be ["b"]');
  }

  const benchArgsFull = buildBenchmarkArgs({
    iterations: 2,
    dictionarySize: '22',
    threads: 4,
    method: 'LZMA2',
    customArgs: ['-so'],
  });
  if (benchArgsFull[0] !== 'b') throw new Error('First argument must be "b"');
  if (!benchArgsFull.includes('2')) throw new Error('Missing iterations argument "2"');
  if (!benchArgsFull.includes('-md=22')) throw new Error('Missing dictionary size "-md=22"');
  if (!benchArgsFull.includes('-mmt=4')) throw new Error('Missing threads "-mmt=4"');
  if (!benchArgsFull.includes('-mm=LZMA2')) throw new Error('Missing method "-mm=LZMA2"');
  if (!benchArgsFull.includes('-so')) throw new Error('Missing customArgs "-so"');
  console.log('✓ Benchmark argument building unit tests passed.');

  // 3. Unit Tests: parseBenchmarkOutput
  console.log('3. Testing parseBenchmarkOutput parser...');
  const sampleVerticalStdout = `
7-Zip 24.09 (x64) : Copyright (c) 1999-2024 Igor Pavlov : 2024-11-28

RAM size: 32490 MB, CPU threads: 16
RAM usage: 441 MB, CPU threads: 16

LZMA 19:

Speed      Usage       RATING
     KiB/s          %  MIPS MIPS (AVG)
Compressing
  62391       1363   4307   4307
Decompressing
 777273       1536   4779   4779
Tot:          1449   4543   4543
`;

  const parsedVertical = parseBenchmarkOutput(sampleVerticalStdout, '', 0);
  if (parsedVertical.ramSize !== 32490) throw new Error(`Expected ramSize 32490, got ${parsedVertical.ramSize}`);
  if (parsedVertical.cpuThreads !== 16) throw new Error(`Expected cpuThreads 16, got ${parsedVertical.cpuThreads}`);
  if (parsedVertical.ramUsage !== 441) throw new Error(`Expected ramUsage 441, got ${parsedVertical.ramUsage}`);
  if (parsedVertical.compressing?.speedKiBs !== 62391) throw new Error('Compressing speed incorrect');
  if (parsedVertical.decompressing?.speedKiBs !== 777273) throw new Error('Decompressing speed incorrect');
  if (parsedVertical.total?.ratingMips !== 4543) throw new Error('Total rating MIPS incorrect');

  // 4. Integration Tests: runBenchmark process execution
  console.log('4. Testing runBenchmark execution...');
  const execPath = await ensure7ZipExecutable();
  const benchResult = await runBenchmark({
    executablePath: execPath,
    iterations: 1,
  });

  if (benchResult.exitCode !== 0) {
    throw new Error(`runBenchmark returned non-zero exit code: ${benchResult.exitCode}`);
  }
  if (!benchResult.stdout || benchResult.stdout.trim() === '') {
    throw new Error('runBenchmark stdout is empty');
  }

  console.log('✓ runBenchmark integration test passed successfully.');
  console.log('All SFX and Benchmark feature tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
