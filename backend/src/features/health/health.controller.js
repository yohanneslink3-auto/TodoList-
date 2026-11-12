const { getHealth } = require('./health.service');

function getHealthStatus(_req, res) {
  res.json(getHealth());
}

module.exports = { getHealthStatus };
