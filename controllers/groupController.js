const Group = require('../models/Group');
const Post = require('../models/Post');
const { isValidId, escapeRegex, cleanText, toNumber } = require('../utils/helpers');

const categories = Group.schema.path('category').enumValues;

function canManage(group, user) {
    return group.adminUser === user.username || user.isAdmin;
}

function validateGroup(name, description, category) {
    if (name.length < 2 || name.length > 40) return 'Group name must be 2-40 characters';
    if (description.length > 300) return 'Description is too long (max 300)';
    if (!categories.includes(category)) return 'Please choose a valid category';
    return null;
}

async function findGroup(req, res) {
    if (!isValidId(req.params.id)) {
        res.status(400).json({ error: 'Invalid group id' });
        return null;
    }
    const group = await Group.findById(req.params.id);
    if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return null;
    }
    return group;
}

exports.categories = (req, res) => {
    res.json(categories);
};

exports.create = async (req, res) => {
    try {
        const name = cleanText(req.body.name);
        const description = cleanText(req.body.description);
        const category = cleanText(req.body.category);

        const error = validateGroup(name, description, category);
        if (error) return res.status(400).json({ error });

        const exists = await Group.findOne({ name: new RegExp('^' + escapeRegex(name) + '$', 'i') });
        if (exists) return res.status(409).json({ error: 'A group with this name already exists' });

        const username = req.session.user.username;
        const group = new Group({ name, description, category, adminUser: username, members: [username] });
        await group.save();
        res.status(201).json(group);
    } catch (err) {
        res.status(500).json({ error: 'Could not create group' });
    }
};

exports.list = async (req, res) => {
    try {
        const groups = await Group.find().sort({ name: 1 });
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: 'Could not load groups' });
    }
};

exports.search = async (req, res) => {
    try {
        const name = cleanText(req.query.name);
        const category = cleanText(req.query.category);
        const adminUser = cleanText(req.query.adminUser);
        const minMembers = toNumber(req.query.minMembers);

        if (Number.isNaN(minMembers) || (minMembers !== undefined && minMembers < 0)) {
            return res.status(400).json({ error: 'Minimum members must be a positive number' });
        }
        if (category && !categories.includes(category)) {
            return res.status(400).json({ error: 'Unknown category' });
        }

        const query = {};
        if (name) query.name = new RegExp(escapeRegex(name), 'i');
        if (category) query.category = category;
        if (adminUser) query.adminUser = new RegExp(escapeRegex(adminUser), 'i');
        if (minMembers !== undefined) query.$expr = { $gte: [{ $size: '$members' }, minMembers] };

        const groups = await Group.find(query).sort({ name: 1 });
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: 'Search failed' });
    }
};

exports.update = async (req, res) => {
    try {
        const group = await findGroup(req, res);
        if (!group) return;
        if (!canManage(group, req.session.user)) {
            return res.status(403).json({ error: 'Only the group admin can edit this group' });
        }

        const name = cleanText(req.body.name);
        const description = cleanText(req.body.description);
        const category = cleanText(req.body.category);

        const error = validateGroup(name, description, category);
        if (error) return res.status(400).json({ error });

        const oldName = group.name;
        if (name.toLowerCase() !== oldName.toLowerCase()) {
            const exists = await Group.findOne({ name: new RegExp('^' + escapeRegex(name) + '$', 'i') });
            if (exists) return res.status(409).json({ error: 'A group with this name already exists' });
        }

        group.name = name;
        group.description = description;
        group.category = category;
        await group.save();

        if (oldName !== name) {
            await Post.updateMany({ groupName: oldName }, { groupName: name });
        }
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: 'Could not update group' });
    }
};

exports.remove = async (req, res) => {
    try {
        const group = await findGroup(req, res);
        if (!group) return;
        if (!canManage(group, req.session.user)) {
            return res.status(403).json({ error: 'Only the group admin can delete this group' });
        }
        await Post.deleteMany({ groupName: group.name });
        await Group.findByIdAndDelete(group._id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Could not delete group' });
    }
};

exports.join = async (req, res) => {
    try {
        const group = await findGroup(req, res);
        if (!group) return;
        const username = req.session.user.username;
        if (group.members.includes(username)) {
            return res.status(400).json({ error: 'You are already a member' });
        }
        group.members.push(username);
        await group.save();
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: 'Could not join group' });
    }
};

exports.leave = async (req, res) => {
    try {
        const group = await findGroup(req, res);
        if (!group) return;
        const username = req.session.user.username;
        if (!group.members.includes(username)) {
            return res.status(400).json({ error: 'You are not a member of this group' });
        }
        if (group.adminUser === username) {
            return res.status(400).json({ error: 'The group admin cannot leave. Delete the group instead' });
        }
        group.members = group.members.filter(m => m !== username);
        await group.save();
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: 'Could not leave group' });
    }
};
