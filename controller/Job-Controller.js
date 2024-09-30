const Job = require('../models/Job');
const User = require('../models/User');
const { BadRequestError, NotFoundError } = require('../errors/index');
const { StatusCodes } = require('http-status-codes')


const getAllJobs = async (req, res) => {
  try {
    const jobs = await Job.find({}).sort('createdAt')
    res.status(StatusCodes.OK).json({ jobs, count: jobs.length })
  } catch (error) {
    throw new BadRequestError("invalid job data")
  }
}


const updateJobStatusForShovellerAcceptedJob = async (req, res) => {
  try {
    const { jobId, shovellerId,decision } = req.body;

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
    const jobs = await Job.find({ 'ShovelerInfo.ShovelerId': shovellerId });
    return res.status(200).json({ jobs });
  }catch(error){
    return res.status(500).json({ message: "Error getting the list of jobs" });
  }
}




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

module.exports = {
  getAllJobs,
  createJob,
  getJob,
  findJob,
  updateJob,
  updateJobStatusForShovellerAcceptedJob,
  updateHouseOwnerDecision,
  getListOfShovellerWhoAppliedOnJobs,
  getJobsInWhichShovllerApplied
}