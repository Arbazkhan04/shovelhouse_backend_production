const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');

const Connect = (req, res) => {
    const userId = req.params.userId; // Get user ID from query parameters
    if (!userId) {
        return res.status(400).send('User ID is required.');
    }
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64'); // Encode userId in the state parameter

    const stripeOAuthUrl = `https://connect.stripe.com/oauth/authorize?response_type=code&client_id=${process.env.STRIPE_CLIENT_ID}&scope=read_write&state=${state}&redirect_uri=${process.env.STRIPE_REDIRECT_URI}`;
    res.json({ stripeUrl: stripeOAuthUrl });

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

        // Extract relevant account details
        const chargesEnabled = account.charges_enabled;
        const stripeAccountStatus = chargesEnabled ? 'enabled' : 'restricted';
        const reason = chargesEnabled ? null : getReasonFromRequirements(account.requirements);

        /// Update the user in your database
        const user = await User.findByIdAndUpdate(
            userId,
            {
                stripeAccountId,
                stripeAccountStatus,
                chargesEnabled,
                reason,
            },
            { new: true } // Return the updated user
        );

        // Check if the user exists
        if (user) {
            // Generate token (assuming you have a method to create it)
            const token = user.createJWT(); // Ensure you have a method to create a JWT token

            // Send a conditional response based on user role
            if (user.userRole === 'houseOwner') {
                res.status(StatusCodes.CREATED).json({ 
                    user: { id: user._id, role: user.userRole }, 
                    token 
                });
            } else if (user.userRole === 'shoveller') {
                res.status(StatusCodes.CREATED).json({ 
                    user: { id: user._id, role: user.userRole, chargesEnabled: user.chargesEnabled, stripeAccountId: user.stripeAccountId }, 
                    token 
                });
            } else if (user.userRole === 'admin') {
                res.status(StatusCodes.CREATED).json({ 
                    user: { id: user._id, role: user.userRole }, 
                    token 
                });
            }
        } else {
            res.status(404).json({ error: 'User not found.' });
        }
        
    } catch (error) {
        console.error('Error connecting to Stripe:', error); // Log error for debugging
        res.status(400).json({ error: `Error connecting to Stripe: ${error.message}` });
    }
}

// Helper function to extract the reason from account requirements
function getReasonFromRequirements(requirements) {
    if (requirements.currently_due.length > 0) {
        return 'Additional information is required to enable charges.';
    }
    if (requirements.errors.length > 0) {
        return 'There were errors with your account setup.';
    }
    if (requirements.past_due.length > 0) {
        return 'Some requirements are overdue.';
    }
    if (requirements.pending_verification.length > 0) {
        return 'Your account is pending verification.';
    }
    return 'Charges are not enabled for an unspecified reason.';
}



module.exports = {
    Connect,
    StripeCallback
}