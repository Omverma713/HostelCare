/**
 * HostelCare OTA (Over-The-Air) Live Update Packager
 *
 * 1. Reads current version from frontend/package.json.
 * 2. Compiles production frontend bundle using Vite (npm run build).
 * 3. Compresses frontend/dist into dist-ota/hostelcare-bundle-v<version>.zip and dist-ota/hostelcare-web-bundle.zip.
 * 4. Generates SHA-256 integrity hash.
 * 5. Copies bundle into public/ota-bundles/ for immediate direct backend serving.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');
const frontendDir = path.resolve(rootDir, 'frontend');
const distDir = path.resolve(frontendDir, 'dist');
const distOtaDir = path.resolve(rootDir, 'dist-ota');
const publicOtaDir = path.resolve(rootDir, 'public', 'ota-bundles');

console.log('====================================================');
console.log('⚡ HostelCare Over-The-Air (OTA) Live Update Packager');
console.log('====================================================\n');

// 1. Read frontend package.json version
const frontendPkg = JSON.parse(fs.readFileSync(path.resolve(frontendDir, 'package.json'), 'utf8'));
const version = frontendPkg.version || '1.2.2.15';
console.log(`📦 Packaging OTA Live Bundle for Version: v${version}`);

// 2. Build Frontend (Production Vite)
console.log('\n🔨 Step 1/3: Compiling production frontend bundle with Vite...');
try {
  execSync('npm run build', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' },
  });
} catch (err) {
  console.error('❌ Frontend build failed! Aborting OTA bundle packaging.');
  process.exit(1);
}

if (!fs.existsSync(path.resolve(distDir, 'index.html'))) {
  console.error('❌ Error: frontend/dist/index.html does not exist.');
  process.exit(1);
}

// 3. Prepare output directories
if (!fs.existsSync(distOtaDir)) {
  fs.mkdirSync(distOtaDir, { recursive: true });
}
if (!fs.existsSync(publicOtaDir)) {
  fs.mkdirSync(publicOtaDir, { recursive: true });
}

// 4. Compress frontend/dist into ZIP
const versionedZipPath = path.resolve(distOtaDir, `hostelcare-bundle-v${version}.zip`);
const latestZipPath = path.resolve(distOtaDir, 'hostelcare-web-bundle.zip');

console.log('\n🗜️  Step 2/3: Compressing web assets into ZIP archive...');
const isWindows = process.platform === 'win32';

try {
  if (isWindows) {
    // CRITICAL: Do NOT use PowerShell Compress-Archive!
    // Compress-Archive uses Windows backslashes (\) in entry paths (e.g. assets\app.js),
    // which breaks Android (Linux kernel) unzip and causes instant rollback.
    // Built-in tar.exe creates standard zip with POSIX forward slashes (assets/app.js).
    execSync(`cd "${distDir}" && tar.exe -a -c -f "${versionedZipPath}" *`, { stdio: 'inherit' });
  } else {
    execSync(`cd "${distDir}" && zip -r "${versionedZipPath}" .`, { stdio: 'inherit' });
  }
} catch (err) {
  console.error('❌ Failed to create zip archive:', err.message);
  process.exit(1);
}

// Duplicate as generic latest bundle
fs.copyFileSync(versionedZipPath, latestZipPath);

// Copy to public/ota-bundles for direct HTTP serving
const publicVersionedZip = path.resolve(publicOtaDir, `hostelcare-bundle-v${version}.zip`);
const publicLatestZip = path.resolve(publicOtaDir, 'hostelcare-web-bundle.zip');
fs.copyFileSync(versionedZipPath, publicVersionedZip);
fs.copyFileSync(versionedZipPath, publicLatestZip);

// 5. Calculate SHA-256 Checksum
console.log('\n🔒 Step 3/3: Calculating SHA-256 integrity hash...');
const fileBuffer = fs.readFileSync(versionedZipPath);
const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
const fileSizeMb = (fileBuffer.length / (1024 * 1024)).toFixed(2);

console.log('\n====================================================');
console.log('✅ OTA LIVE UPDATE BUNDLE GENERATED SUCCESSFULLY!');
console.log('====================================================');
console.log(`📁 Bundle File : ${versionedZipPath}`);
console.log(`📏 Bundle Size : ${fileSizeMb} MB (${fileBuffer.length} bytes)`);
console.log(`🔑 SHA-256     : ${sha256}`);
console.log(`🌐 Public URL  : /api/v1/app-version/ota-bundle`);
console.log('\nNext Step:');
console.log('1. Go to SuperAdminPortal -> App Updates -> OTA Live Updates tab.');
console.log(`2. Enter Bundle Version: ${version}`);
console.log(`3. Bundle URL: /api/v1/app-version/ota-bundle`);
console.log(`4. Checksum: ${sha256}`);
console.log('5. Click "Deploy Live OTA Update". Devices will update instantly without installing an APK!\n');

