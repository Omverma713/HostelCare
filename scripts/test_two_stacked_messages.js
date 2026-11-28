const mongoose = require('mongoose');

async function testStackedMessages() {
  await mongoose.connect(process.env.MONGODB_URI);
  const ChatTicket = require('../src/models/chatTicket.model');
  const User = require('../src/models/user.model');
  const { dispatchDevChatPushNotification } = require('../src/sockets/chatSocket');

  const ticket = await ChatTicket.findOne({ ticketId: 'TKT-085BBF' }).lean();
  const superAdmin = await User.findOne({ role: 'superadmin' }).lean();

  console.log('--- Sending Message 1 ---');
  await dispatchDevChatPushNotification(
    ticket,
    { id: 'msg_1_' + Date.now() },
    superAdmin,
    'text',
    'Message 1: Hello Om! First message arrived.'
  );

  console.log('Waiting 1.5 seconds...');
  await new Promise((r) => setTimeout(r, 1500));

  console.log('--- Sending Message 2 ---');
  await dispatchDevChatPushNotification(
    ticket,
    { id: 'msg_2_' + Date.now() },
    superAdmin,
    'text',
    'Message 2: Second message arrived and stacks underneath!'
  );

  console.log('Both messages dispatched without static tag replacement!');
  await mongoose.disconnect();
}

testStackedMessages().catch(console.error);
