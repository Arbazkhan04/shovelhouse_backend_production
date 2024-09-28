const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const responseSchema = new mongoose.Schema({
    response: {
        type: String,
        required: true,
    },
    timestamp: {
        type: Number,
        required: true,
        default: Date.now()
    }
})

const querySchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    query: {
        type: String,
        required: true,
    },
    response : {
        type: [responseSchema],
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
