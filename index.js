require("dotenv").config();
//when you are in deveopement mode try to uncommend the above line 
//and when you are in production mode try to comment the above line

require("express-async-wrapper")
const express = require("express");
// const cookiesParser = require('cookie-parser')
const connectDb = require('./db/connect.js')
const cors = require('cors')
const bodyParser = require('body-parser')
const http = require('http'); // Import the HTTP library
const configureSocket = require('./socket/index.js'); // Import the Socket.IO configuration
const Job = require('./models/Job')
const User = require('./models/User')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
//require('./utlis/Scheduler.js')

const app = express();
const server = http.createServer(app);


// webhoool for stripe related to connect accounts
app.post('/webhook/connectaccounts', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    console.log('Received Stripe event:');
    const sig = req.headers['stripe-signature'];
    const endpointSecret = 'whsec_fG9eAhEmVkSI8EsTfz0f2QaHH76DuYnj';

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook error: ${err.message}`);
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    // Handle account.updated event
    if (event.type === 'account.updated') {
        console.log('Account updated event received:', event.data.object);
        const account = event.data.object;
        const stripeAccountId = account.id; // Get the Stripe account ID
        const chargesEnabled = account.charges_enabled;

        let reason = 'no reason detected';
        if (!chargesEnabled) {
            if (account.verification && account.verification.disabled_reason) {
                reason = `Charges are disabled due to verification issues: ${account.verification.disabled_reason}`;
            } else if (account.capabilities && account.capabilities.card_payments && account.capabilities.card_payments.state === 'inactive') {
                reason = 'Charges are disabled because card payments capability is inactive.';
            } else if (account.capabilities && account.capabilities.transfers && account.capabilities.transfers.state === 'inactive') {
                reason = 'Charges are disabled because transfers capability is inactive.';
            }
        }

        try {
            // Update the Shoveller's status in your database
            await User.updateOne(
                { stripeAccountId },
                {
                    stripeAccountStatus: chargesEnabled ? 'enabled' : 'restricted',
                    chargesEnabled,
                    reason
                }
            );
            console.log('Account status updated for Stripe Account ID:', stripeAccountId);
        } catch (error) {
            console.error('Error updating user status:', error);
            return res.status(500).send('Database update error');
        }

        return res.json({ success: chargesEnabled, message: reason });
    }

    // If no event is handled
    res.status(200).send(`Unhandled event type ${event.type}`);
});


// webhoool for stripe related to payment
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
    console.log('Received Stripe event:');
    const sig = req.headers['stripe-signature'];
    const endpointSecret = 'whsec_34WmFnqyyJgpCmcP2WYMErkplbWCJ3v6';

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook error: ${err.message}`);
        return res.status(400).send(`Webhook error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            // Store the paymentIntent ID and update paymentStatus
            await Job.updateOne(
                { stripeSessionId: session.id },
                {
                    $set: {
                        'paymentInfo.status': 'authorized',
                        paymentIntentId: session.payment_intent
                    }
                }
            );
            console.log('Payment status updated to authorized for session:', session.id);
        } catch (error) {
            console.log('Error updating payment status:', error);
        }
    }

    //handle stripe cancel event
    if (event.type === 'payment_intent.canceled') {
        const paymentIntent = event.data.object;

        try {
            const job = await Job.findOne({ paymentIntentId: paymentIntent.id });
            if (job) {
                await Job.updateOne(
                    { _id: job._id },
                    { paymentStatus: 'canceled' }
                );
                console.log(`Payment intent ${paymentIntent.id} was canceled.`);
            }
        } catch (error) {
            console.log('Error handling payment_intent.canceled:', error);
        }
    }


    res.json({ received: true });
});






// middlewares
app.use(cors({
    origin: ['https://shovel-house.vercel.app', 'https://shovel-house-b93eaebaf538.herokuapp.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH'], // Adjust methods as needed
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(cookiesParser())


// ---------------------- this is test card endpoint ----------------------
const createChargeToAddFunds = async (req, res) => {
    try {
        const charge = await stripe.charges.create({
            amount: 1099,
            currency: 'usd',
            source: 'tok_bypassPending', // Bypasses the pending balance step in test mode
          });
      console.log('Funds added to balance:', charge);
      return res.status(200).json({ message: 'Funds added to balance', charge });
    } catch (error) {
      console.log('Error adding funds:', error);
      return res.status(500).json({ message: 'Error adding funds', error });
    }
  };


  const reterieveBalance = async (req, res) => {
    try {
      const balance = await stripe.balance.retrieve();
      console.log('Balance retrieved:', balance);
      return res.status(200).json({ message: 'Balance retrieved', balance });
    } catch (error) {
      console.log('Error retrieving balance:', error);
      return res.status(500).json({ message: 'Error retrieving balance', error });
    }
  }

    app.get('/retrieve-balance', reterieveBalance);
  
  // Add funds route
  app.post('/add-funds', createChargeToAddFunds);
// ---------------------- this is test card endpoint ----------------------


// route
app.use('/api/auth', require('./routes/AuthRouter.js'));
// app.use('/api/chat', require('./middleware/authentication.js'), require('./routes/ChatsRouter.js'))
//app.use('/api/job', require('./middleware/authentication.js'), require('./routes/JobRouter.js'))
app.use('/api/job', require('./routes/JobRouter.js'))
app.use('/api/oauth', require('./routes/StripeConnect.js'));
app.use('/api/query', require('./routes/QueryRouter.js'));
app.use('/api/stripe', require('./routes/StripeCheckoutRouter.js'));

app.use(require('./middleware/not-found.js'));
app.use(require('./middleware/error-handler.js'));






// Socket.IO setup
const io = configureSocket(server); // Configure Socket.IO with the server

// server
const port = process.env.PORT || 3000;

const start = async () => {
    try {
        await connectDb(process.env.MONGO_URL);
        console.log('Database connected')
        server.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        })
    }
    catch (err) {
        console.log(err);
    }
}
start()