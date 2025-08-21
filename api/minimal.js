// Export a request handler function directly
module.exports = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.json({
    status: 'ok',
    message: 'Site Aura Crawler API',
    version: '1.0.0',
    env: process.env.NODE_ENV
  });
};