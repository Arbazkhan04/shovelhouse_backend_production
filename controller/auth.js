const User = require("../models/User");
const Job = require("../models/Job");
const { StatusCodes } = require("http-status-codes");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { BadRequestError } = require("../errors");
const sendEmail = require("../utlis/sendEmail.js");
const crypto = require("crypto");
const { UnauthenticatedError } = require("../errors");
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
  upload.single("image")(req, res, async (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    try {
      const userId = uuidv4();
      const imageName = `${userId}.jpg`;
      let imageUrl;

      // Check if an image was uploaded
      if (req.body.image) {
        const base64Data = req.body.image.replace(
          /^data:image\/\w+;base64,/,
          ""
        );
        const buffer = Buffer.from(base64Data, "base64");

        const uploadParams = {
          Bucket: S3_BUCKET,
          Key: imageName,
          Body: buffer,
          ContentType: req.file ? req.file.mimetype : "image/jpeg", // Fallback content type
        };

        const command = new PutObjectCommand(uploadParams);
        await s3.send(command);

        imageUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${imageName}`;
      }

      // Create the user in the database, including the imageUrl
      //check if user role is shvoeller and refferal code is valid
      const user = {};
      if (req.body.userRole === "shoveller" && req.body.referredBy) {
        //check referral code is validrs
        const referredBy = await User.find({ referralCode: req.body.referredBy });
        if (referredBy.length === 0) {
          return res.status(200).json({ error: "Invalid referral code" });
        } else {
          const shoveller = {
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            userRole: req.body.userRole,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            userName: req.body.userName,
            phone: req.body.phone,
            address: req.body.address,
            servicesProvide: req.body.servicesProvide,
            stripeAccountId: req.body.stripeAccountId,
            chargesEnabled: req.body.chargesEnabled,
            reason: req.body.reason,
            stripeAccountStatus: req.body.stripeAccountStatus,
            imageUrl,
            referredBy: referredBy[0]._id,
          }
           user = await User.create(shoveller);
        }

      }
      else {
         user = await User.create({ ...req.body, imageUrl });
      }

      // Generate a JWT token
      const token = user.createJWT();

      // Send response based on user role
      if (user.userRole === "houseOwner") {
        res.status(StatusCodes.CREATED).json({
          user: {
            id: user._id,
            role: user.userRole,
          },
          token,
        });
      } else if (user.userRole === "shoveller") {
        res.status(StatusCodes.CREATED).json({
          user: {
            id: user._id,
            role: user.userRole,
            chargesEnabled: user.chargesEnabled,
            stripeAccountId: user.stripeAccountId,
          },
          token,
        });
      } else if (user.userRole === "admin") {
        res.status(StatusCodes.CREATED).json({
          user: {
            id: user._id,
            role: user.userRole,
          },
          token,
        });
      } else {
        res.status(200).json({ error: "Invalid user role" });
      }
    } catch (err) {
      res
        .status(200)
        .json({ error: "Invalid User Data", message: err.message });
    }
  });
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError("Please provide email and password");
    }
    const user = await User.findOne({ email });
    if (!user) {
      throw new UnauthenticatedError("Invalid Credential");
    }
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      throw new UnauthenticatedError("Invalid Credentials");
    }
    // compare password
    const token = user.createJWT();
    // Send response based on user role
    if (user.userRole === "houseOwner") {
      //search on job as well to get the job details
      const isJobPostedByHouseOwner = await Job.find({
        houseOwnerId: user._id,
        $or: [{ jobStatus: "open" }, { jobStatus: "in progress" }],
      });

      //check houseowner job posted status
      if (isJobPostedByHouseOwner.length > 0) {
        const job = isJobPostedByHouseOwner[0]; // Access the first job in the array
        res.status(StatusCodes.CREATED).json({
          user: {
            jobId: job._id,
            id: user._id,
            role: user.userRole,
            paymentOffering: job.paymentInfo.amount,
            jobStatus: job.jobStatus,
            paymentStatus: job.paymentInfo.status,
          },
          token,
        });
      } else {
        res.status(StatusCodes.CREATED).json({
          user: {
            id: user._id,
            role: user.userRole,
          },
          token,
        });
      }
    } else if (user.userRole === "shoveller") {
      res.status(StatusCodes.CREATED).json({
        user: {
          id: user._id,
          role: user.userRole,
          chargesEnabled: user.chargesEnabled,
          stripeAccountId: user.stripeAccountId,
          latitude: user.latitude,
          longitude: user.longitude,
        },
        token,
      });
    } else if (user.userRole === "admin") {
      res.status(StatusCodes.CREATED).json({
        user: {
          id: user._id,
          role: user.userRole,
        },
        token,
      });
    }
  } catch (error) {
    return res.status(200).json({ error: error.message });
    // console.log(error);
    // next(error);
  }
};

const getAllUsers = async (req, res) => {
  const users = await User.find({}).sort("createdAt");
  res.status(StatusCodes.OK).json({ users, count: users.length });
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      throw new BadRequestError("No user with this email address");
    }

    // Generate and get reset password token
    const resetToken = user.getResetPasswordToken();

    // Save the user with the reset token and expiration time
    await user.save();

    // Create reset URL
    const resetUrl = `http://localhost:3000/resetPassword/${resetToken}`;

    const message = `
    You requested a password reset. Please click on the link below to reset your password:
    ${resetUrl}
  `;

    // Define HTML content for the email
    const htmlContent = `
  <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; font-size: 16px; color: #333; }
        .header { background-color: #f8f8f8; padding: 20px 5px; text-align: center; }
        .content { padding: 20px 5px; }
        .footer { background-color: #f8f8f8; padding: 20px 5px; text-align: center; font-size: 14px; }
        .btn-reset { background-color: #4bcc5a; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
        .password-header { font-weight: 700; font-size: 30px; }
      </style>
    </head>
    <body>
      <div class="header">
        <p class="password-header">Reset your password</p>
      </div>
      <div class="content">
        <p>We heard you need a password reset. Click the link below to reset your password:</p>
        <p style="text-align: center; margin: 50px 0;">
          <a href="${resetUrl}" class="btn-reset" style="color: #fff;">Reset Password</a>
        </p>
        <p>If you did not request this password change, you can safely ignore this email. The link will expire in 10 minutes.</p>
      </div>
      <div class="footer">
        <p>Shovel-House</p>
      </div>
    </body>
  </html>
`;

    // Send the email with the HTML content
    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html: htmlContent, // Send HTML content here
      });

      res.status(StatusCodes.OK).json({ success: true, data: "Email sent" });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;

      await user.save();

      throw new BadRequestError(error.message);
    }
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(req.params.resetToken)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.json({ err: 'Invalid or expired token' });
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    await user.save();

    res
      .status(StatusCodes.OK)
      .json({ success: true, data: "Password reset successful" });
  } catch (err) {
    next(err);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const user = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      throw new BadRequestError("No user found with this ID");
    }
    res.status(StatusCodes.OK).json({ user });
  } catch (error) {
    next(error);
  }
};

const searchUsers = async (req, res, next) => {
  try {
    const users = await User.find(req.body);
    if (!users) {
      throw new BadRequestError("No users found");
    }
    res.status(StatusCodes.OK).json({ users });
  } catch (error) {
    next(error);
  }
};

const changeUserStatus = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      userId,
      { status: status },
      {
        new: true,
        runValidators: true,
      }
    );
    if (!user) {
      throw new BadRequestError("No user found with this ID");
    }
    res.status(StatusCodes.OK).json({ user });
  }
  catch (err) {
    next(err);
  }
}

// this will be returning a json with {shovelerDetails, statistics}
const getAllShovelersInfo = async (req, res, next) => {
  try {
    // Step 1: Fetch all shovelers from the User schema
    const shovelers = await User.find({ userRole: 'shoveller' });
    
    if (!shovelers) {
      throw new BadRequestError("No shovelers found");
    }

    // Step 2: Iterate over each shoveler and gather their statistics from the Job schema
    const shovelerInfoPromises = shovelers.map(async (shoveler) => {
      // Find all jobs where the shoveler was involved
      const jobs = await Job.find({ "ShovelerInfo.ShovelerId": shoveler._id });

      // Calculate job statistics
      const totalJobs = jobs.length;
      const completedJobs = jobs.filter(job => job.jobStatus === 'completed').length;
      const canceledJobs = jobs.filter(job => job.ShovelerInfo.some(info => info.shovellerAction === 'canceled')).length;
      const totalPayments = jobs.reduce((total, job) => job.jobStatus === 'completed' ? total + job.paymentInfo.amount: 0, 0);
      const averagePrice = totalPayments / completedJobs;
      const averageRating = jobs.reduce((total, job) => job.jobRating ? total + job.jobRating : total, 0) / completedJobs;

      // Construct the response object for the current shoveler
      return {
        shovelerDetails: shoveler, // Complete shoveler schema details
        statistics: {
          totalJobs,
          completedJobs,
          canceledJobs,
          totalPayments,
          averagePrice,
          averageRating
        }
      };
    });

    // Step 3: Wait for all the promises to resolve
    const shovelersInfo = await Promise.all(shovelerInfoPromises);

    // Step 4: Send the response
    res.status(StatusCodes.OK).json({ shovelers: shovelersInfo });
  } catch (err) {
    next(err);
  }
};


const get_Shovelers_With_Probation_Completed = async (req, res, next) => {
  try {
    const users = await User.find({ probation: false, jobCount : { $gte: 10 } });
    if (!users) {
      throw new BadRequestError("No users found");
    }
    res.status(StatusCodes.OK).json({ users });
  } catch (error) {
    next(error);
  }
}

const mark_Shoveler_Probation = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const user = await User.findByIdAndUpdate(
      userId,
      { probation: true },
      {
        new: true,
        runValidators: true,
      }
    );
    if (!user) {
      throw new BadRequestError("No user found with this ID");
    }
    res.status(StatusCodes.OK).json({ user });
  }
  catch (err) {
    next(err);
  }
}

const get_Shoveler_referral_code = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      throw new BadRequestError("No user found with this ID");
    }
    res.status(StatusCodes.OK).json({ referralCode: user.referralCode });
  }
  catch (err) {
    next(err);
  }
}

const sendRefererPayment = async (req, res, next) => {
  try {
    const { id: userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      throw new BadRequestError("No user found with this ID");
    }
    const referredBy = await User.findById(user.referredBy);
    if (!referredBy) {
      throw new BadRequestError("referredBy user not found");
    }

    // Send payment to the referredBy user and check if the paymet method is valid
    if(referredBy.chargesEnabled && referredBy.stripeAccountId) {
      // Send payment to the referredBy user
      // Code to send payment to the referredBy user
      res.status(StatusCodes.OK).json({ referredBy: referredBy });
    }
    else {
      throw new BadRequestError("referredBy user does not have a valid payment method");
    }
  }
  catch (err) {
    next(err);
  }
}




module.exports = {
  register,
  login,
  forgotPassword,
  getAllUsers,
  resetPassword,
  updateUser,
  searchUsers,
  changeUserStatus,
  get_Shovelers_With_Probation_Completed,
  mark_Shoveler_Probation,
  get_Shoveler_referral_code,
  sendRefererPayment,
  getAllShovelersInfo
};
