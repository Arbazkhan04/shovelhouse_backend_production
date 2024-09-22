const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Job = require('../models/Job');
const User = require('../models/User');
const {StatusCodes} = require('http-status-codes');
// POST route to create a checkout session with payment authorization
const Checkout = async (req, res) => {
    try {
        const { amount, jobId } = req.body; // Get jobId from request body

        // Convert amount to cents
        const amountInCents = amount; // Assuming amount is already in cents

        // Create a checkout session with manual capture
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Cleaning Service',
                        },
                        unit_amount: amountInCents,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            payment_intent_data: {
                capture_method: 'manual', // Authorize only, capture later
            },
            success_url: `http://localhost:3000/houseowner/stripeCheckout?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: 'http://localhost:3000/houseowner/stripeCheckout?canceled=true',
        });

        // Update the existing job with the new payment information
        const updatedJob = await Job.findByIdAndUpdate(
            jobId,
            {
                price: amountInCents,
                stripeSessionId: session.id,
            },
            { new: true } // Return the updated document
        );

        if (!updatedJob) {
            return res.status(404).send({ error: "Job not found" });
        }

        res.json({ id: session.id });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};


const VerifyStatus = async (req, res) => {
    const { sessionId } = req.body;

    try {
        const job = await Job.findOne({ stripeSessionId: sessionId });
        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        const user = await User.findById(job.houseOwnerId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const token = user.createJWT();
        return res.status(StatusCodes.CREATED).json({
            user: {
                jobId: job._id,
                id: user._id,
                paymentOffering: job.paymentInfo.amount,
                role: user.userRole,
                jobStatus: job.jobStatus,
                paymentStatus: job.paymentInfo.status
            },
            token
        });
    } catch (error) {
        console.error('Error fetching payment status:', error);
        res.status(500).json({ error: error.message });
    }
};



module.exports = { Checkout,VerifyStatus };
