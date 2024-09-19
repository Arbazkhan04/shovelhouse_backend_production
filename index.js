require("dotenv").config();
require("express-async-wrapper")
const express = require("express");
const cookiesParser = require('cookie-parser')
const connectDb = require('./db/connect.js')
const cors = require('cors')
const http = require('http'); // Import the HTTP library
const configureSocket = require('./socket/index.js'); // Import the Socket.IO configuration
require('./utlis/Scheduler.js')
 
const app = express();
const server = http.createServer(app);

// middlewares
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookiesParser())




// route
app.use('/api/auth', require('./routes/AuthRouter.js'));
// app.use('/api/chat', require('./middleware/authentication.js'), require('./routes/ChatsRouter.js'))
//app.use('/api/job', require('./middleware/authentication.js'), require('./routes/JobRouter.js'))
app.use('/api/job', require('./routes/JobRouter.js'))

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
    catch(err) {
        console.log(err);
    }
}
start()