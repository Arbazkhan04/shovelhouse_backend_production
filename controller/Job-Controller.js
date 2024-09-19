const Job = require('../models/Job');
const { BadRequestError, NotFoundError } = require('../errors/index');
const {StatusCodes} = require('http-status-codes')


const getAllJobs = async (req, res) => {
   try {
    const jobs = await Job.find({ }).sort('createdAt')
    res.status(StatusCodes.OK).json({ jobs, count: jobs.length })
   } catch (error) {
    throw new BadRequestError("invalid job data")
   }
}
  

const createJob = async (req, res) => { 
    try {
        req.body.houseOwnerId = req.params.houseOwnerId;
        const job = await Job.create({...req.body});
        res.status(StatusCodes.CREATED).json({ job: job });
    }
    catch (err) {
        throw new BadRequestError("invalid job data")
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
    const job = await Job.findByIdAndUpdate({_id: jobId}, req.body, { new: true, runValidators: true })
    
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
  updateJob
  }