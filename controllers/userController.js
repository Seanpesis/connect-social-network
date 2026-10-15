const User = require('../models/User');
const Group = require('../models/Group');
const Post = require('../models/Post');
const { isValidId, escapeRegex, cleanText, toNumber } = require('../utils/helpers');

const publicFields = '-password -__v';

function sessionUser(user) {
    return { _id: user._id.toString(), username: user.username, isAdmin: user.isAdmin };
}

function validateProfile(fullName, city, age) {
    if (fullName.length > 50) return 'Full name is too long';
    if (city.length > 30) return 'City is too long';
    if (Number.isNaN(age)) return 'Age must be a number';
    if (age !== undefined && (age < 13 || age > 120)) return 'Age must be between 13 and 120';
    return null;
}

exports.register = async (req, res) => {
    try {
        const username = cleanText(req.body.username);
        const password = cleanText(req.body.password);
        const fullName = cleanText(req.body.fullName);
        const city = cleanText(req.body.city);
        const age = toNumber(req.body.age);

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
        }
        if (password.length < 3) {
            return res.status(400).json({ error: 'Password must be at least 3 characters' });
        }
        const profileError = validateProfile(fullName, city, age);
        if (profileError) return res.status(400).json({ error: profileError });

        const exists = await User.findOne({ username });
        if (exists) return res.status(409).json({ error: 'Username already taken' });

        const user = new User({ username, password, fullName, city, age });
        await user.save();
        req.session.user = sessionUser(user);
        res.status(201).json(req.session.user);
    } catch (err) {
        res.status(500).json({ error: 'Registration failed' });
    }
};

exports.login = async (req, res) => {
    try {
        const username = cleanText(req.body.username);
        const password = cleanText(req.body.password);
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const user = await User.findOne({ username, password });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        req.session.user = sessionUser(user);
        res.json(req.session.user);
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
};

exports.logout = (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
};

exports.me = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id).select(publicFields);
        if (!user) {
            req.session.destroy(() => {});
            return res.status(401).json({ error: 'User no longer exists' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Could not load profile' });
    }
};

exports.list = async (req, res) => {
    try {
        const users = await User.find().select(publicFields).sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Could not load users' });
    }
};

exports.search = async (req, res) => {
    try {
        const username = cleanText(req.query.username);
        const city = cleanText(req.query.city);
        const minAge = toNumber(req.query.minAge);
        const maxAge = toNumber(req.query.maxAge);

        if (Number.isNaN(minAge) || Number.isNaN(maxAge)) {
            return res.status(400).json({ error: 'Age filters must be numbers' });
        }
        if (minAge !== undefined && maxAge !== undefined && minAge > maxAge) {
            return res.status(400).json({ error: 'Minimum age cannot be bigger than maximum age' });
        }

        const query = {};
        if (username) query.username = new RegExp(escapeRegex(username), 'i');
        if (city) query.city = new RegExp(escapeRegex(city), 'i');
        if (minAge !== undefined || maxAge !== undefined) {
            query.age = {};
            if (minAge !== undefined) query.age.$gte = minAge;
            if (maxAge !== undefined) query.age.$lte = maxAge;
        }

        const users = await User.find(query).select(publicFields).sort({ username: 1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.update = async (req, res) => {
    try {
        const id = req.params.id;
        if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });
        if (id !== req.session.user._id && !req.session.user.isAdmin) {
            return res.status(403).json({ error: 'You can only edit your own profile' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const fullName = cleanText(req.body.fullName);
        const city = cleanText(req.body.city);
        const age = toNumber(req.body.age);
        const password = cleanText(req.body.password);

        const profileError = validateProfile(fullName, city, age);
        if (profileError) return res.status(400).json({ error: profileError });
        if (password && password.length < 3) {
            return res.status(400).json({ error: 'Password must be at least 3 characters' });
        }

        user.fullName = fullName;
        user.city = city;
        user.age = age;
        if (password) user.password = password;
        await user.save();

        res.json(await User.findById(id).select(publicFields));
    } catch (err) {
        res.status(500).json({ error: 'Update failed' });
    }
};

exports.remove = async (req, res) => {
    try {
        const id = req.params.id;
        if (!isValidId(id)) return res.status(400).json({ error: 'Invalid user id' });
        const isSelf = id === req.session.user._id;
        if (!isSelf && !req.session.user.isAdmin) {
            return res.status(403).json({ error: 'You can only delete your own account' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await Post.deleteMany({ author: user.username });
        await Group.updateMany({}, { $pull: { members: user.username } });

        const ownedGroups = await Group.find({ adminUser: user.username });
        for (const group of ownedGroups) {
            if (group.members.length > 0) {
                group.adminUser = group.members[0];
                await group.save();
            } else {
                await Post.deleteMany({ groupName: group.name });
                await Group.findByIdAndDelete(group._id);
            }
        }

        await User.findByIdAndDelete(id);

        if (isSelf) {
            return req.session.destroy(() => res.json({ success: true, loggedOut: true }));
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Delete failed' });
    }
};
