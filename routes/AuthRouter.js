const express = require('express')
const router = express.Router()
const { register, login, getAllUsers, resetPassword, forgotPassword } = require('../controller/auth')

router.get('/', getAllUsers)
router.post('/register', register)
router.post('/login', login)
router.post('/forgotPassword', forgotPassword)
router.patch('/resetPassword/:resetToken', resetPassword)

module.exports = router