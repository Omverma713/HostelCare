const mongoose = require('mongoose');
const SystemConfig = require('./src/models/systemConfig.model');

async function update() {
  await mongoose.connect(process.env.MONGODB_URI);
  const version = '1.2.2.101';
  const bundleUrl = 'https://hostelcare.live/ota-bundles/hostelcare-bundle-v1.2.2.101.zip';
  const checksum = '4ae42b4a308d6571e17f6e9e33b62189f927e6889fad22c8a0b71aa9ceff9e7f';

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
