const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  config.otaUpdates = config.otaUpdates || {};
  config.otaUpdates.enabled = true;
  config.otaUpdates.currentBundleVersion = '1.2.2.19';
  config.otaUpdates.bundleChecksum = 'b7dad6783449f6d919a6c42d6fe53c634b9c1f2a49d1d3bd5295d4a385a4ef6a';
  config.otaUpdates.bundleUrl = 'https://raw.githubusercontent.com/Omverma713/HostelCare/main/public/ota-bundles/hostelcare-bundle-v1.2.2.19.zip';
  config.otaUpdates.minNativeBuild = 28;
  config.otaUpdates.requiresNativeApk = false;

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = '1.2.2.19';
  config.appVersion.updateMessage = 'HostelCare v1.2.2.19: ITER Academics Hub, Class Timetable Engine & Exam Radar';

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log('MongoDB SystemConfig updated with final v1.2.2.18 bundle checksum!');
  await mongoose.disconnect();
}

run().catch(console.error);
