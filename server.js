const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const session = require('express-session');
const { Server } = require('socket.io');

const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const postRoutes = require('./routes/postRoutes');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(session({
    secret: 'social-network-secret',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/posts', postRoutes);

const chatHistory = [];

io.on('connection', (socket) => {
    socket.emit('chatHistory', chatHistory);

    socket.on('chatMessage', (msg) => {
        if (!msg || !msg.user || !msg.text) return;

        const text = String(msg.text).trim().substring(0, 300);
        if (text === '') return;

        const message = { user: String(msg.user), text: text };
        chatHistory.push(message);
        if (chatHistory.length > 50) {
            chatHistory.shift();
        }
        io.emit('chatMessage', message);
    });
});

mongoose.connect('mongodb://127.0.0.1:27017/social_network_db')
    .then(() => {
        console.log('MongoDB connected');
        server.listen(3000, () => {
            console.log('Server is running on http://localhost:3000');
        });
    })
    .catch(err => console.log('Could not connect to MongoDB', err));
