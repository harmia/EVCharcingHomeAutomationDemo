const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Basic rate limiter for all API routes (generous limits suited to a local demo)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.use('/api/prices',   require('./routes/prices'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/optimize', require('./routes/optimize'));

// Catch-all: serve the SPA
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;
