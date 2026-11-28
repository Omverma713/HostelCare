const mongoose = require('mongoose');
const SystemConfig = require('../src/models/systemConfig.model');

async function update() {
  await mongoose.connect(process.env.MONGODB_URI);
  const version = '1.2.2.105';
  const bundleUrl = 'https://hostelcare.live/ota-bundles/hostelcare-bundle-v1.2.2.105.zip';
  const checksum = 'f8ee97eb55bf3f6bc6969c9f916e0ca0ed6064a73cd2b0a48fea03262754dfa4';

  const doc = await SystemConfig.findOneAndUpdate(
    { key: 'default' },
    {
      $set: {
        'appVersion.latestVersion': version,
        'appVersion.forceUpdate': false,
        'appVersion.releaseNotes': 'WhatsApp-style Interactive Top Navbar Back Navigation and Mobile UI Layout Polish',
        'otaUpdates.enabled': true,
        'otaUpdates.currentBundleVersion': version,
        'otaUpdates.bundleUrl': bundleUrl,
        'otaUpdates.bundleChecksum': checksum,
        'otaUpdates.requiresNativeApk': false
      }
    },
    { returnDocument: 'after', upsert: true }
  );

  console.log('SUCCESS: SystemConfig default updated to', version);
  console.log('appVersion.latestVersion:', doc.appVersion?.latestVersion);
  console.log('otaUpdates.currentBundleVersion:', doc.otaUpdates?.currentBundleVersion);
  console.log('otaUpdates.bundleUrl:', doc.otaUpdates?.bundleUrl);
  console.log('otaUpdates.bundleChecksum:', doc.otaUpdates?.bundleChecksum);
  await mongoose.disconnect();
}

update().catch((err) => {
  console.error('ERROR updating SystemConfig:', err);
  process.exit(1);
});
