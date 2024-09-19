const express = require('express');
const router = express.Router();
const {history, sendMessage} = require('../controller/Message-Controller.js');

router.get('/:user1/:user2', history).post('/:user1/:user2', sendMessage);

module.exports = router;