import { execSync } from 'child_process';

try {
  console.log('Running pnpm install to generate lockfile...');
  const result = execSync('pnpm install --no-frozen-lockfile', {
    cwd: '/vercel/share/v0-project',
    stdio: 'pipe',
    encoding: 'utf-8',
    timeout: 120000,
  });
  console.log(result);
  console.log('Lockfile generated successfully');
} catch (err) {
  console.error('Error:', err.stdout || err.message);
  console.error('Stderr:', err.stderr);
  process.exit(1);
}
