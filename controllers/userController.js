const mongoose = require('mongoose');
const User = require('../models/User');
const Group = require('../models/Group');
const Post = require('../models/Post');

exports.register = async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        const password = (req.body.password || '').trim();
        const fullName = (req.body.fullName || '').trim();
        const city = (req.body.city || '').trim();
        const age = req.body.age ? Number(req.body.age) : undefined;

        if (username.length < 3 || username.length > 20 || username.includes(' ')) {
            return res.status(400).json({ error: 'Username must be 3-20 characters without spaces' });
        }
        if (password.length < 3) {
            return res.status(400).json({ error: 'Password must be at least 3 characters' });
        }
        if (age !== undefined && (isNaN(age) || age < 13 || age > 120)) {
            return res.status(400).json({ error: 'Age must be a number between 13 and 120' });
        }

        const exists = await User.findOne({ username: username });
        if (exists) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        const user = new User({ username, password, fullName, city, age });
        await user.save();

        req.session.user = { _id: user._id.toString(), username: user.username, isAdmin: user.isAdmin };
        res.status(201).json(req.session.user);
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
};

exports.login = async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        const password = (req.body.password || '').trim();

        if (username === '' || password === '') {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await User.findOne({ username: username, password: password });
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        req.session.user = { _id: user._id.toString(), username: user.username, isAdmin: user.isAdmin };
        res.json(req.session.user);
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy();
    res.json({ success: true });
};

exports.me = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).select('-password');
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Could not load profile' });
    }
};

exports.list = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Could not load users' });
    }
};

exports.search = async (req, res) => {
    try {
        const { username, city, minAge, maxAge } = req.query;
        const query = {};

        if (username) query.username = new RegExp(username, 'i');
        if (city) query.city = new RegExp(city, 'i');
        if (minAge || maxAge) {
            query.age = {};
            if (minAge) query.age.$gte = Number(minAge);
            if (maxAge) query.age.$lte = Number(maxAge);
        }

        const users = await User.find(query).select('-password').sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(400).json({ error: 'Invalid search' });
    }
};

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        if (id !== req.session.user._id && !req.session.user.isAdmin) {
            return res.status(403).json({ error: 'You can only edit your own profile' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const age = req.body.age ? Number(req.body.age) : undefined;
        const password = (req.body.password || '').trim();

        if (age !== undefined && (isNaN(age) || age < 13 || age > 120)) {
            return res.status(400).json({ error: 'Age must be a number between 13 and 120' });
        }
        if (password !== '' && password.length < 3) {
            return res.status(400).json({ error: 'Password must be at least 3 characters' });
        }

        user.fullName = (req.body.fullName || '').trim();
        user.city = (req.body.city || '').trim();
        user.age = age;
        if (password !== '') {
            user.password = password;
        }
        await user.save();

        const updated = await User.findById(id).select('-password');
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: 'Update failed' });
    }
};

exports.remove = async (req, res) => {
    try {
        const id = req.params.id;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }
        const isMe = id === req.session.user._id;
        if (!isMe && !req.session.user.isAdmin) {
            return res.status(403).json({ error: 'You can only delete your own account' });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const myGroups = await Group.find({ adminUser: user.username });
        for (const group of myGroups) {
            await Post.deleteMany({ groupName: group.name });
            await Group.findByIdAndDelete(group._id);
        }
        await Post.deleteMany({ author: user.username });
        await Group.updateMany({}, { $pull: { members: user.username } });
        await User.findByIdAndDelete(id);

        if (isMe) {
            req.session.destroy();
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
};
