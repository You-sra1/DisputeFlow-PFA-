const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { successResponse } = require('./utils/responseBuilder');
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { errorCode: '42900', errorDescription: 'Too many login attempts, please try again later' },
});

app.get('/api/health', (_req, res) => {
  res.json(successResponse({ status: 'ok', timestamp: new Date().toISOString() }));
});

app.use('/api/login', loginLimiter);
app.use('/api', authRoutes);
app.use('/api', transactionRoutes);
app.use('/api', disputeRoutes);
app.use('/api', dashboardRoutes);

app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json({ errorCode: '00004', errorDescription: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
