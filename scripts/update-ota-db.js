const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  let config = await SystemConfig.findOne({ key: "default" });
  if (!config) {
    config = await SystemConfig.create({ key: "default" });
  }
  
  const targetVer = '1.2.2.89';
  const checksum = '4040f01b7c07326f7fec30a7eb1dfbd336c64043871a7a1130448250ce93c95f';
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
  config.otaUpdates.notes = 'HostelCare v1.2.2.89: Synchronized straight-descent circular wave theme reveal';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.89: Synchronized straight-descent circular wave theme reveal';
  config.appVersion.forceUpdate = false;

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log(`MongoDB SystemConfig updated with target v${targetVer} bundle checksum: ${checksum}`);
  await mongoose.disconnect();
}

run().catch(console.error);
