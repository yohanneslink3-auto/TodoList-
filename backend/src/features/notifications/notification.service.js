const crypto = require('node:crypto');
const ReminderJob = require('./reminder-job.model');
const Notification = require('./notification.model');
const Task = require('../tasks/task.model');

const MAX_ATTEMPTS = 8;
const CLAIM_LEASE_MS = 60_000;

function getTaskJobSpecs(task) {
  if (task.status === 'completed') return [];
  const specs = [];
  if (task.reminderAt) specs.push({ type: 'reminder', dueAt: task.reminderAt });
  if (task.dueDate) specs.push({ type: 'due', dueAt: task.dueDate });
  return specs;
}

async function syncTaskJobs(task) {
  const taskId = task._id || task.id;
  const specs = getTaskJobSpecs(task);
  if (specs.length) {
    await ReminderJob.bulkWrite(
      specs.map(({ type, dueAt }) => ({
        updateOne: {
          filter: { user: task.user, task: taskId, type },
          update: {
            $set: {
              user: task.user,
              task: taskId,
              type,
              title: task.title,
              dueAt,
              nextAttemptAt: dueAt,
              status: 'pending',
              attempts: 0,
              lockedUntil: null,
              claimToken: null,
              lastError: null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  }
  await ReminderJob.deleteMany({
    user: task.user,
    task: taskId,
    type: { $nin: specs.map(({ type }) => type) },
  });
}

async function removeTaskJobs(userId, taskId) {
  await ReminderJob.deleteMany({ user: userId, task: taskId });
}

async function reconcileTaskJobs() {
  const cursor = Task.find({
    status: { $ne: 'completed' },
    $or: [{ reminderAt: { $ne: null } }, { dueDate: { $ne: null } }],
  }).select('_id user title status reminderAt dueDate').lean().cursor();

  for await (const task of cursor) await syncTaskJobs(task);
}

async function processDueJobs(now = new Date(), batchSize = 50) {
  let processed = 0;
  while (processed < batchSize) {
    const claimToken = crypto.randomUUID();
    const job = await ReminderJob.findOneAndUpdate(
      {
        nextAttemptAt: { $lte: now },
        $or: [
          { status: 'pending' },
          { status: 'processing', lockedUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          status: 'processing',
          lockedUntil: new Date(now.getTime() + CLAIM_LEASE_MS),
          claimToken,
        },
        $inc: { attempts: 1 },
      },
      { returnDocument: 'after', sort: { nextAttemptAt: 1 } },
    );
    if (!job) break;

    try {
      const task = await Task.findOne({
        _id: job.task,
        user: job.user,
        status: { $ne: 'completed' },
      }).select('_id title reminderAt dueDate').lean();
      const taskDueAt = task && (job.type === 'reminder' ? task.reminderAt : task.dueDate);
      if (task && taskDueAt && taskDueAt.getTime() === job.dueAt.getTime() && taskDueAt <= now) {
        await Notification.updateOne(
          { user: job.user, task: job.task, type: job.type },
          {
            $setOnInsert: {
              user: job.user,
              task: job.task,
              type: job.type,
              title: job.type === 'reminder' ? 'Task reminder' : 'Task is due',
              message: task.title,
              eventAt: job.dueAt,
            },
          },
          { upsert: true },
        );
      }
      await ReminderJob.updateOne(
        { _id: job.id, status: 'processing', claimToken },
        { $set: { status: 'completed', lockedUntil: null, claimToken: null, lastError: null } },
      );
    } catch (error) {
      const retryDelayMs = Math.min(1000 * (2 ** job.attempts), 5 * 60 * 1000);
      await ReminderJob.updateOne(
        { _id: job.id, status: 'processing', claimToken },
        {
          $set: {
            status: job.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            nextAttemptAt: new Date(now.getTime() + retryDelayMs),
            lockedUntil: null,
            claimToken: null,
            lastError: error.message.slice(0, 500),
          },
        },
      );
      console.error(`Reminder job ${job.id} failed: ${error.message}`);
    }
    processed += 1;
  }
  return processed;
}

module.exports = { processDueJobs, reconcileTaskJobs, removeTaskJobs, syncTaskJobs };
