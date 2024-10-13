const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const querySchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    jobId: {
        type: Schema.Types.ObjectId,
        ref: 'Job',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    query: {
        type: String,
        required: true,
    },
    response : {
        type: [String],
        required: false,
    },
    status: {
        type: String,
        required: true,
        enum: ['open', 'closed', 'in-progress'],
        default: 'open'
    },
    createdAt: {
        type: Number,
        required: true,
        default: Date.now()
    },
    resolvedAt: {
        type: Number,
        required: false,
    }
})

module.exports = mongoose.model('Query', querySchema);
