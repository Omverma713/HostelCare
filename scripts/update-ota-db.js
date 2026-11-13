const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  const targetVer = '1.2.2.22';
  const checksum = '8eb9ad709dc7d5e1f5b0b3657f50e55a0009b554fb10349621c9b1b3d57cc7de';
  const newDeployId = 'dep_' + Date.now();

  config.otaUpdates = config.otaUpdates || {};
  config.otaUpdates.enabled = true;
  config.otaUpdates.currentBundleVersion = targetVer;
  config.otaUpdates.bundleChecksum = checksum;
  config.otaUpdates.bundleUrl = '/api/v1/app-version/ota-bundle';
  config.otaUpdates.deployId = newDeployId;
  config.otaUpdates.deployedAt = new Date();
  config.otaUpdates.minNativeBuild = 28;
  config.otaUpdates.requiresNativeApk = false;
  config.otaUpdates.forceUpdate = true;
  config.otaUpdates.notes = 'HostelCare v1.2.2.21: 1-Time Force Reload on New Deployment, 0% Reload on Swipe/Reopen, Cloud Vision OCR';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.21: 1-Time Force Reload on New Deployment, 0% Reload on Swipe/Reopen';
  config.appVersion.forceUpdate = true;

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log('MongoDB SystemConfig updated with final v1.2.2.18 bundle checksum!');
  await mongoose.disconnect();
}

run().catch(console.error);
