import { execSync } from 'child_process';

try {
  console.log('Running pnpm install to update lockfile...');
  execSync('pnpm install --no-frozen-lockfile', { 
    cwd: '/vercel/share/v0-project',
    stdio: 'inherit' 
  });
  console.log('Lockfile updated successfully.');
} catch (error) {
  console.error('Error updating lockfile:', error.message);
  process.exit(1);
}
