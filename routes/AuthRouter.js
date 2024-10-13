const express = require('express')
const router = express.Router()
const { register, login, getAllUsers, getUserName,resetPassword, forgotPassword, searchUsers, updateUser, get_Shovelers_With_Probation_Completed
    , changeUserStatus, mark_Shoveler_Probation, get_Shoveler_referral_code, sendRefererPayment,
    getAllShovelersInfo
} = require('../controller/auth')
const { auth, authorizeRoles } = require('../middleware/authentication')


router.get('/', auth, authorizeRoles('admin'), getAllUsers)
// router.get('/', getAllUsers)

router.get('/searchUsers', auth, authorizeRoles('admin'), searchUsers)
router.get('/getAllShovelersInfo', auth, authorizeRoles('admin'), getAllShovelersInfo)
router.get('/getUserName/:userId', getUserName);
router.get('/get_Shoveler_referral_code/:id', get_Shoveler_referral_code)
router.get('/get_Shovelers_With_Probation_Completed', auth, authorizeRoles('admin'), get_Shovelers_With_Probation_Completed)
router.get('/sendRefererPayment/:id', sendRefererPayment)
router.patch('/mark_Shoveler_Probation/:id', auth, authorizeRoles('admin'), mark_Shoveler_Probation)

router.patch('/changeUserStatus/:id', auth, authorizeRoles('admin'), changeUserStatus)
router.patch('/updateUser/:id', auth, authorizeRoles('admin'), updateUser)

router.post('/register', register)
router.post('/login', login)

router.post('/forgotPassword', forgotPassword)
router.patch('/resetPassword/:resetToken', resetPassword)

module.exports = router