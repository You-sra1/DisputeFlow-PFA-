const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { successResponse, errorResponse } = require('./utils/responseBuilder');
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const disputeRoutes = require('./routes/disputeRoutes');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json(successResponse({ status: 'ok', timestamp: new Date().toISOString() }));
});

app.use('/api', authRoutes);
app.use('/api', transactionRoutes);
app.use('/api', disputeRoutes);

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json(errorResponse('Route not found', { errorCode: '00004' }));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
