import {ensure7ZipExecutable, getDefaultDownloadPath} from './index.js';
import {execSync} from 'child_process';

async function run() {
  console.log('Default download folder:', getDefaultDownloadPath());
  console.log('Ensuring 7-Zip executable is downloaded...');

  const execPath = await ensure7ZipExecutable();
  console.log('7-Zip Executable Path:', execPath);

  try {
    const output = execSync(`"${execPath}" --help`, {encoding: 'utf8'});
    console.log('7-Zip Executable Output Sample:');
    console.log(output.split('\n').slice(0, 5).join('\n'));
  } catch (err) {
    console.error('Failed to execute downloaded binary:', err);
  }
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
