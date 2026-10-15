const mongoose = require('mongoose');
const User = require('./models/User');
const Group = require('./models/Group');
const Post = require('./models/Post');

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/social_network_db';

const users = [
    { username: 'admin', password: '123', fullName: 'Site Admin', city: 'Tel Aviv', age: 30, isAdmin: true },
    { username: 'student', password: '123', fullName: 'Student User', city: 'Haifa', age: 23 },
    { username: 'dana', password: '123', fullName: 'Dana Levi', city: 'Tel Aviv', age: 25 },
    { username: 'yossi', password: '123', fullName: 'Yossi Cohen', city: 'Jerusalem', age: 31 },
    { username: 'noa', password: '123', fullName: 'Noa Mizrahi', city: 'Haifa', age: 22 },
    { username: 'avi', password: '123', fullName: 'Avi Peretz', city: 'Beer Sheva', age: 40 },
    { username: 'maya', password: '123', fullName: 'Maya Friedman', city: 'Netanya', age: 27 },
    { username: 'omer', password: '123', fullName: 'Omer Shapiro', city: 'Tel Aviv', age: 19 }
];

const groups = [
    { name: 'Football Fans', category: 'Sports', adminUser: 'yossi', description: 'Everything about football', members: ['yossi', 'avi', 'omer', 'student', 'admin'] },
    { name: 'Web Developers', category: 'Tech', adminUser: 'dana', description: 'Node, Express, MongoDB and more', members: ['dana', 'student', 'noa', 'omer', 'admin'] },
    { name: 'Exam Prep', category: 'Study', adminUser: 'student', description: 'Study together for exams', members: ['student', 'noa', 'maya'] },
    { name: 'Rock Music', category: 'Music', adminUser: 'avi', description: 'Classic and modern rock', members: ['avi', 'maya', 'yossi'] },
    { name: 'Travel Israel', category: 'Travel', adminUser: 'maya', description: 'Trips and hikes around the country', members: ['maya', 'dana', 'noa', 'admin'] },
    { name: 'Home Cooking', category: 'Food', adminUser: 'noa', description: 'Share your favorite recipes', members: ['noa', 'dana', 'avi'] }
];

const postTexts = {
    'Football Fans': ['What a game last night!', 'Who is going to the derby on Saturday?', 'Best goal of the season so far', 'Our team needs a new coach'],
    'Web Developers': ['Just learned how Express middleware works', 'MongoDB aggregation is really powerful', 'Anyone tried Socket.io for a chat app?', 'jQuery Ajax makes calls to the server so easy', 'D3.js charts look great'],
    'Exam Prep': ['Meeting in the library at 10', 'Does anyone have the summary for chapter 3?', 'Good luck to everyone tomorrow!'],
    'Rock Music': ['Listening to Queen all day', 'Concert tickets are out', 'Favorite guitar solo ever?'],
    'Travel Israel': ['Hiked Masada at sunrise, amazing', 'Best beaches in the north?', 'Weekend trip to the Galilee'],
    'Home Cooking': ['My shakshuka recipe', 'Baked fresh challah today', 'Easy pasta for students']
};

function daysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
}

async function seed() {
    await mongoose.connect(MONGO_URL);
    await User.deleteMany({});
    await Group.deleteMany({});
    await Post.deleteMany({});

    await User.insertMany(users);
    await Group.insertMany(groups);

    const posts = [];
    let counter = 0;
    for (const group of groups) {
        for (const text of postTexts[group.name]) {
            const author = group.members[counter % group.members.length];
            posts.push({
                content: text,
                author,
                groupName: group.name,
                likes: (counter * 3) % 11,
                createdAt: daysAgo((counter * 37) % 170)
            });
            counter++;
        }
    }
    await Post.insertMany(posts);

    console.log(`Inserted ${users.length} users, ${groups.length} groups, ${posts.length} posts`);
    await mongoose.disconnect();
}

seed().catch(async err => {
    console.log('Seed failed:', err.message);
    await mongoose.disconnect();
});
