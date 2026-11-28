const mongoose = require('mongoose');

async function testChatPush() {
  await mongoose.connect(process.env.MONGODB_URI);
  const DeviceRegistry = require('../src/models/deviceRegistry.model');
  const { sendPushToSessions } = require('../src/services/pushService');

  // Find Om Verma's device
  const omDevice = await DeviceRegistry.findOne({
    studentName: { $regex: /om verma/i },
    isActive: true,
    pushToken: { $ne: null }
  }).lean();

  if (!omDevice) {
    console.log('No active device found for Om Verma');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found device for Om Verma: ${omDevice.deviceId} with token: ${omDevice.pushToken.slice(0, 20)}...`);

  const payload = {
    title: '💬 HostelCare Support (Developer Line)',
    body: 'Acknowledged Om! WhatsApp-grade real-time chat notification test.',
    route: '/chat?ticketId=TKT-085BBF',
    channelId: 'hostelcare_custom_channel',
    data: {
      type: 'chat_message',
      ticketId: 'TKT-085BBF',
      senderName: 'HostelCare Support',
      route: '/chat?ticketId=TKT-085BBF',
      previewText: 'Acknowledged Om! WhatsApp-grade real-time chat notification test.'
    }
  };

  const report = await sendPushToSessions([
    {
      _id: omDevice.deviceId,
      pushToken: omDevice.pushToken,
      pushProvider: 'fcm'
    }
  ], payload);

  console.log('TEST CHAT PUSH REPORT:', JSON.stringify(report, null, 2));
  await mongoose.disconnect();
}

testChatPush().catch(console.error);
