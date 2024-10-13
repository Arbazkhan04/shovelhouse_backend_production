const express = require('express');
const router = express.Router();
const {createQuery, getAllQueries, getQuery, filterQueries, closeQuery, updateQuery} = require('../controller/Query-Controller')
const { auth, authorizeRoles } = require('../middleware/authentication')


router.post('/createQuery', createQuery);
router.get('/getAllQueries', auth, authorizeRoles('admin'), getAllQueries);
router.get('/filterQueries', auth, authorizeRoles('admin'), filterQueries);
router.get('/getQuery/:id', auth, authorizeRoles('admin'), getQuery);
router.patch('/updateQuery/:id', auth, authorizeRoles('admin'), updateQuery);
router.patch('/closeQuery/:id', auth, authorizeRoles('admin'), closeQuery);


module.exports = router;