const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 20 },
    password: { type: String, required: true, minlength: 3 },
    fullName: { type: String, trim: true, maxlength: 50, default: '' },
    city: { type: String, trim: true, maxlength: 30, default: '' },
    age: { type: Number, min: 13, max: 120 },
    isAdmin: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
