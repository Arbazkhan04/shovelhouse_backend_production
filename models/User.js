const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

function generateReferralCode() {
  const referralCode = Math.floor(100000 + Math.random() * 900000);
  return referralCode.toString(); // Convert to string if needed
}

const UserSchema = new mongoose.Schema({

  userRole: {
    type: String,
    enum: ['admin', 'shoveller', 'houseOwner'],
    required: true
  },
  latitude: {
    type: Number,
    required: function () { return this.userRole === 'shoveller' },
  },
  longitude: {
    type: Number,
    required: function () { return this.userRole === 'shoveller' },
  },
  userName: {
    type: String,
    required: function() { return this.userRole !== 'admin'; }  // Required for shoveller and houseOwner
  },
  name:{
    type: String,
    required: function() { return this.userRole !== 'admin'; }  // Required for shoveller and house
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
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspend'],
    default: 'active'
  },
  // neighborhood: {
  //   type: String,
  //   required: function() { return this.userRole === 'shoveller'; },  // Required only for shovellers
  //   default: undefined //keep empty is not provided
  // },
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
  //stipe field for shoveller connect account in order to get details about him
  stripeAccountId: {
    type: String,
    required: function() { return this.userRole === 'shoveller' }, // Required only for shovellers
    // default: 'none' // Store Stripe account ID if applicable
  },
  stripeAccountStatus: {
    type: String,
    required: function() { return this.userRole === 'shoveller'; }, // Required only for shovellers
    enum: ['enabled', 'restricted', 'pending'],
    // default: 'pending' // Default status, change based on Stripe account status
  },
  chargesEnabled: {
    type: Boolean,
    required: function() { return this.userRole === 'shoveller'; }, // Required only for shovellers
    // default: false // Default to false, update based on Stripe account status
  },
  reason: {
    type: String,
    required: function() { return this.userRole === 'shoveller'; }, // Required only for shovellers
    // default: "User haven't setup stripe yet" // Store the reason if charges are not enabled
  },
  referralCode: {
    type: String,
    //required: function () { return this.userRole === 'shoveller'; }, // Required only for shovellers
    unique: true,
    default: null // Default to null to avoid "Path `referralCode` is required" error before generation
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function () { return this.userRole === 'shoveller'; }, // Required only for shovellers
    default: undefined //keep empty is not provided
  },
  probation: {
    type: Boolean,
    required: function() { return this.userRole === 'shoveller'; }, // Required only for shovellers
    default: false
  },
  jobCount: {
    type: Number,
    required: function() { return this.userRole === 'shoveller'; }, // Required only for shovellers
    default: 0
  },
  //reset password
  resetPasswordToken: String,          // Token to be used for password reset
  resetPasswordExpire: Date,           // Expiration time for the token

})


// Pre-save hook for generating referral code if needed
UserSchema.pre('save', async function (next) {
  if (this.userRole === 'shoveller' && !this.referralCode) {
    let uniqueCode = false;

    // Generate and check uniqueness of referral code
    while (!uniqueCode) {
      const newCode = generateReferralCode();

      // Check if the referral code already exists
      const existingUser = await this.constructor.findOne({ referralCode: newCode });
      if (!existingUser) {
        this.referralCode = newCode;
        uniqueCode = true;
      }
    }
  }

  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return // Only hash if password field is modified
  const salt = await bcrypt.genSalt(10)
  this.password = await bcrypt.hash(this.password, salt)
})

UserSchema.methods.createJWT = function () {
  return jwt.sign(
    { userId: this._id, name: this.userName,role: this.userRole },
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
