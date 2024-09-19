const express = require('express');
const router = express.Router();

const  { Connect,StripeCallback} = require('../controller/Stipe-Connect-Controller')

router.get('/connect', Connect);
router.get('/stripe/callback', StripeCallback);

module.exports = router;