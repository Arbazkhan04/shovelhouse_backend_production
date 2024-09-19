const Message = require('../models/chat.js');


const history = async (req, res) => { 
    const { user1, user2 } = req.params;
    try {
        const messages = await Message.find({
            $or: [
                { sender: user1, receiver: user2 },
                { sender: user2, receiver: user1 }
            ]
        }).sort({ timestamp: 1 });
        res.status(200).json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).send('Cannot retrieve history');
    }
}

const sendMessage = async (req, res) => { 
    const { user1, user2 } = req.params;
    const { message } = req.body;
    try {
        const newMessage = await Message.create({ user1, user2, message });
        res.status(201).json({ newMessage });
    } catch (err) {
        console.error(err);
        res.status(500).send('Message not saved');
    }
}

module.exports = {
    history,
    sendMessage
}