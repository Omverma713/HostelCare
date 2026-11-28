const mongoose = require('mongoose');

async function broadcastOtaPush() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Session = require('./src/models/session.model');
  const DeviceRegistry = require('./src/models/deviceRegistry.model');
  const SystemConfig = require('./src/models/systemConfig.model');
  const { sendPushToSessions } = require('./src/services/pushService');

  const config = await SystemConfig.getEffectiveConfig();
  const latestVersion = config?.appVersion?.latestVersion || '1.2.2.103';
  const bundleUrl = config?.otaUpdates?.bundleUrl || 'https://hostelcare.live/ota-bundles/hostelcare-bundle-v1.2.2.103.zip';

  console.log(`[OTA-Push] Preparing OTA push broadcast for version ${latestVersion}...`);

  // Gather devices
  const devices = await DeviceRegistry.find({
    isActive: true,
    pushToken: { $ne: null }
  }).lean();

  // Gather sessions
  const sessions = await Session.find({
    isActive: true,
    $or: [
      { pushToken: { $ne: null } },
      { webPushSubscription: { $ne: null } }
    ]
  }).lean();

  console.log(`[OTA-Push] Found ${devices.length} registered device(s) and ${sessions.length} active session(s).`);

  const targets = [];
  const seenTokens = new Set();

  for (const d of devices) {
    if (d.pushToken && !seenTokens.has(d.pushToken)) {
      seenTokens.add(d.pushToken);
      targets.push({
        _id: d.deviceId || d._id,
        pushToken: d.pushToken,
        pushProvider: 'fcm'
      });
    }
  }

  for (const s of sessions) {
    if (s.pushToken && !seenTokens.has(s.pushToken)) {
      seenTokens.add(s.pushToken);
      targets.push({
        _id: s._id,
        pushToken: s.pushToken,
        pushProvider: s.pushProvider || 'fcm'
      });
    } else if (s.webPushSubscription && !s.pushToken) {
      targets.push({
        _id: s._id,
        webPushSubscription: s.webPushSubscription,
        pushProvider: 'webpush'
      });
    }
  }

  console.log(`[OTA-Push] Total unique push target(s): ${targets.length}`);

  if (targets.length === 0) {
    console.log('[OTA-Push] No registered push tokens found in DB yet. Users will auto-download on next app open.');
    await mongoose.disconnect();
    return;
  }

  const alertPayload = {
    title: `⚡ HostelCare Update Available (v${latestVersion})`,
    body: 'WhatsApp-style interactive navigation & chat polish are live! Tap to update.',
    data: {
      type: 'APP_UPDATE_NUDGE',
      route: '/student',
      latestVersion: latestVersion,
      bundleUrl: bundleUrl,
      otaAction: 'CHECK_UPDATE'
    }
  };

  const dispatchResult = await sendPushToSessions(targets, alertPayload);
  console.log('[OTA-Push] Dispatch Report:', JSON.stringify(dispatchResult, null, 2));

  await mongoose.disconnect();
}

broadcastOtaPush().catch((err) => {
  console.error('[OTA-Push] Failed:', err);
  process.exit(1);
});
