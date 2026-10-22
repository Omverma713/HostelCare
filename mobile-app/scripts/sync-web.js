/**
 * Sync Script for HostelCare Mobile App
 * 
 * 1. Executes production build in the `frontend` directory.
 * 2. Empties the `mobile-app/www` folder.
 * 3. Copies all built assets from `frontend/dist` into `mobile-app/www`.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(rootDir, 'frontend');
const distDir = path.resolve(frontendDir, 'dist');
const wwwDir = path.resolve(__dirname, '../www');

console.log('🚀 Step 1/3: Building HostelCare frontend (Production)...');
try {
  execSync('npm run build', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
} catch (error) {
  console.error('❌ Frontend build failed! Aborting mobile sync.');
  process.exit(1);
}

if (!fs.existsSync(path.resolve(distDir, 'index.html'))) {
  console.error('❌ Error: frontend/dist/index.html was not generated.');
  process.exit(1);
}

console.log('🧹 Step 2/3: Cleaning mobile-app/www directory...');
if (fs.existsSync(wwwDir)) {
  fs.rmSync(wwwDir, { recursive: true, force: true });
}
fs.mkdirSync(wwwDir, { recursive: true });

console.log('📦 Step 3/3: Copying frontend/dist -> mobile-app/www (excluding unused desktop media)...');
fs.cpSync(distDir, wwwDir, {
  recursive: true,
  filter: (src) => {
    // Avoid bundling heavy unused desktop video assets into the mobile APK
    if (src.endsWith('.mp4')) return false;
    return true;
  },
});

const copiedFiles = fs.readdirSync(wwwDir);
console.log(`✅ Web assets synced successfully (${copiedFiles.length} items copied to www/).`);
