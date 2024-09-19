const cron = require('node-cron');
const Job = require('../models/Job.js');  
const connectDb = require('../db/connect.js')

connectDb(process.env.MONGO_URL);

// Function to delete jobs older than 24 hours and still open
const deleteOldOpenJobs = async () => {
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;  // 24 hours in milliseconds

  try {
    const result = await Job.updateMany({
      jobStatus: 'open',
      createdAt: { $lt: now - twentyFourHours }
    }, {jobStatus:'not-anymore'});

    console.log(`${result.deletedCount ? result.deletedCount : 0} old open jobs removed.`);
  } catch (err) {
    console.error('Error removing old open jobs:', err);
  }
};

// Schedule the task to run every hour
cron.schedule('0 * * * *', deleteOldOpenJobs);  // Runs at the start of every hour
