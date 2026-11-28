const mongoose = require('mongoose');
const SystemConfig = require('../src/models/systemConfig.model');

async function update() {
  await mongoose.connect(process.env.MONGODB_URI);
  const version = '1.2.2.106';
  const bundleUrl = 'https://hostelcare.live/ota-bundles/hostelcare-bundle-v1.2.2.106.zip';
  const checksum = '98818ee3b7b6744e0211b02094454886ba11f07dcecf2b8bf04c3abfde15e731';

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
