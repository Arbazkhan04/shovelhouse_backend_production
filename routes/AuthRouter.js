const express = require('express')
const router = express.Router()
const { register, login, getAllUsers, resetPassword, forgotPassword } = require('../controller/auth')
const { auth, authorizeRoles } = require('../middleware/authentication')

router.get('/',auth,authorizeRoles('admin'), getAllUsers)
router.post('/register', register)
router.post('/login', login)
router.post('/forgotPassword', forgotPassword)
router.patch('/resetPassword/:resetToken', resetPassword)

module.exports = router