const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User.js');

const Connect = (req, res) => {
    const userId = req.params.userId; // Get user ID from query parameters
    if (!userId) {
        return res.status(400).send('User ID is required.');
    }
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64'); // Encode userId in the state parameter

    const stripeOAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&state=${state}&redirect_uri=${process.env.STRIPE_REDIRECT_URI}`;
    res.redirect(stripeOAuthUrl);
}

const StripeCallback = async (req, res) => {
    console.log("hello")
    const code = req.query.code; // The authorization code from Stripe
    const state = req.query.state; // The state parameter from Stripe

    try {
        // Decode the state parameter
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        const userId = decodedState.userId; // Extract user ID

        // Exchange authorization code for an account token
        const response = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code,
        });

        const stripeAccountId = response.stripe_user_id; // This is the connected account's ID

        // Save the stripeAccountId in your database, linked to the user
        await User.updateOne({ _id: userId }, { stripeAccountId });

        res.send(`Account connected! Stripe Account ID: ${stripeAccountId}`);
    } catch (error) {
        res.status(400).send(`Error connecting to Stripe: ${error.message}`);
    }
}




module.exports = {
    Connect,
    StripeCallback
}