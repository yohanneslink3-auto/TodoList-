const mongoose = require('mongoose');

function getHealth() {
  return {
    status: 'ok',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  };
}

module.exports = { getHealth };
