import { spawn } from 'node:child_process';

const args = [
  'wrangler',
  'pages',
  'deploy',
  'dist',
  '--project-name',
  'null-observatory',
  '--branch',
  'main',
  '--commit-dirty=true'
];

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', 'npx', ...args] : args;
const child = spawn(command, commandArgs, {
  stdio: 'inherit'
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});
