const express = require('express');
const router = express.Router();

const { Checkout ,VerifyStatus} = require('../controller/Stripe-Checkout')

router.post('/checkout', Checkout);
router.post('/verifyStatus', VerifyStatus);

module.exports = router;