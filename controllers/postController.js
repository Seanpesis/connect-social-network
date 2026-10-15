const Post = require('../models/Post');
const Group = require('../models/Group');
const { isValidId, escapeRegex, cleanText } = require('../utils/helpers');

function parseDate(value) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function findOwnPost(req, res) {
    if (!isValidId(req.params.id)) {
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
        const content = cleanText(req.body.content);
        const groupName = cleanText(req.body.groupName);
        const username = req.session.user.username;

        if (!content) return res.status(400).json({ error: 'Post cannot be empty' });
        if (content.length > 500) return res.status(400).json({ error: 'Post is too long (max 500)' });

        const group = await Group.findOne({ name: groupName });
        if (!group) return res.status(400).json({ error: 'Please choose an existing group' });
        if (!group.members.includes(username)) {
            return res.status(403).json({ error: 'Join the group before posting in it' });
        }

        const post = new Post({ content, groupName, author: username });
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
        const groups = await Group.find({ members: username }).select('name');
        const groupNames = groups.map(g => g.name);
        const posts = await Post.find({
            $or: [{ groupName: { $in: groupNames } }, { author: username }]
        }).sort({ createdAt: -1 });
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
        const author = cleanText(req.query.author);
        const groupName = cleanText(req.query.groupName);
        const content = cleanText(req.query.content);
        const fromDate = parseDate(req.query.fromDate);
        const toDate = parseDate(req.query.toDate);

        if (fromDate === null || toDate === null) {
            return res.status(400).json({ error: 'Invalid date' });
        }
        if (fromDate && toDate && fromDate > toDate) {
            return res.status(400).json({ error: 'From date must be before To date' });
        }

        const query = {};
        if (author) query.author = new RegExp(escapeRegex(author), 'i');
        if (groupName) query.groupName = new RegExp(escapeRegex(groupName), 'i');
        if (content) query.content = new RegExp(escapeRegex(content), 'i');
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) query.createdAt.$gte = fromDate;
            if (toDate) {
                toDate.setHours(23, 59, 59, 999);
                query.createdAt.$lte = toDate;
            }
        }

        const posts = await Post.find(query).sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.update = async (req, res) => {
    try {
        const post = await findOwnPost(req, res);
        if (!post) return;

        const content = cleanText(req.body.content);
        if (!content) return res.status(400).json({ error: 'Post cannot be empty' });
        if (content.length > 500) return res.status(400).json({ error: 'Post is too long (max 500)' });

        post.content = content;
        await post.save();
        res.json(post);
    } catch (err) {
        res.status(500).json({ error: 'Could not update post' });
    }
};

exports.remove = async (req, res) => {
    try {
        const post = await findOwnPost(req, res);
        if (!post) return;
        await Post.findByIdAndDelete(post._id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete post' });
    }
};

exports.like = async (req, res) => {
    try {
        if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid post id' });
        const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { likes: 1 } }, { new: true });
        if (!post) return res.status(404).json({ error: 'Post not found' });
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
        const perMonth = await Post.aggregate([
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.json({ perGroup, perMonth: perMonth.slice(-6) });
    } catch (err) {
        res.status(500).json({ error: 'Could not load statistics' });
    }
};
