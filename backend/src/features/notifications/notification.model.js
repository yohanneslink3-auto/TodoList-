const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    type: { type: String, enum: ['reminder', 'due'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    eventAt: { type: Date, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, task: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Notification', notificationSchema);
