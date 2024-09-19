const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const jobSchema = new Schema({
  houseOwnerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  ShovelerInfo: {
    ShovelerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    acceptedAt: { 
      type: Number,  // Unix timestamp (in milliseconds)
      required: false,
    },
  },
  services: {
    type: [String],  // Array of services (strings)
    required: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],   // 'location.type' must be 'Point'
      required: true,
    },
    coordinates: {
      type: [Number],    // Array of numbers [longitude, latitude]
      required: true,
    }
  },
  scheduledTime: {
    type: Number,  // Unix timestamp (in milliseconds)
    required: true,
  },
  completionTime: {
    type: Number,  // Unix timestamp (in milliseconds)
    required: false,
  },
  paymentInfo: {
    amount: { type: Number, required: true },  // Total amount
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    method: { type: String, enum: ['stripe', 'paypal', 'applepay'], required: true },
  },
  jobStatus: {
    type: String,
    enum: ['open', 'in-progress', 'completed', 'not-anymore'],
    default: 'open',
    required: true,
  },
  jobRating: {
    type: Number,
    min: 1,
    max: 5,
    required: false,
  },
  ShovelerFeedback: {
    type: String,
    required: false,
  },
  houseOwnerFeedback: {
    type: String,
    required: false,
  },
  createdAt: {
    type: Number,  // Unix timestamp (in milliseconds)
    default: Date.now,  // Store current time in milliseconds
  },
  updatedAt: {
    type: Number,  // Unix timestamp (in milliseconds)
    default: Date.now,  // Store current time in milliseconds
  }
}, { timestamps: true });

// Middleware to automatically update `updatedAt` on save
jobSchema.pre('save', function(next) {
  this.updatedAt = Date.now();  // Update to current Unix timestamp (in milliseconds)
  next();
});

jobSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Job', jobSchema);
