const mongoose = require('mongoose');

async function testStackedMessages() {
  await mongoose.connect(process.env.MONGODB_URI);
  const ChatTicket = require('../src/models/chatTicket.model');
  const User = require('../src/models/user.model');
  const { dispatchDevChatPushNotification } = require('../src/sockets/chatSocket');

  const ticket = await ChatTicket.findOne({ ticketId: 'TKT-085BBF' });
  const superAdmin = await User.findOne({ role: 'superadmin' }).lean();

  // Reset previews for test run
  ticket.unreadPreviews = [];
  await ticket.save();

  console.log('--- Sending Message 1: Hojaygaaaa ---');
  ticket.unreadPreviews.push('Hojaygaaaa');
  await ticket.save();
  await dispatchDevChatPushNotification(
    ticket,
    { id: 'msg_1_' + Date.now() },
    superAdmin,
    'text',
    'Hojaygaaaa'
  );

  console.log('Waiting 2 seconds...');
  await new Promise((r) => setTimeout(r, 2000));

  console.log('--- Sending Message 2: Ywrrrr (Appends to same card!) ---');
  ticket.unreadPreviews.push('Ywrrrr');
  await ticket.save();
  await dispatchDevChatPushNotification(
    ticket,
    { id: 'msg_2_' + Date.now() },
    superAdmin,
    'text',
    'Ywrrrr'
  );

  console.log('Waiting 2 seconds...');
  await new Promise((r) => setTimeout(r, 2000));

  console.log('--- Sending Message 3: Dw / Chill rhooo / 😉 ☝️ (Appends to same card!) ---');
  ticket.unreadPreviews.push('Dw');
  ticket.unreadPreviews.push('Chill rhooo');
  ticket.unreadPreviews.push('😉 ☝️');
  await ticket.save();
  await dispatchDevChatPushNotification(
    ticket,
    { id: 'msg_3_' + Date.now() },
    superAdmin,
    'text',
    '😉 ☝️'
  );

  console.log('All progressive messages dispatched to ONE single WhatsApp-style notification card!');
  await mongoose.disconnect();
}

testStackedMessages().catch(console.error);
