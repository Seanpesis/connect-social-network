const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true, minlength: 2, maxlength: 40 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    category: { type: String, required: true, enum: ['Sports', 'Music', 'Tech', 'Study', 'Travel', 'Food', 'Other'] },
    adminUser: { type: String, required: true },
    members: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
