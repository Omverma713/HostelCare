const mongoose = require('mongoose');
require('dotenv').config();

const SystemConfig = require('../src/models/systemConfig.model');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  let config = await SystemConfig.findOne({ key: "default" });
  if (!config) {
    config = await SystemConfig.create({ key: "default" });
  }
  
  const targetVer = '1.2.2.85';
  const checksum = '81e512f58375385e84e17a97e73527a497d9439bf0bc46bd680368d37d311a5e';
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
  config.otaUpdates.notes = 'HostelCare v1.2.2.85: Left se upar rise, right se niche set celestial sun and moon theme transition';

  config.appVersion = config.appVersion || {};
  config.appVersion.latestVersion = targetVer;
  config.appVersion.updateMessage = 'HostelCare v1.2.2.85: Left rise, right set celestial sun and moon transition';
  config.appVersion.forceUpdate = false;

  config.markModified('otaUpdates');
  config.markModified('appVersion');
  await config.save();

  console.log(`MongoDB SystemConfig updated with target v${targetVer} bundle checksum: ${checksum}`);
  await mongoose.disconnect();
}

run().catch(console.error);
