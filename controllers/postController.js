const mongoose = require('mongoose');
const Post = require('../models/Post');
const Group = require('../models/Group');

async function getMyPost(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({ error: 'Invalid post id' });
        return null;
    }
    const post = await Post.findById(req.params.id);
    if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return null;
    }
    const user = req.session.user;
    if (post.author !== user.username && !user.isAdmin) {
        res.status(403).json({ error: 'You can only change your own posts' });
        return null;
    }
    return post;
}

exports.create = async (req, res) => {
    try {
        const content = (req.body.content || '').trim();
        const groupName = req.body.groupName;
        const username = req.session.user.username;

        if (content === '') {
            return res.status(400).json({ error: 'Post cannot be empty' });
        }
        if (content.length > 500) {
            return res.status(400).json({ error: 'Post is too long (max 500)' });
        }

        const group = await Group.findOne({ name: groupName });
        if (!group) {
            return res.status(400).json({ error: 'Please choose an existing group' });
        }
        if (!group.members.includes(username)) {
            return res.status(403).json({ error: 'Join the group before posting in it' });
        }

        const post = new Post({ content: content, groupName: groupName, author: username });
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(500).json({ error: 'Could not create post' });
    }
};

exports.list = async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Could not load posts' });
    }
};

exports.feed = async (req, res) => {
    try {
        const username = req.session.user.username;
        const myGroups = await Group.find({ members: username });
        const groupNames = myGroups.map(group => group.name);

        const posts = await Post.find({ groupName: { $in: groupNames } }).sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Could not load feed' });
    }
};

exports.mine = async (req, res) => {
    try {
        const posts = await Post.find({ author: req.session.user.username }).sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Could not load your posts' });
    }
};

exports.search = async (req, res) => {
    try {
        const { author, groupName, content, fromDate, toDate } = req.query;
        const query = {};

        if (author) query.author = new RegExp(author, 'i');
        if (groupName) query.groupName = new RegExp(groupName, 'i');
        if (content) query.content = new RegExp(content, 'i');
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = new Date(fromDate);
            if (toDate) query.createdAt.$lte = new Date(toDate + 'T23:59:59');
        }

        const posts = await Post.find(query).sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(400).json({ error: 'Invalid search' });
    }
};

exports.update = async (req, res) => {
    try {
        const post = await getMyPost(req, res);
        if (!post) return;

        const content = (req.body.content || '').trim();
        if (content === '') {
            return res.status(400).json({ error: 'Post cannot be empty' });
        }
        if (content.length > 500) {
            return res.status(400).json({ error: 'Post is too long (max 500)' });
        }

        post.content = content;
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Could not update post' });
    }
};

exports.remove = async (req, res) => {
    try {
        const post = await getMyPost(req, res);
        if (!post) return;

        await Post.findByIdAndDelete(post._id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete post' });
    }
};

exports.like = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(400).json({ error: 'Invalid post id' });
        }
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        post.likes = post.likes + 1;
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Could not like post' });
    }
};

exports.stats = async (req, res) => {
    try {
        const perGroup = await Post.aggregate([
            { $group: { _id: '$groupName', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        const posts = await Post.find().select('createdAt');
        const months = {};
        posts.forEach(post => {
            const date = new Date(post.createdAt);
            const month = date.getMonth() + 1;
            const key = date.getFullYear() + '-' + (month < 10 ? '0' + month : month);
            months[key] = (months[key] || 0) + 1;
        });

        const perMonth = Object.keys(months)
            .sort()
            .slice(-6)
            .map(key => ({ _id: key, count: months[key] }));

        res.json({ perGroup: perGroup, perMonth: perMonth });
    } catch (err) {
        res.status(500).json({ error: 'Could not load statistics' });
    }
};
