const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const UserSchema = new mongoose.Schema({

  userRole: {
    type: String,
    enum: ['admin', 'shoveller', 'houseOwner'],
    required: true
  },
  userName: {
    type: String,
    required: function() { return this.userRole !== 'admin'; }  // Required for shoveller and houseOwner
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: function() { return this.userRole !== 'admin'; }  // Required for shoveller and houseOwner
  },
  address: {
    type: String,
    required: function() { return this.userRole !== 'admin'; }  // Required for shoveller and houseOwner
  },
  password: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: function() { return this.userRole !== 'admin'; },  // Required for shoveller and houseOwner
  },
  neighborhood: {
    type: String,
    required: function() { return this.userRole === 'shoveller'; },  // Required only for shovellers
    default: undefined //keep empty is not provided
  },
  servicesProvide: {
    type: [String],
    required: function() { return this.userRole === 'shoveller'; },  // Required only for shovellers
    default: undefined //keep empty is not provided
  },
  serviceRequired: {
    type: [String],
    required: function() { return this.userRole === 'houseOwner'; }, // Required only for houseOwners
    default: undefined //keep empty is not provided
  },
  //reset password
  resetPasswordToken: String,          // Token to be used for password reset
  resetPasswordExpire: Date,           // Expiration time for the token

})

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return // Only hash if password field is modified
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

UserSchema.methods.createJWT = function () {
  return jwt.sign(
    { userId: this._id, name: this.userName },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_LIFETIME,
    }
  )
}

UserSchema.methods.comparePassword = async function (canditatePassword) {
  const isMatch = await bcrypt.compare(canditatePassword, this.password)
  return isMatch
}

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString('hex')

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex')

  // Set expire time (e.g., 10 minutes)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000

  return resetToken
}



module.exports = mongoose.model('User', UserSchema)
