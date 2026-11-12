const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: ['todo', 'in-progress', 'completed'], default: 'todo', index: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium', index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    dueDate: { type: Date, default: null, index: true },
    reminderAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false },
);

taskSchema.index({ user: 1, createdAt: -1 });
taskSchema.index({ user: 1, status: 1, dueDate: 1 });
taskSchema.index({ status: 1, reminderAt: 1 });
taskSchema.index({ status: 1, dueDate: 1 });
taskSchema.index({ user: 1, title: 'text', description: 'text' });

module.exports = mongoose.model('Task', taskSchema);
