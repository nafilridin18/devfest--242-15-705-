/**
 * Standalone bundle builder
 * Bundles js/main.js into js/bundle.js with zero config using esbuild
 */
import { execSync } from 'node:child_process';
import path from 'node:path';

console.log('Building js/bundle.js for universal standalone & file:/// execution...');

try {
  execSync('npx esbuild js/main.js --bundle --outfile=js/bundle.js --format=iife --global-name=TPB', {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  console.log('✅ js/bundle.js compiled successfully.');
} catch (err) {
  console.error('Error compiling bundle:', err);
  process.exit(1);
}
