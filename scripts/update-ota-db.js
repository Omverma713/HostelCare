const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  config.otaUpdates = config.otaUpdates || {};
  config.otaUpdates.enabled = true;
  config.otaUpdates.currentBundleVersion = '1.2.2.19';
  config.otaUpdates.bundleChecksum = 'a56d76fcff5c5d9434a5af3c7486bdff16270aeded350de9576722d2cd0a7d22';
  config.otaUpdates.bundleUrl = 'https://raw.githubusercontent.com/Omverma713/HostelCare/main/public/ota-bundles/hostelcare-bundle-v1.2.2.19.zip';
  config.otaUpdates.minNativeBuild = 28;
  config.otaUpdates.requiresNativeApk = false;

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = '1.2.2.19';
  config.appVersion.updateMessage = 'HostelCare v1.2.2.19: Complete Dark Theme & High Contrast Font Palette Fix';

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log('MongoDB SystemConfig updated with final v1.2.2.18 bundle checksum!');
  await mongoose.disconnect();
}

run().catch(console.error);
