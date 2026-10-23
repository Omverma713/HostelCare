/**
 * HostelCare APK Packaging and Release Helper Script
 *
 * 1. Reads application ID, versionCode, and versionName from build.gradle.
 * 2. Compiles frontend and syncs Capacitor Android assets.
 * 3. Builds the debug APK using Gradle and the preserved signing key.
 * 4. Verifies the APK's SHA-256 signature against the preserved keystore fingerprint.
 * 5. Copies and standardizes the APK to mobile-app/dist-apk/hostelcare-v<versionName>.apk.
 * 6. Displays exact GitHub Release publishing details and direct download link.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXPECTED_APPLICATION_ID = 'com.hostelcare.app';
const EXPECTED_SIGNATURE_SHA256 = '1B:78:F1:1D:05:56:2B:38:82:15:3A:59:85:65:6A:AB:71:C5:E4:1F:05:30:2A:C9:22:BA:03:41:E7:93:84:7C';
const GITHUB_REPO = 'Omverma713/HostelCare';

const mobileDir = path.resolve(__dirname, '..');
const androidDir = path.resolve(mobileDir, 'android');
const buildGradlePath = path.resolve(androidDir, 'app', 'build.gradle');
const distApkDir = path.resolve(mobileDir, 'dist-apk');

console.log('====================================================');
console.log('📦 HostelCare Android APK Release Packager');
console.log('====================================================\n');

// 1. Read build.gradle
if (!fs.existsSync(buildGradlePath)) {
  console.error(`❌ Error: build.gradle not found at ${buildGradlePath}`);
  process.exit(1);
}

const buildGradleContent = fs.readFileSync(buildGradlePath, 'utf8');

const appIdMatch = buildGradleContent.match(/applicationId\s+["']([^"']+)["']/);
const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/);
const versionNameMatch = buildGradleContent.match(/versionName\s+["']([^"']+)["']/);

if (!appIdMatch || !versionCodeMatch || !versionNameMatch) {
  console.error('❌ Failed to parse applicationId, versionCode, or versionName from build.gradle.');
  process.exit(1);
}

const applicationId = appIdMatch[1];
const versionCode = parseInt(versionCodeMatch[1], 10);
const versionName = versionNameMatch[1];

console.log(`📋 Configuration:`);
console.log(`   - Application ID : ${applicationId}`);
console.log(`   - Version Name   : ${versionName}`);
console.log(`   - Version Code   : ${versionCode}\n`);

if (applicationId !== EXPECTED_APPLICATION_ID) {
  console.error(`❌ Package mismatch! Expected ${EXPECTED_APPLICATION_ID}, found ${applicationId}.`);
  process.exit(1);
}

// 2. Build Frontend & Sync Capacitor Assets
console.log('🔄 Step 1/3: Building frontend & syncing Capacitor Android assets...');
try {
  execSync('npm run build:mobile', {
    cwd: mobileDir,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('❌ Failed during build:mobile step.');
  process.exit(1);
}

// 3. Assemble Debug APK with Gradle
console.log('\n🔨 Step 2/3: Assembling APK with Gradle (preserving signing key)...');
const isWindows = process.platform === 'win32';
const gradlewCmd = isWindows ? 'gradlew.bat' : './gradlew';

try {
  execSync(`${gradlewCmd} assembleDebug`, {
    cwd: androidDir,
    stdio: 'inherit',
  });
} catch (err) {
  console.error('❌ Gradle assembleDebug failed.');
  process.exit(1);
}

const generatedApkPath = path.resolve(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(generatedApkPath)) {
  console.error(`❌ Generated APK not found at ${generatedApkPath}`);
  process.exit(1);
}

// 4. Verify Signing Fingerprint
console.log('\n🔒 Step 3/3: Verifying Android APK signing signature...');
let signatureVerified = false;
try {
  const certInfo = execSync(`keytool -printcert -jarfile "${generatedApkPath}"`, {
    encoding: 'utf8',
  });

  if (certInfo.includes(EXPECTED_SIGNATURE_SHA256)) {
    signatureVerified = true;
    console.log(`✅ Signature verified: Matches preserved signing key!`);
    console.log(`   SHA-256: ${EXPECTED_SIGNATURE_SHA256}`);
  } else {
    console.warn(`⚠️ Warning: Certificate SHA-256 does not match expected fingerprint.`);
    console.warn(`   Expected: ${EXPECTED_SIGNATURE_SHA256}`);
    console.warn(certInfo);
  }
} catch (err) {
  console.warn('⚠️ Could not verify certificate via keytool:', err.message);
}

// 5. Copy to standardized release artifact
if (!fs.existsSync(distApkDir)) {
  fs.mkdirSync(distApkDir, { recursive: true });
}

const targetApkName = `hostelcare-v${versionName}.apk`;
const targetApkPath = path.resolve(distApkDir, targetApkName);
fs.copyFileSync(generatedApkPath, targetApkPath);

const apkStats = fs.statSync(targetApkPath);
const sizeMb = (apkStats.size / (1024 * 1024)).toFixed(2);

console.log('\n====================================================');
console.log('🎉 APK Build Complete & Ready for GitHub Release!');
console.log('====================================================');
console.log(`📦 Release Asset  : ${targetApkPath} (${sizeMb} MB)`);
console.log(`🏷️  Release Tag    : v${versionName}`);
console.log(`🔖 Version Code   : ${versionCode}`);
console.log(`🛡️  Package ID     : ${applicationId}`);
console.log(`🔑 Key Verified   : ${signatureVerified ? 'YES' : 'CHECK MANUALLY'}`);
console.log('\n----------------------------------------------------');
console.log('🌐 GitHub Release Publishing Details:');
console.log('----------------------------------------------------');
console.log(`1. Visit: https://github.com/${GITHUB_REPO}/releases/new`);
console.log(`2. Choose tag: v${versionName} (create new tag upon publish)`);
console.log(`3. Release title: HostelCare v${versionName}`);
console.log(`4. Attach file: ${targetApkPath}`);
console.log(`5. Click "Publish release"`);
console.log('\n----------------------------------------------------');
console.log('📲 Super Admin App Update Configuration:');
console.log('----------------------------------------------------');
console.log(`Direct APK URL to enter in Super Admin Portal:`);
console.log(`👉 https://github.com/${GITHUB_REPO}/releases/download/v${versionName}/${targetApkName}`);
console.log('====================================================\n');
