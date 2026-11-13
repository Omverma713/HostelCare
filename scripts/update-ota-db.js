const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const config = await SystemConfig.getEffectiveConfig();
  
  const targetVer = '1.2.2.40';
  const checksum = '7c757a1f721cf6cf272ccad71a8059e04184aa48e5a1dd71e685eeb450d866b8';
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
  config.otaUpdates.notes = 'HostelCare v1.2.2.40: Timetable UI redesign, Google AI mode button, borderless slot labels';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.40: Timetable redesign & Google AI scanner';
  config.appVersion.forceUpdate = false;

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log(`MongoDB SystemConfig updated with target v${targetVer} bundle checksum: ${checksum}`);
  await mongoose.disconnect();
}

run().catch(console.error);
