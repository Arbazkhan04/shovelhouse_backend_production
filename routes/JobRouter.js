const express = require('express')
const router = express.Router()
const { getAllJobsInfo, createJob, getAllJobs, getJob, findJob, updateJob, updateJobStatusForShovellerAcceptedJob, getListOfShovellerWhoAppliedOnJobs,updateHouseOwnerDecision,getJobsInWhichShovllerApplied, markJobAsCompleted,cancelJob, markedJobAsUnCompleted, getShovellerJobStatusAndShovellerName,feedbackByHouseOwner,houseOwnerRequestedForCancel,cancelJobIfNoShovellerApplied,isJobCompleted } = require('../controller/Job-Controller')
const { auth, authorizeRoles } = require('../middleware/authentication')

router.get('/getAllJobs', getAllJobs)
router.get('/findJob/:latitude/:longitude',auth,authorizeRoles('shoveller'), findJob)
router.post('/createJob/:houseOwnerId', createJob)
router.get('/getJob/:jobId', getJob)
router.patch('/updateJob/:jobId', updateJob);
router.post('/updateJobStatusForShovellerAcceptedJob', updateJobStatusForShovellerAcceptedJob);
router.post('/updateHouseOwnerDecision', updateHouseOwnerDecision);
router.get('/getListOfShovellerWhoAppliedOnJobs/:jobId', getListOfShovellerWhoAppliedOnJobs);
router.get('/getJobsInWhichShovllerApplied/:shovellerId', getJobsInWhichShovllerApplied);
router.post('/markJobAsCompleted',markJobAsCompleted);  //mark job as completed by house owner and shoveller as well if that is an houseowner then will capuutre the payement and payout to shoeveller as well
router.post('/cancelJob',cancelJob); //cancel job by house owner
router.post('/markedJobAsUnCompleted', markedJobAsUnCompleted); //mark job as uncompleted by admin
router.get('/getShovellerJobStatusAndShovellerName', getShovellerJobStatusAndShovellerName);
router.post('/feedbackByHouseOwner', feedbackByHouseOwner); //feedback by house owner
router.post('/houseOwnerRequestedForCancel', houseOwnerRequestedForCancel); //house owner requested for cancel the job
router.post('/cancelJobIfNoShovellerApplied', cancelJobIfNoShovellerApplied); //cancel job if no shoveller applied on it
router.post('/isJobCompleted', isJobCompleted); //check the job is completed or not

// admin
router.get('/getAllJobsInfo', auth, authorizeRoles('admin'), getAllJobsInfo)

module.exports = router