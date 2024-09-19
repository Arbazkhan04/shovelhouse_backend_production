const User = require('../models/User');
const { StatusCodes } = require('http-status-codes');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { BadRequestError } = require('../errors')
const sendEmail = require('../utlis/sendEmail.js')
const crypto = require('crypto')

// Initialize S3Client with credentials and region
const s3 = new S3Client({
  region: process.env.AWS_S3_REGION, // e.g., 'us-east-1'
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const S3_BUCKET = process.env.S3_BUCKET_NAME;

const storage = multer.memoryStorage();
const upload = multer({ storage });

const register = async (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      
      const userId = uuidv4();
      const imageName = `${userId}.jpg`;
      let imageUrl;

      // Check if an image was uploaded
      if (req.file) {
        // Create a PutObjectCommand to upload the image to S3
        const uploadParams = {
          Bucket: S3_BUCKET,
          Key: imageName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        };

        const command = new PutObjectCommand(uploadParams);
        await s3.send(command);

        imageUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${imageName}`;
      }

      // Create the user in the database, including the imageUrl
      const user = await User.create({ ...req.body, imageUrl });

      // Generate a JWT token
      const token = user.createJWT();

      res.status(StatusCodes.CREATED).json({ user: { name: user.userName }, token });
    } catch (err) {
      console.log('Error during user registration:', err);
      res.status(400).json({ error: 'Invalid User Data' });
    }
  });
};

const login = async (req, res) => {
    const { email, password } = req.body

    if (!email || !password) {
      throw new BadRequestError('Please provide email and password')
    }
    const user = await User.findOne({ email })
    if (!user) {
      throw new UnauthenticatedError('Invalid Credentials')
    }
    const isPasswordCorrect = await user.comparePassword(password)
    if (!isPasswordCorrect) {
      throw new UnauthenticatedError('Invalid Credentials')
    }
    // compare password
    const token = user.createJWT()
    res.status(StatusCodes.OK).json({ user: { name: user.name }, token })
  }


  const getAllUsers = async (req, res) => {
    const users = await User.find({}).sort('createdAt')
    res.status(StatusCodes.OK).json({ users, count: users.length })
  }


  const forgotPassword = async (req, res) => {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      throw new BadRequestError('No user with this email address')
    }

    // Generate and get reset password token
    const resetToken = user.getResetPasswordToken()

    // Save the user with the reset token and expiration time
    await user.save()

    // Create reset URL
    const resetUrl = `https://yourdomain.com/reset-password/${resetToken}`

    const message = `
    You requested a password reset. Please click on the link below to reset your password:
    ${resetUrl}
  `

    try {
      await sendEmail({
        to: user.email,
        subject: 'Password Reset Request',
        text: message,
      })
      
      res.status(StatusCodes.OK).json({ success: true, data: 'Email sent' })
    } catch (error) {
      user.resetPasswordToken = undefined
      user.resetPasswordExpire = undefined

      await user.save()

      throw new BadRequestError(error.message)
    }
  }

  const resetPassword = async (req, res) => {
    
    try {
      
      const resetPasswordToken = crypto.createHash('sha256').update(req.params.resetToken).digest('hex')

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      })

      if (!user) {
        throw new BadRequestError('Invalid or expired token')
      }

      // Set new password
      user.password = req.body.password
      user.resetPasswordToken = undefined
      user.resetPasswordExpire = undefined

      await user.save()

      res.status(StatusCodes.OK).json({ success: true, data: 'Password reset successful' })
    }
    catch (err) {
      res.status(500).json({ err: err.message })
      
    }
  }

  module.exports = {
    register,
    login,
    forgotPassword,
    getAllUsers,
    resetPassword,
  }