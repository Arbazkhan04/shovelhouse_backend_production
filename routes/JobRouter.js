const express = require('express')
const router = express.Router()
const { createJob, getAllJobs, getJob, findJob, updateJob } = require('../controller/Job-Controller')
const { auth, authorizeRoles } = require('../middleware/authentication')

router.get('/getAllJobs',auth,authorizeRoles('admin'), getAllJobs)
router.get('/findJob',auth,authorizeRoles('shoveller'), findJob)
router.post('/createJob/:houseOwnerId', createJob)
router.get('/getJob/:jobId', getJob)
router.patch('/updateJob/:jobId', updateJob)
    

module.exports = router