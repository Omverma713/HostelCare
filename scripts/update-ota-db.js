const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  const targetVer = '1.2.2.74';
  const checksum = '9cce78ef5d74a5f8d3a7fb075d2056fbca932e3ee48188c82d24ee9a582b6f59';
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
  config.otaUpdates.notes = 'HostelCare v1.2.2.74: 5-minute validity for OTP/link and previous credentials invalidation on resend';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.74: 5-minute validity and strict resend invalidation';
  config.appVersion.forceUpdate = false;

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log(`MongoDB SystemConfig updated with target v${targetVer} bundle checksum: ${checksum}`);
  await mongoose.disconnect();
}

run().catch(console.error);
