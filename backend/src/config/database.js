const mongoose = require('mongoose');

async function connectDatabase(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('Connected to MongoDB.');
}

module.exports = { connectDatabase };
