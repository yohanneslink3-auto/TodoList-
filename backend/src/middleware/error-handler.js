function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must contain valid JSON.' });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'A record with that value already exists.' });
  }
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : 'Internal server error',
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { errorHandler };
