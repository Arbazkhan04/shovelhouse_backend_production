const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

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
    console.log("Stripe Callback Endpoint Hit");
    const code = req.query.code; // The authorization code from Stripe
    const state = req.query.state; // The state parameter from Stripe

    try {
        // Decode the state parameter
        const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
        const userId = decodedState.userId; // Extract user ID

        // Exchange authorization code for an access token
        const tokenResponse = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code,
        });

        console.log('Stripe OAuth Token Response:', tokenResponse);

        const stripeAccountId = tokenResponse.stripe_user_id; // This is the connected account's ID

        // Retrieve the connected account details
        const account = await stripe.accounts.retrieve(stripeAccountId);

        console.log('Stripe Account Details:', account);

        // Save the stripeAccountId in your database, linked to the user
        await User.updateOne({ _id: userId }, { stripeAccountId });

        res.send(`Account connected! Stripe Account ID: ${stripeAccountId}. Account details: ${JSON.stringify(account)}`);
    } catch (error) {
        console.error('Error connecting to Stripe:', error); // Log error for debugging
        res.status(400).send(`Error connecting to Stripe: ${error.message}`);
    }
}



module.exports = {
    Connect,
    StripeCallback
}