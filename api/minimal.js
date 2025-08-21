const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Site Aura Crawler API',
    version: '1.0.0'
  });
});

module.exports = app;
