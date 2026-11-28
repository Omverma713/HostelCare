const mongoose = require('mongoose');

async function testRealChatFlow() {
  await mongoose.connect(process.env.MONGODB_URI);
  const ChatTicket = require('../src/models/chatTicket.model');
  const User = require('../src/models/user.model');
  const { dispatchDevChatPushNotification } = require('../src/sockets/chatSocket');

  const ticket = await ChatTicket.findOne({ ticketId: 'TKT-085BBF' }).lean();
  if (!ticket) {
    console.log('Ticket TKT-085BBF not found');
    await mongoose.disconnect();
    return;
  }

  // Super admin user sending reply to student
  const superAdmin = await User.findOne({ role: 'superadmin' }).lean();
  console.log(`Testing dispatchDevChatPushNotification from Super Admin: ${superAdmin.name} to Student: ${ticket.studentName}...`);

  await dispatchDevChatPushNotification(
    ticket,
    { id: 'test_msg_id' },
    superAdmin,
    'text',
    'Hey Om! WhatsApp-grade real-time chat notification is fully working!'
  );

  console.log('dispatchDevChatPushNotification executed successfully!');
  await mongoose.disconnect();
}

testRealChatFlow().catch(console.error);
