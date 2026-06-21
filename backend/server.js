import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initSocket } from './src/sockets/socketHandler.js';
import { startDeadlineChecker } from './src/utils/deadlineChecker.js';

dotenv.config();

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});


initSocket(io);
startDeadlineChecker(io);

app.set('io', io);


app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));


import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import taskRoutes from './src/routes/taskRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'TMS Backend is running!' });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    errorCode: err.code || 'SERVER_ERROR',
    message: err.message || 'Something went wrong',
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});