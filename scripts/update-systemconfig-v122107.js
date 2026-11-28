const mongoose = require('mongoose');
const SystemConfig = require('./src/models/systemConfig.model');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const config = await SystemConfig.findOne();
  if (config) {
    if (!config.appVersion) config.appVersion = {};
    if (!config.otaUpdates) config.otaUpdates = {};
    config.appVersion.latestVersion = '1.2.2.107';
    config.otaUpdates.currentBundleVersion = '1.2.2.107';
    config.otaUpdates.bundleChecksum = '592ae8f9d008e47afa9469f1aaf8719a27f5a222881f0fedbf0e262364510e6f';
    config.otaUpdates.bundleUrl = 'https://hostelcare.live/ota-bundles/hostelcare-bundle-v1.2.2.107.zip';
    config.otaUpdates.forceUpdate = true;
    config.otaUpdates.enabled = true;
    await config.save();
    console.log('SystemConfig updated successfully to 1.2.2.107:', config.appVersion.latestVersion, config.otaUpdates.currentBundleVersion);
  }
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
