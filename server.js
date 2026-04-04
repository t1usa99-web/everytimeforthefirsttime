const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/chapbook', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chapbook.html'));
});

// Future pieces will get their own routes
// app.get('/pieces/:slug', ...)

app.listen(PORT, () => {
  console.log(`everytimeforthefirsttime.com is alive on port ${PORT}`);
});
