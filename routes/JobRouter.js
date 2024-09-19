const express = require('express')
const router = express.Router()
const { createJob, getAllJobs, getJob, findJob, updateJob } = require('../controller/Job-Controller')


router.get('/getAllJobs', getAllJobs)
router.get('/findJob', findJob)
router.post('/createJob/:houseOwnerId', createJob)
router.get('/getJob/:jobId', getJob)
router.patch('/updateJob/:jobId', updateJob)
    

module.exports = router