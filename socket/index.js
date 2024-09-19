// socket.js
const socketIo = require('socket.io');
const Chat = require('../models/chat.js');

const configureSocket = (server) => {
    const io = socketIo(server, {
        cors: {
          origin: 'http://localhost:3000', // Allow your frontend to connect
          methods: ['GET', 'POST'],
          credentials: true
        }
      });

  io.on('connection', (socket) => {
    console.log('New user connected:', socket.id);

    // Join a specific chat room (based on jobId)
    socket.on('joinRoom', async ({ jobId }) => {
      socket.join(jobId);
      console.log(`User joined room: ${jobId}`);

      // Fetch previous chat messages from MongoDB when the user joins the room
      try {
        const chat = await Chat.findOne({ jobId }).populate('messages.senderId', 'name');
        if (chat) {
          // Emit the previous messages to the user who just joined
          socket.emit('previousMessages', chat.messages);
        }
      } catch (error) {
        console.error('Error fetching chat history:', error);
      }
    });

    // Handle sending a message via Socket.IO
    socket.on('sendMessage', async (data) => {
      const { jobId, senderId, message, clientId, providerId } = data;

      try {
        // Find the chat for the given job
        let chat = await Chat.findOne({ jobId });

        if (!chat) {
          // If no chat exists, create a new one
          chat = new Chat({
            jobId,
            clientId,
            providerId
          });
        }

        // Add the new message to the messages array
        chat.messages.push({
          senderId,
          message
        });

        // Save the updated chat in the database
        await chat.save();

        // Broadcast the new message to all users in the room
        io.to(jobId).emit('newMessage', {
          senderId,
          message,
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });

  return io;
};

module.exports = configureSocket;
