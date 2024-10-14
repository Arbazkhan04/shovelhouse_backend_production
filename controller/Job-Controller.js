const Job = require('../models/Job');
const User = require('../models/User');
const { BadRequestError, NotFoundError } = require('../errors/index');
const { StatusCodes } = require('http-status-codes')
const sendEmail = require("../utlis/sendEmail.js");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const getAllJobs = async (req, res) => {
  try {
    // Find all jobs with status 'open' and not 'in-progress', and populate house owner's name
    const jobs = await Job.find({})
      .populate({
        path: 'houseOwnerId',
        select: 'name imageUrl', // Choose fields to return from the User schema
      })
      .sort('createdAt');

    res.status(StatusCodes.OK).json({ jobs, count: jobs.length });
  } catch (error) {
    throw new BadRequestError('Invalid job data');
  }
};



const updateJobStatusForShovellerAcceptedJob = async (req, res) => {
  try {
    const { jobId, shovellerId, decision } = req.body;

    // Check if jobId and shovellerId are provided
    if (!jobId || !shovellerId || typeof decision !== 'boolean') {
      return res.status(400).json({ message: "Job ID and Shoveller ID and decision are required." });
    }

    // Check if the shoveller already exists in the ShovelerInfo array
    const existingShoveller = await Job.findOne({
      _id: jobId,
      'ShovelerInfo.ShovelerId': shovellerId
    });

    if (existingShoveller) {
      return res.status(400).json({ message: "Shoveller is already associated with this job." });
    }

    // Add the new shoveller to the job
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      {
        $push: {
          ShovelerInfo: {
            ShovelerId: shovellerId,
            shovellerAction: decision ? 'accepted' : 'canceled',   // Default acceptance by shoveller
            houseOwnerAction: 'pending', // Use the enum for house owner's decision
          }
        }
      },
      { new: true, upsert: false } // Do not create a new job if it doesn't exist
    );

    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found." });
    }

    return res.status(200).json({ message: "Shoveller added successfully", job: updatedJob });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error adding the shoveller to the job", error: error.message });
  }
};


const getListOfShovellerWhoAppliedOnJobs = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Find the job with the given id
    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Get the list of shovellers who applied on the job
    const shovellers = job.ShovelerInfo;

    if (!shovellers || shovellers.length === 0) {
      return res.status(200).json([]); // Send empty array
    }

    // Get all shovellers from User schema who applied on this job
    const shovellersList = await User.find({
      _id: { $in: shovellers.map((shoveller) => shoveller.ShovelerId) }
    }).select('_id userName'); // Only select _id and userName

    // Combine the shoveller info from User with houseOwnerAction and scheduledTime from job
    const response = shovellersList.map((shoveller) => {
      // Find the corresponding shoveller info
      const shovellerInfo = shovellers.find(s => s.ShovelerId.toString() === shoveller._id.toString());

      return {
        ...shoveller.toObject(), // Convert to plain object
        houseOwnerAction: shovellerInfo ? shovellerInfo.houseOwnerAction : null, // Get houseOwnerAction
        scheduledTime: job.scheduledTime // Include scheduledTime from the job
      };
    });

    return res.status(200).json({ shovellers: response });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error getting the list of shovellers" });
  }
};

      
      //get all jobs in which shovller has applied
const getJobsInWhichShovllerApplied = async (req, res) => {
  try {

      const { shovellerId } = req.params;

    // Find jobs where PayoutStatus is not 'paid' or doesn't exist
    const jobs = await Job.find({
      'ShovelerInfo.ShovelerId': shovellerId, // Match the specific shoveller
      $or: [
        { 'ShovelerInfo.PayoutStatus': { $ne: 'paid' } },  // PayoutStatus is not 'paid'
        { 'ShovelerInfo.PayoutStatus': { $exists: false } }  // PayoutStatus doesn't exist
      ]
    }).populate('houseOwnerId', 'name');

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
}


const getShovellerJobStatusAndShovellerName = async (req, res) => {
  try {
    const { jobId, shovellerId } = req.query;
    console.log(jobId, shovellerId);

    // Fetch the job and return only the specific ShovelerInfo object where ShovelerId matches
    const job = await Job.findOne({
      _id: jobId,
      'ShovelerInfo.ShovelerId': shovellerId // Match specific ShovelerId
    })
      .select({ 
        ShovelerInfo: { $elemMatch: { ShovelerId: shovellerId } }, // Only return the matching ShovelerInfo object
        isRequestedForCancel: 1 // Include isRequestedForCancel field
      })
      .populate({
        path: 'ShovelerInfo.ShovelerId', // Populate ShovelerId within the ShovelerInfo array
        select: 'name' // Select only the name field from the User schema
      });

    // If no job found or the shoveller is not associated with the job
    if (!job || !job.ShovelerInfo.length) {
      return res.status(404).json({ message: "Job not found or shoveller not associated with this job" });
    }

    // Since only the matching ShovelerInfo object is returned, we can directly use it
    const shovellerInfo = job.ShovelerInfo[0];

    // Return the shoveller's action (status), name, and isRequestedForCancel flag for this job
    return res.status(200).json({
      shovellerAction: shovellerInfo.shovellerAction,
      shovellerName: shovellerInfo.ShovelerId.name, // Assuming 'name' is in the User schema
      isRequestedForCancel: job.isRequestedForCancel // Returning the job's isRequestedForCancel field
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error getting the shoveller job status" });
  }
};


const createJob = async (req, res) => {
  try {
    req.body.houseOwnerId = req.params.houseOwnerId;
    const job = await Job.create({ ...req.body });
    const user = await User.findById(req.params.houseOwnerId); // Assuming you have a User model

    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Houseowner id not found in User" });
    }

    const token = user.createJWT();

    // Send response based on user role
    if (user.userRole === 'houseOwner') {
      return res.status(StatusCodes.CREATED).json({
        user: {
          jobId: job._id,
          id: user._id,
          role: user.userRole,
          paymentOffering: job.paymentInfo.amount,
          jobStatus: job.jobStatus,
          paymentStatus: job.paymentInfo.status
        },
        token
      });
    }

    // If the user is not a houseOwner
    return res.status(StatusCodes.BAD_REQUEST).json({ error: "Invalid job data && role" });

  } catch (err) {
    throw new BadRequestError("Invalid job data");
  }
}

const updateHouseOwnerDecision = async (req, res) => {
  try {

    const { jobId, shovellerId, decision } = req.body; // 'decision' will be true (accept) or false (reject)
    console.log(jobId, shovellerId, decision)

    // Prepare the update objectshovellerId
    const update = {
      $set: {
        'ShovelerInfo.$.houseOwnerAction': decision ? 'accepted' : 'canceled', // Update with houseowner's decision
      },
    };

    // If the decision is true, update the job status as well
    if (decision) {
      update.$set.jobStatus = 'in-progress'; // Update job status to 'in progress' if accepted
    }

    // Find the job and update the houseOwnerAccepted field for the shoveller
    const updatedJob = await Job.findOneAndUpdate(
      {
        _id: jobId,
        'ShovelerInfo.ShovelerId': shovellerId, // Match the specific ShovelerId in the array
      },
      update,
      { new: true }
    );

    if (!updatedJob) {
      return res.status(404).json({ message: "Job not found or Shoveller not associated with this job." });
    }

    // Find houseOwner
    const user = await User.findById(updatedJob.houseOwnerId);
    if (!user) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: "Houseowner id not found in User" });
    }
    const token = user.createJWT();

    return res.status(StatusCodes.CREATED).json({
      user: {
        jobId: updatedJob._id,
        shovellerId: shovellerId,
        houseOwnerId: updatedJob.houseOwnerId,
        role: "houseOwner",
        paymentOffering: updatedJob.paymentInfo.amount,
        jobStatus: updatedJob.jobStatus,
        paymentStatus: updatedJob.paymentInfo.status,
        // shovellerId: updatedJob.ShovelerInfo.ShovelerId,
      },
      token,
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error updating the job" });
  }
};


const feedbackByHouseOwner = async (req, res) => {
  const { jobId, jobRating, houseOwnerFeedback } = req.body;
  try {
    const job = await Job.findByIdAndUpdate(jobId, {
      jobRating,
      houseOwnerFeedback,
    }, { new: true });

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    return res.status(200).json({ message: "Feedback submitted successfully", job });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error submitting feedback" });
  }
}

// Mark the job as completed by shoveller or houseOwner
const markJobAsCompleted = async (req, res) => {
  const { jobId, shovellerId, role } = req.body;

  try {
    let updateAction = {};

    // Check if the role is 'shoveller'
    if (role === 'shoveller') {
      updateAction = {
        $set: {
          'ShovelerInfo.$.shovellerAction': 'completed',
        },
      };
    } else if (role === 'houseOwner') {
      // Check if the role is 'houseOwner'
      updateAction = {
        $set: {
          'ShovelerInfo.$.houseOwnerAction': 'completed',
          jobStatus: 'completed', // Update job status when houseOwner marks the job as completed
        },
      };
    } else {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Find and update the specific shoveller's action
    const job = await Job.findOneAndUpdate(
      {
        _id: jobId,
        'ShovelerInfo.ShovelerId': shovellerId,  // Match based on shoveller's ID
      },
      updateAction,
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ message: "Job or shoveller not found" });
    }
    const shoveller = await User.findById(shovellerId);
    const houseOwner = await User.findById(job.houseOwnerId); // Assuming you store houseOwnerId in the job

    // If houseOwner marks the job as completed
    if (role === 'houseOwner') {
      // Capture the payment
      const paymentIntent = await stripe.paymentIntents.capture(job.paymentIntentId);
      console.log('Payment captured:', paymentIntent);  // Log the payment intent

      // Update the payment status to 'capture'
      await Job.findByIdAndUpdate(jobId, { 'paymentInfo.status': 'capture' }, { new: true });

      // Retrieve the shoveller's Stripe account ID from the User model
      // const shoveller = await User.findById(shovellerId);
      if (!shoveller || !shoveller.stripeAccountId) {
        return res.status(404).json({ message: "Shoveller's Stripe account not found" });
      }

      const totalAmount = job.paymentInfo.amount; // 30 USD (amount you stored)
      const platformFee = 0.20 * totalAmount; // 20% platform charge
      const amountForShoveller = totalAmount - platformFee; // Amount to be sent to the shoveller


      try {
        // Transfer the payout to the shoveller in CAD
        const payout = await stripe.transfers.create({
          amount: Math.round(amountForShoveller), // amount in cents
          currency: 'cad', // Set the currency to CAD for the shoveller
          destination: shoveller.stripeAccountId, // Use the shoveller's Stripe account ID
        });

        // If the transfer is successful, update the job status
        await Job.findOneAndUpdate(
          {
            _id: jobId,
            'ShovelerInfo.ShovelerId': shovellerId  // Match based on the Shoveller's ID
          },
          {
            $set: {
              'ShovelerInfo.$.PayoutStatus': 'paid'  // Update the payout status for the matched shoveller
            }
          },
          { new: true }
        );
        console.log('Payout successful:', payout);

        // Increment the job count for the shoveller
        await User.findByIdAndUpdate(
          shovellerId,
          { $inc: { jobCount: 1 } }, // Increment jobCount by 1
          { new: true }
        );

        // Send an email to the shoveller
        // Define updated HTML content for the email
        const htmlContent = `
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; font-size: 16px; color: #333; }
      .header { background-color: #f8f8f8; padding: 20px 5px; text-align: center; }
      .content { padding: 20px 5px; }
      .footer { background-color: #f8f8f8; padding: 20px 5px; text-align: center; font-size: 14px; }
      .btn-reset { background-color: #4bcc5a; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
      .payment-header { font-weight: 700; font-size: 30px; color: #4bcc5a; }
      .payment-amount { font-weight: bold; font-size: 20px; }
      .highlight { color: #4bcc5a; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="header">
      <p class="payment-header">Congratulations! Your Payment is Complete</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We're excited to inform you that your payment for the completed job has been successfully transferred to your account. You have received a total of <span class="payment-amount">$${amountForShoveller / 100} CAD</span>.</p>
      <p>Thank you for providing excellent service! You can review the payment details in your Shovel-House account.</p>
      <p>If you have any questions, feel free to <a href="mailto:support@shovelhouse.com" class="highlight">contact our support team</a>.</p>
    </div>
    <div class="footer">
      <p>Thank you for being part of Shovel-House!</p>
      <p><strong>Shovel-House Team</strong></p>
    </div>
  </body>
</html>
`;

        await sendEmail({
          to: shoveller.email,
          subject: "Payment information for completed job",
          html: htmlContent, // Send HTML content here
        });
      } catch (error) {
        await Job.findOneAndUpdate(
          {
            _id: jobId,
            'ShovelerInfo.ShovelerId': shovellerId  // Match based on the Shoveller's ID
          },
          {
            $set: {
              'ShovelerInfo.$.PayoutStatus': 'failed'  // Update the payout status for the matched shoveller
            }
          },
          { new: true }
        );

        console.error('Error transferring to shoveller:', error.message);
      }

    }
    else if (role === 'shoveller') {
      // If shoveller marks the job as completed
      // Send an email to the house owner
      // Define HTML content for the houseowner email
      const yourPageLink = `http://localhost:3000/houseowner/serviceProgress`;
const htmlContentHouseOwner = `
<html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; font-size: 16px; color: #333; }
      .header { background-color: #f8f8f8; padding: 20px 5px; text-align: center; }
      .content { padding: 20px 5px; }
      .footer { background-color: #f8f8f8; padding: 20px 5px; text-align: center; font-size: 14px; }
      .btn { background-color: #4bcc5a; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-size: 16px; font-weight: bold; display: inline-block; }
      .job-status-header { font-weight: 700; font-size: 30px; color: #4bcc5a; }
      .highlight { color: #4bcc5a; font-weight: bold; }
    </style>
  </head>
  <body>
    <div class="header">
      <p class="job-status-header">Job Marked as Completed!</p>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>The job you posted has been marked as <span class="highlight">completed</span> by the shoveller. You can now review the work and either confirm the completion or raise a query if you believe the job is not done satisfactorily.</p>
      <p>To accept the job as complete or submit a request for further review, click the button below:</p>
      <p>
        <a href="${yourPageLink}" class="btn">Review Job Status</a>
      </p>
      <p>If you have any questions, feel free to <a href="mailto:support@shovelhouse.com" class="highlight">contact our support team</a>.</p>
    </div>
    <div class="footer">
      <p>Thank you for choosing Shovel-House!</p>
      <p><strong>Shovel-House Team</strong></p>
    </div>
  </body>
</html>
`;
  
        await sendEmail({
          to: houseOwner.email,
          subject: "Job marked as completed by the shoveller",
          html: htmlContentHouseOwner, // Send HTML content here
        });
    }

    // Return the updated job
    return res.status(200).json({ message: `${role} action updated`, job });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error updating the job" });
  }
};

//houseowner requested for cancel the job enable the cancle button for houseonwer
const houseOwnerRequestedForCancel = async (req, res) => {
  try {
    const { jobId } = req.body;

    // Use `await` to properly handle the async operation
    const job = await Job.findOneAndUpdate(
      { _id: jobId },
      { isRequestedForCancel: true },
      { new: true }
    ).lean(); // Use `.lean()` to get a plain JavaScript object instead of a Mongoose document

    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    // Return only the necessary job fields (avoiding circular references)
    return res.status(200).json({ message: "Job status updated to cancel requested", job });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error updating the job" });
  }
};


const cancelJob = async (req, res) => { 
  const { jobId, shovellerId } = req.body;

  try {
    // Find the job by jobId
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(200).json({ err: "Job not found" });
    }

    if(!job.paymentIntentId) {
      return res.status(200).json({ err: "No payment found for this job" });    
    }    // Check if the job is already completed
    if (job.jobStatus === 'completed') {
      return res.status(200).json({ err: "Job is already marked as completed" });
    }

    // Check if the specified shoveller is associated with the job
    const shoveller = job.ShovelerInfo.find(s => s.ShovelerId.toString() === shovellerId);
    if (!shoveller) {
      return res.status(200).json({ err: "Shoveller not found" });
    }

    // Check if the job is already completed by shoveller
    if (shoveller.shovellerAction === 'completed' && !job.isRequestedForCancel) {
      return res.status(200).json({ 
        err: "Shoveller already marked this job as completed. If you need assistance, please reach out to support."
      });
    }

    // Cancel the payment
    const cancellation = await stripe.paymentIntents.cancel(job.paymentIntentId);
    if (cancellation.status !== 'canceled') {
      return res.status(200).json({ err: "Failed to cancel payment" });
    }

    // Update the job status to 'canceled' and payment info
    const updatedJob = await Job.findByIdAndUpdate(jobId, 
      { 
        jobStatus: 'canceled',
        paymentInfo: { 
          ...job.paymentInfo, // Preserve other payment fields like 'amount', 'paymentMethod'
          status: 'canceled' 
        }
      },
      { new: true }
    );
    
    // Update the shoveller's action to 'canceled'
    await Job.updateOne(
      { 
        _id: jobId,
        'ShovelerInfo.ShovelerId': shovellerId 
      },
      { 
        $set: {
          'ShovelerInfo.$.houseOwnerAction': 'canceled',
        },
      }
    );

    //send eamil to shvoeller and hosueowenr regarding to the hob cancelation
    const shovellerEmail = await User.findById(shovellerId);
    const houseOwnerEmail = await User.findById(job.houseOwnerId);


    // Send an email to the shoveller with plain text
    const shovellerEmailContent = `Hello ${shovellerEmail.name},\n\nThe job has been canceled by the house owner. If you have any questions, please contact support.`;
    await sendEmail({
      to: shovellerEmail.email,
      subject: "Payment information for completed job",
      text: shovellerEmailContent, // Send HTML content here
    });

    // Send an email to the house owner with plain text
    const houseOwnerEmailContent = `
    Hello ${houseOwnerEmail.name},
    
    We hope this message finds you well.
    
    We would like to inform you that the job has been successfully canceled as per your request. We have processed the return of your payment, and the funds should be reflected in your account shortly.
    
    If you have any further questions or need assistance, please don't hesitate to reach out to our support team. We're here to help!
    
    Thank you for choosing our service, and we look forward to assisting you again in the future.
    
    Best regards,
    Shovel-House Team
    `;
        await sendEmail({
      to: houseOwnerEmail.email,
      subject: "Payment information for completed job",
      text: houseOwnerEmailContent, // Send HTML content here
    });

    return res.status(200).json({ message: "Job canceled successfully", job: updatedJob });
  
  } catch (error) {
    console.error(error); // Log the error for debugging
    return res.status(200).json({ err: "An error occurred while canceling the job" });
  }
}

// cancel the job if no shoveller has applied on his job and he requested for cancel
const cancelJobIfNoShovellerApplied = async (req, res) => {
  const { jobId } = req.body;
  try {
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(200).json({ err: "Job not found" });
    }
    if(job.ShovelerInfo.length > 0 && (job.jobStatus === 'in-progress' || job.jobStatus === 'completed' || job.status === 'canceled')) {
      return res.status(200).json({ err: `You cannot cancel this job becuase the job is already ${job.jobStatus}` });
    }

     // Ensure the paymentIntentId exists before attempting to cancel the payment
     if (!job.paymentIntentId) {
      return res.status(200).json({ err: "No payment found for this job" });
    }

    // Cancel the payment
    const cancellation = await stripe.paymentIntents.cancel(job.paymentIntentId);
    if (cancellation.status !== 'canceled') {
      return res.status(200).json({ err: "Failed to cancel payment" });
    }

    // Update the job status to 'canceled' and payment info
    const updatedJob =  await Job.findByIdAndUpdate(jobId, 
      { 
        jobStatus: 'canceled',
        paymentInfo: { 
          ...job.paymentInfo, // Preserve other payment fields like 'amount', 'paymentMethod'
          status: 'canceled' 
        }
      },
      { new: true }
    );

    const houseowner = await User.findById(job.houseOwnerId);

    const houseownerContent = `
    Hello ${houseowner.name},
    
    We hope this message finds you well.
    
    We would like to inform you that the job has been successfully canceled as per your request. We have processed the return of your payment, and the funds should be reflected in your account shortly.
    
    If you have any further questions or need assistance, please don't hesitate to reach out to our support team. We're here to help!
    
    Thank you for choosing our service, and we look forward to assisting you again in the future.
    
    Best regards,
    Shovel-House Team
    `;
      
    await sendEmail({
      to: houseowner.email,
      subject: "Payment information for completed job",
      text: houseownerContent, // Send HTML content here
    });

    return res.status(200).json({ message: "Job canceled successfully", job: updatedJob });
    

  } catch (error) {
    return res.status(200).json({ err: error.message });
  }
}


//revert the job into progress again if the houseonwe is not able to cancle the job and he requested for cancel
const markedJobAsUnCompleted = async (req, res) => {
  try {
    const { jobId, shovellerId } = req.body;
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(200).json({ err: "Job not found" });
    }
    // Check if the job is already completed by shoveller
    const shoveller = job.ShovelerInfo.find(s => s.ShovelerId.toString() === shovellerId);
    if (!shoveller) {
      return res.status(200).json({ err: "Shoveller not found" });
    }
    // set the status to uncompleted for the shveoller
    const updatedShoveller = await Job.findOneAndUpdate(
      {
        _id: jobId,
        'ShovelerInfo.ShovelerId': shovellerId,  // Match based on shoveller's ID
      },
      {
        $set: {
          'ShovelerInfo.$.shovellerAction': 'uncompleted',
        },
      },
      { new: true }
    );

    //return the updated job
    return res.status(200).json({ message: "Job status updated to un-completed", job: updatedShoveller });
  } catch (error) {
    console.log(error);
    return res.status(200).json({ message: "Error updating the job" });
  }

}



const getJob = async (req, res) => {
  const jobId = req.params.jobId

  const job = await Job.findOne({
    _id: jobId,
  })
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`)
  }
  res.status(StatusCodes.OK).json({ job })
}
// 35, -70

//  const findJob = async (req, res) => {
//     const {
//       query: { latitude, longitude },  // Get the latitude and longitude from the query params
//     } = req;

//     // Check if latitude and longitude are provided
//     if (!latitude || !longitude) {
//       throw new BadRequestError('Please provide latitude and longitude in the query params');
//     }

//     try {
//       // Perform geospatial query to find jobs near the given location
//       const jobs = await Job.aggregate([
//         {
//           $geoNear: {
//             near: {
//               type: 'Point',
//               coordinates: [parseFloat(longitude), parseFloat(latitude)],
//             },
//             distanceField: 'distance',  // The calculated distance will be stored in this field
//             spherical: true,  // Specify spherical geometry for Earth-like distances
//           },
//         },
//         { $limit: 20 },  // Limit results, you can adjust based on your requirements
//       ]);

//       if (!jobs || jobs.length === 0) {
//         throw new NotFoundError('No jobs found near the given location');
//       }

//       // Return the jobs sorted by proximity
//       res.status(StatusCodes.ACCEPTED).json({ jobs });
//     } catch (error) {
//       res.status(500).json({ message: 'Server error', error: error.message });
//     }
//   };


const findJob = async (req, res) => {
  const {
    query: { latitude, longitude },  // Get the latitude and longitude from the query params
  } = req;

  // Check if latitude and longitude are provided and valid
  if (!latitude || !longitude) {
    return res.status(400).json({ message: 'Please provide latitude and longitude in the query params' });
  }

  // Parse latitude and longitude to float and check validity
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ message: 'Invalid latitude or longitude value' });
  }

  try {
    // Perform geospatial query to find jobs near the given location
    const jobs = await Job.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [lon, lat], // Longitude first, then latitude
          },
          distanceField: 'distance',
          //maxDistance: 10000, // it will get jobs under 10km radius
          spherical: true,
        },
      },
      { $limit: 20 },
    ]);

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({ message: 'No jobs found near the given location' });
    }

    // Return the jobs sorted by proximity
    res.status(200).json({ jobs });
  } catch (error) {
    console.error('Error finding jobs:', error); // Add logging for debugging
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateJob = async (req, res) => {
  const { params: { jobId } } = req;

  try {
    const job = await Job.findByIdAndUpdate({ _id: jobId }, req.body, { new: true, runValidators: true })

    if (!job) {
      new NotFoundError(`No job with id ${jobId}`);
    }
    res.status(StatusCodes.OK).json({ job });

  } catch (error) {
    console.log('Error updating job:', error); // Add logging for debugging
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error', error: error.message });
  }
}

const getAllJobsInfo = async (req, res, next) => {
  try {
    // Step 1: Fetch all jobs from the jobs schema
    const jobs = await Job.find({});

    if (!jobs) {
      throw new BadRequestError("No jobs found");
    }

    // Step 2: Iterate over each job and gather their user info from the user schema
    const jobInfoPromises = jobs.map(async (job) => {
      const id = job.houseOwnerId
      const user = await User.findById({ _id: id });
      return {
        jobDetails: job,
        userDetails: user
      }
    });


    // Step 3: Wait for all the promises to resolve
    const jobsInfo = await Promise.all(jobInfoPromises);

    // Step 4: Send the response
    res.status(StatusCodes.OK).json({ jobs: jobsInfo });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllJobs,
  createJob,
  getJob,
  findJob,
  updateJob,
  updateJobStatusForShovellerAcceptedJob,
  updateHouseOwnerDecision,
  getListOfShovellerWhoAppliedOnJobs,
  getJobsInWhichShovllerApplied,
  markJobAsCompleted,
  cancelJob,
  markedJobAsUnCompleted,
  getAllJobsInfo,
  getShovellerJobStatusAndShovellerName,
  feedbackByHouseOwner,
  houseOwnerRequestedForCancel,
  cancelJobIfNoShovellerApplied
}