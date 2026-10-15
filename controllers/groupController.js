const mongoose = require('mongoose');
const Group = require('../models/Group');
const Post = require('../models/Post');

const categories = ['Sports', 'Music', 'Tech', 'Study', 'Travel', 'Food', 'Other'];

function checkGroupData(name, description, category) {
    if (name.length < 2 || name.length > 40) return 'Group name must be 2-40 characters';
    if (description.length > 300) return 'Description is too long (max 300)';
    if (!categories.includes(category)) return 'Please choose a valid category';
    return null;
}

async function getGroup(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
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

function isGroupAdmin(group, user) {
    return group.adminUser === user.username || user.isAdmin;
}

exports.categories = (req, res) => {
    res.json(categories);
};

exports.create = async (req, res) => {
    try {
        const name = (req.body.name || '').trim();
        const description = (req.body.description || '').trim();
        const category = req.body.category;

        const error = checkGroupData(name, description, category);
        if (error) {
            return res.status(400).json({ error: error });
        }

        const exists = await Group.findOne({ name: name });
        if (exists) {
            return res.status(400).json({ error: 'A group with this name already exists' });
        }

        const username = req.session.user.username;
        const group = new Group({
            name: name,
            description: description,
            category: category,
            adminUser: username,
            members: [username]
        });
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
        const { name, category, adminUser } = req.query;
        const query = {};

        if (name) query.name = new RegExp(name, 'i');
        if (category) query.category = category;
        if (adminUser) query.adminUser = new RegExp(adminUser, 'i');

        const groups = await Group.find(query).sort({ name: 1 });
        res.json(groups);
    } catch (err) {
        res.status(400).json({ error: 'Invalid search' });
    }
};

exports.update = async (req, res) => {
    try {
        const group = await getGroup(req, res);
        if (!group) return;

        if (!isGroupAdmin(group, req.session.user)) {
            return res.status(403).json({ error: 'Only the group admin can edit this group' });
        }

        const name = (req.body.name || '').trim();
        const description = (req.body.description || '').trim();
        const category = req.body.category;

        const error = checkGroupData(name, description, category);
        if (error) {
            return res.status(400).json({ error: error });
        }

        const oldName = group.name;
        if (name !== oldName) {
            const exists = await Group.findOne({ name: name });
            if (exists) {
                return res.status(400).json({ error: 'A group with this name already exists' });
            }
        }

        group.name = name;
        group.description = description;
        group.category = category;
        await group.save();

        if (name !== oldName) {
            await Post.updateMany({ groupName: oldName }, { groupName: name });
        }
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: 'Could not update group' });
    }
};

exports.remove = async (req, res) => {
    try {
        const group = await getGroup(req, res);
        if (!group) return;

        if (!isGroupAdmin(group, req.session.user)) {
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
        const group = await getGroup(req, res);
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
        const group = await getGroup(req, res);
        if (!group) return;

        const username = req.session.user.username;
        if (!group.members.includes(username)) {
            return res.status(400).json({ error: 'You are not a member of this group' });
        }
        if (group.adminUser === username) {
            return res.status(400).json({ error: 'The group admin cannot leave the group' });
        }

        group.members = group.members.filter(member => member !== username);
        await group.save();
        res.json(group);
    } catch (err) {
        res.status(500).json({ error: 'Could not leave group' });
    }
};
