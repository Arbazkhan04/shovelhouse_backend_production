const express = require('express')
const router = express.Router()
const { register, login, getAllUsers, resetPassword, forgotPassword, searchUsers, updateUser} = require('../controller/auth')
const { auth, authorizeRoles } = require('../middleware/authentication')

router.get('/', auth, authorizeRoles('admin'), getAllUsers)
router.get('/searchUsers', auth, authorizeRoles('admin'), searchUsers)
router.patch('/updateUser/:id', auth, authorizeRoles('admin'), updateUser)
router.post('/register', register)
router.post('/login', login)
router.post('/forgotPassword', forgotPassword)
router.patch('/resetPassword/:resetToken', resetPassword)

module.exports = router