const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  jobId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Job' },
  clientId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  providerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' },
  messages: [messageSchema]
});

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
