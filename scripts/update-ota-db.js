const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  config.otaUpdates = config.otaUpdates || {};
  config.otaUpdates.enabled = true;
  config.otaUpdates.currentBundleVersion = '1.2.2.18';
  config.otaUpdates.bundleChecksum = '435afa3c61a44d42ffc13ba07618acbb419c76c97c1e6eec25aac279ef1fd8ab';
  config.otaUpdates.bundleUrl = 'https://raw.githubusercontent.com/Omverma713/HostelCare/main/public/ota-bundles/hostelcare-bundle-v1.2.2.18.zip';
  config.otaUpdates.minNativeBuild = 28;
  config.otaUpdates.requiresNativeApk = false;

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = '1.2.2.18';
  config.appVersion.updateMessage = 'HostelCare v1.2.2.18: ITER Academics Hub, Class Timetable Engine & Exam Radar';

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log('MongoDB SystemConfig updated with final v1.2.2.18 bundle checksum!');
  await mongoose.disconnect();
}

run().catch(console.error);
