const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const path = require('path');
const session = require('express-session');
const { Server } = require('socket.io');

const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const postRoutes = require('./routes/postRoutes');

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/social_network_db';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'social-network-dev-secret',
    resave: false,
    saveUninitialized: false
});

app.use(express.json({ limit: '100kb' }));
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/posts', postRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON' });
    }
    console.log(err);
    res.status(500).json({ error: 'Server error' });
});

io.engine.use(sessionMiddleware);

const chatHistory = [];

io.on('connection', (socket) => {
    socket.emit('chatHistory', chatHistory);

    socket.on('chatMessage', (text) => {
        const user = socket.request.session.user;
        if (!user || typeof text !== 'string') return;

        const cleanText = text.trim().substring(0, 300);
        if (!cleanText) return;

        const message = { user: user.username, text: cleanText, time: new Date() };
        chatHistory.push(message);
        if (chatHistory.length > 50) chatHistory.shift();
        io.emit('chatMessage', message);
    });
});

mongoose.connect(MONGO_URL)
    .then(() => {
        console.log('MongoDB connected');
        server.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.log('Could not connect to MongoDB:', err.message);
    });
