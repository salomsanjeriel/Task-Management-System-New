import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { initSocket } from './src/sockets/socketHandler.js';
import { startDeadlineChecker } from './src/utils/deadlineChecker.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './src/utils/swaggerConfig.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = FRONTEND_URL.split(',').map(url => url.trim());

const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')) {
    callback(null, true);
  } else {
    callback(new Error('Not allowed by CORS'));
  }
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

initSocket(io);
startDeadlineChecker(io);

app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

app.use(express.json());
app.use('/uploads', express.static('uploads'));

import authRoutes from './src/routes/authRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import taskRoutes from './src/routes/taskRoutes.js';
import notificationRoutes from './src/routes/notificationRoutes.js';
import projectRoutes from './src/routes/projectRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);


app.get('/', (req, res) => {
  res.json({ message: 'TMS Backend is running!' });
});

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

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