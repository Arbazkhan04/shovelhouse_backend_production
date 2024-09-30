const express = require('express')
const router = express.Router()
const { createJob, getAllJobs, getJob, findJob, updateJob, updateJobStatusForShovellerAcceptedJob, getListOfShovellerWhoAppliedOnJobs,updateHouseOwnerDecision,getJobsInWhichShovllerApplied } = require('../controller/Job-Controller')
const { auth, authorizeRoles } = require('../middleware/authentication')

router.get('/getAllJobs', getAllJobs)
router.get('/findJob',auth,authorizeRoles('shoveller'), findJob)
router.post('/createJob/:houseOwnerId', createJob)
router.get('/getJob/:jobId', getJob)
router.patch('/updateJob/:jobId', updateJob);
router.post('/updateJobStatusForShovellerAcceptedJob', updateJobStatusForShovellerAcceptedJob);
router.post('/updateHouseOwnerDecision', updateHouseOwnerDecision);
router.get('/getListOfShovellerWhoAppliedOnJobs/:jobId', getListOfShovellerWhoAppliedOnJobs);
router.get('/getJobsInWhichShovllerApplied/:shovellerId', getJobsInWhichShovllerApplied);


module.exports = router