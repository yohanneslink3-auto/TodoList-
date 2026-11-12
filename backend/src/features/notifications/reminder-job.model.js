const mongoose = require('mongoose');

const reminderJobSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    type: { type: String, enum: ['reminder', 'due'], required: true },
    title: { type: String, required: true },
    dueAt: { type: Date, required: true },
    nextAttemptAt: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    claimToken: { type: String, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, versionKey: false },
);

reminderJobSchema.index({ user: 1, task: 1, type: 1 }, { unique: true });
reminderJobSchema.index({ status: 1, nextAttemptAt: 1, lockedUntil: 1 });

module.exports = mongoose.model('ReminderJob', reminderJobSchema);
