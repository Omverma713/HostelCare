const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  let config = await SystemConfig.findOne({ key: "default" });
  if (!config) {
    config = await SystemConfig.create({ key: "default" });
  }
  
  const targetVer = '1.2.2.93';
  const checksum = '2be7398c371fccbf6f0c2876ad6346508e875eeb4dafef3646fe09b217a53064';
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
  config.otaUpdates.notes = 'HostelCare v1.2.2.93: Interactive 6-digit OTP verification with Emerald Green success & Crimson Red shake feedback';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.targetAudience = 'all';
  config.appVersion.isSuspended = false;
  config.appVersion.targetedRegistrationNumbers = [];
  config.appVersion.targetedRoles = [];
  config.appVersion.targetedHostels = [];
  config.appVersion.forceUpdate = true;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.93: Interactive real-time OTP box verification & visual validation feedback';

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log(`MongoDB SystemConfig updated with target v${targetVer} bundle checksum: ${checksum} (targetAudience: all)`);
  await mongoose.disconnect();
}

run().catch(console.error);
