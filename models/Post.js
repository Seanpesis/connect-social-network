const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
    author: { type: String, required: true },
    groupName: { type: String, required: true },
    likes: { type: Number, default: 0, min: 0 },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Post', postSchema);
