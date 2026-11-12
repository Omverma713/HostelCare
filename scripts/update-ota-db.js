const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  config.otaUpdates = config.otaUpdates || {};
  config.otaUpdates.enabled = true;
  config.otaUpdates.currentBundleVersion = '1.2.2.19';
  config.otaUpdates.bundleChecksum = 'd9ca2e04803b878353ebfe8243fa009ffabc429a73d3cbdd50a9012efcd3e52b';
  config.otaUpdates.bundleUrl = 'https://raw.githubusercontent.com/Omverma713/HostelCare/main/public/ota-bundles/hostelcare-bundle-v1.2.2.19.zip';
  config.otaUpdates.minNativeBuild = 28;
  config.otaUpdates.requiresNativeApk = false;

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = '1.2.2.19';
  config.appVersion.updateMessage = 'HostelCare v1.2.2.19: Multi-Format Timetable Engine (Image/PDF/Docs), Academic Calendar Quick Deck & Font Color Contrast Shield';

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log('MongoDB SystemConfig updated with final v1.2.2.18 bundle checksum!');
  await mongoose.disconnect();
}

run().catch(console.error);
