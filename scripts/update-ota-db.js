const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  let config = await SystemConfig.findOne({ key: "default" });
  if (!config) {
    config = await SystemConfig.create({ key: "default" });
  }
  
  const targetVer = '1.2.2.92';
  const checksum = 'd1896e908aba4c88d18a1a90004d55e823679172176a97328baab47f0fe626bb';
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
  config.otaUpdates.notes = 'HostelCare v1.2.2.92: Fix dropdown stacking, badges, user card actions, and targetAudience all devices';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.targetAudience = 'all';
  config.appVersion.isSuspended = false;
  config.appVersion.targetedRegistrationNumbers = [];
  config.appVersion.targetedRoles = [];
  config.appVersion.targetedHostels = [];
  config.appVersion.forceUpdate = true;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.92: Mobile UI optimization & stability patch';

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log(`MongoDB SystemConfig updated with target v${targetVer} bundle checksum: ${checksum} (targetAudience: all)`);
  await mongoose.disconnect();
}

run().catch(console.error);
