const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Connect = (req, res) => {
    const state = 'random_strings'; // For security, ensure you generate a random state string.
    const stripeOAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&state=${state}&redirect_uri=${process.env.STRIPE_REDIRECT_URI}`;
    res.redirect(stripeOAuthUrl);
}


const StripeCallback = async (req, res) => {
    console.log("hello")
    const code = req.query.code; // The authorization code from Stripe

    try {
        // Exchange authorization code for an account token
        const response = await stripe.oauth.token({
            grant_type: 'authorization_code',
            code: code,
        });

        const stripeAccountId = response.stripe_user_id; // This is the connected account's ID
        // Save the stripeAccountId in your database, linked to the user

        res.send(`Account connected! Stripe Account ID: ${stripeAccountId}`);
    } catch (error) {
        res.status(400).send(`Error connecting to Stripe: ${error.message}`);
    }
}




module.exports = {
    Connect,
    StripeCallback
}