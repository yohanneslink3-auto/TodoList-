const mongoose = require('mongoose');
const Category = require('../categories/category.model');
const Notification = require('../notifications/notification.model');
const { removeTaskJobs, syncTaskJobs } = require('../notifications/notification.service');
const Task = require('./task.model');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getDayBounds(timezoneOffset) {
  const now = new Date();
  const localNow = new Date(now.getTime() - timezoneOffset * 60_000);
  const startOfToday = new Date(Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
  ) + timezoneOffset * 60_000);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setUTCDate(startOfTomorrow.getUTCDate() + 1);
  return { startOfToday, startOfTomorrow };
}

async function validateCategory(userId, categoryId) {
  if (categoryId && !(await Category.exists({ _id: categoryId, user: userId }))) {
    throw httpError(400, 'Choose a category belonging to your account.');
  }
}

async function listTasks(userId, filters) {
  const { page, limit, search, status, priority, category, due, sort, order, timezoneOffset } = filters;
  const query = { user: userId };
  if (status) query.status = status;
  if (priority) query.priority = priority;
  if (category === 'uncategorized') query.category = null;
  else if (category) query.category = category;
  if (due) {
    const { startOfToday, startOfTomorrow } = getDayBounds(timezoneOffset);
    query.status = { $ne: 'completed' };
    if (due === 'today') query.dueDate = { $gte: startOfToday, $lt: startOfTomorrow };
    if (due === 'upcoming') query.dueDate = { $gte: startOfTomorrow };
    if (due === 'overdue') query.dueDate = { $lt: startOfToday };
  }
  if (search) {
    const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { title: { $regex: safeSearch, $options: 'i' } },
      { description: { $regex: safeSearch, $options: 'i' } },
    ];
  }

  const aggregationQuery = { ...query, user: new mongoose.Types.ObjectId(userId) };
  if (typeof aggregationQuery.category === 'string') {
    aggregationQuery.category = new mongoose.Types.ObjectId(aggregationQuery.category);
  }
  const taskQuery = sort === 'priority'
    ? Task.aggregate([
      { $match: aggregationQuery },
      {
        $addFields: {
          priorityRank: {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'high'] }, then: 3 },
                { case: { $eq: ['$priority', 'medium'] }, then: 2 },
                { case: { $eq: ['$priority', 'low'] }, then: 1 },
              ],
              default: 0,
            },
          },
        },
      },
      { $sort: { priorityRank: order === 'asc' ? 1 : -1, _id: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: Category.collection.name, localField: 'category', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { priorityRank: 0, 'category.user': 0 } },
    ])
    : Task.find(query)
      .populate('category', 'name color')
      .sort({ [sort]: order === 'asc' ? 1 : -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

  const [data, total] = await Promise.all([
    taskQuery,
    Task.countDocuments(query),
  ]);

  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

async function createTask(userId, input) {
  await validateCategory(userId, input.category);
  const task = await Task.create({ ...input, user: userId });
  await syncTaskJobs(task);
  return task.populate('category', 'name color');
}

async function getTask(userId, taskId) {
  const task = await Task.findOne({ _id: taskId, user: userId })
    .populate('category', 'name color')
    .lean();
  if (!task) throw httpError(404, 'Task not found.');
  return task;
}

async function updateTask(userId, taskId, input) {
  if (Object.hasOwn(input, 'category')) await validateCategory(userId, input.category);
  const currentTask = await Task.findOne({ _id: taskId, user: userId }).select('dueDate reminderAt').lean();
  if (!currentTask) throw httpError(404, 'Task not found.');
  const dueDate = Object.hasOwn(input, 'dueDate') ? input.dueDate : currentTask.dueDate;
  const reminderAt = Object.hasOwn(input, 'reminderAt') ? input.reminderAt : currentTask.reminderAt;
  if (reminderAt && !dueDate) throw httpError(400, 'A reminder requires a due date.');
  if (reminderAt && dueDate && reminderAt > dueDate) throw httpError(400, 'Reminder must be before the due date.');
  const task = await Task.findOneAndUpdate(
    { _id: taskId, user: userId },
    { $set: input },
    { returnDocument: 'after', runValidators: true },
  ).populate('category', 'name color');
  if (!task) throw httpError(404, 'Task not found.');
  await Notification.deleteMany({ task: taskId, user: userId });
  await syncTaskJobs(task);
  return task;
}

async function deleteTask(userId, taskId) {
  const task = await Task.findOneAndDelete({ _id: taskId, user: userId });
  if (!task) throw httpError(404, 'Task not found.');
  await Promise.all([
    Notification.deleteMany({ task: taskId, user: userId }),
    removeTaskJobs(userId, taskId),
  ]);
  return task;
}

async function getStatistics(userId, timezoneOffset = 0) {
  const { startOfToday, startOfTomorrow } = getDayBounds(timezoneOffset);
  const [total, completed, inProgress, overdue, dueToday, byPriority] = await Promise.all([
    Task.countDocuments({ user: userId }),
    Task.countDocuments({ user: userId, status: 'completed' }),
    Task.countDocuments({ user: userId, status: 'in-progress' }),
    Task.countDocuments({ user: userId, status: { $ne: 'completed' }, dueDate: { $lt: startOfToday } }),
    Task.countDocuments({
      user: userId,
      status: { $ne: 'completed' },
      dueDate: { $gte: startOfToday, $lt: startOfTomorrow },
    }),
    Task.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
  ]);

  return {
    total,
    completed,
    inProgress,
    overdue,
    dueToday,
    completionRate: total ? Math.round((completed / total) * 100) : 0,
    byPriority: Object.fromEntries(byPriority.map(({ _id, count }) => [_id, count])),
  };
}

module.exports = { createTask, deleteTask, getStatistics, getTask, listTasks, updateTask };
