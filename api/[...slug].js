const { handleRequest } = require('../engine.js');

module.exports = async (req, res) => {
    try {
        return await handleRequest(req, res);
    } catch (err) {
        console.error('[API Serverless Handler Error]:', err);
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
        }
    }
};
