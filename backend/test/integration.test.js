require('dotenv').config({ path: require('node:path').join(__dirname, '..', '.env') });

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { after, before, test } = require('node:test');
const { createApp } = require('../src/app');
const { register } = require('../src/features/auth/auth.service');
const Category = require('../src/features/categories/category.model');
const Notification = require('../src/features/notifications/notification.model');
const ReminderJob = require('../src/features/notifications/reminder-job.model');
const { processDueJobs } = require('../src/features/notifications/notification.service');
const Session = require('../src/features/auth/session.model');
const Task = require('../src/features/tasks/task.model');
const User = require('../src/features/auth/user.model');

const mongoUri = process.env.MONGODB_TEST_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const databaseName = `todolist_integration_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const jwtSecret = 'integration-test-secret-with-more-than-thirty-two-characters';
const app = createApp({ clientUrl: 'http://localhost:5173', jwtSecret });
let server;
let baseUrl;

function cookiesFrom(response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

function cookieValue(cookieHeader, name) {
  return cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`))?.[1];
}

async function registerAccount(email) {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Integration User',
      email,
      password: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    }),
  });
  assert.equal(response.status, 201);
  return { body: await response.json(), cookie: cookiesFrom(response) };
}

before(async () => {
  await mongoose.connect(mongoUri, {
    dbName: databaseName,
    serverSelectionTimeoutMS: 5000,
  });
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User.init(),
    Category.init(),
    Task.init(),
    Notification.init(),
    ReminderJob.init(),
    Session.init(),
  ]);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});

test('registration rolls back an account if starter-category creation fails', async () => {
  const insertMany = Category.insertMany;
  Category.insertMany = async (documents, options) => {
    await insertMany.call(Category, [documents[0]], options);
    throw new Error('injected category setup failure');
  };
  try {
    await assert.rejects(register({
      name: 'Rollback User',
      email: 'rollback@example.com',
      password: 'a-secure-password',
    }), /injected category setup failure/);
  } finally {
    Category.insertMany = insertMany;
  }
  assert.equal(await User.exists({ email: 'rollback@example.com' }), null);
  assert.equal(await Category.countDocuments({ name: 'Personal' }), 0);
});

test('registered user can manage owned data, rotate/revoke sessions, and enqueue reminders', async () => {
  const first = await registerAccount('first@example.com');
  const second = await registerAccount('second@example.com');
  const firstUserId = first.body.user.id;
  const firstCookie = first.cookie;
  const refreshCookie = `todo_refresh=${cookieValue(firstCookie, 'todo_refresh')}`;

  assert.equal((await Category.find({ user: firstUserId })).length, 4);
  const categoryResponse = await fetch(`${baseUrl}/api/categories`, { headers: { cookie: firstCookie } });
  assert.equal(categoryResponse.status, 200);
  assert.equal((await categoryResponse.json()).categories.length, 4);

  const createCategoryResponse = await fetch(`${baseUrl}/api/categories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: firstCookie },
    body: JSON.stringify({ name: 'Integration', color: '#123456' }),
  });
  assert.equal(createCategoryResponse.status, 201);
  const { category } = await createCategoryResponse.json();
  const updateCategoryResponse = await fetch(`${baseUrl}/api/categories/${category._id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: firstCookie },
    body: JSON.stringify({ name: 'Integration Updated' }),
  });
  assert.equal(updateCategoryResponse.status, 200);

  const dueDate = new Date(Date.now() - 60_000).toISOString();
  const reminderAt = new Date(Date.now() - 120_000).toISOString();
  const createTaskResponse = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: firstCookie },
    body: JSON.stringify({
      title: 'Integration reminder',
      category: category._id,
      dueDate,
      reminderAt,
    }),
  });
  assert.equal(createTaskResponse.status, 201);
  const { task } = await createTaskResponse.json();
  assert.equal(await ReminderJob.countDocuments({ task: task._id }), 2);

  const listResponse = await fetch(`${baseUrl}/api/tasks?search=Integration`, { headers: { cookie: firstCookie } });
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).data[0]._id, task._id);

  const otherUserTaskResponse = await fetch(`${baseUrl}/api/tasks/${task._id}`, {
    headers: { cookie: second.cookie },
  });
  assert.equal(otherUserTaskResponse.status, 404);

  await ReminderJob.updateOne(
    { task: task._id, type: 'due' },
    {
      $set: {
        status: 'processing',
        lockedUntil: new Date(Date.now() - 1000),
        claimToken: 'abandoned-worker',
      },
    },
  );
  await processDueJobs(new Date());
  assert.equal(await Notification.countDocuments({ task: task._id }), 2);
  const notificationsResponse = await fetch(`${baseUrl}/api/notifications`, {
    headers: { cookie: firstCookie },
  });
  assert.equal(notificationsResponse.status, 200);
  const notifications = await notificationsResponse.json();
  assert.equal(notifications.unreadCount, 2);
  const otherUserNotificationResponse = await fetch(
    `${baseUrl}/api/notifications/${notifications.data[0]._id}/read`,
    { method: 'PATCH', headers: { cookie: second.cookie } },
  );
  assert.equal(otherUserNotificationResponse.status, 404);
  const markReadResponse = await fetch(
    `${baseUrl}/api/notifications/${notifications.data[0]._id}/read`,
    { method: 'PATCH', headers: { cookie: firstCookie } },
  );
  assert.equal(markReadResponse.status, 200);
  const dismissResponse = await fetch(
    `${baseUrl}/api/notifications/${notifications.data[1]._id}`,
    { method: 'DELETE', headers: { cookie: firstCookie } },
  );
  assert.equal(dismissResponse.status, 204);

  const updateResponse = await fetch(`${baseUrl}/api/tasks/${task._id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', cookie: firstCookie },
    body: JSON.stringify({ status: 'completed' }),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal(await ReminderJob.countDocuments({ task: task._id }), 0);
  assert.equal(await Notification.countDocuments({ task: task._id }), 0);

  const deleteCategoryResponse = await fetch(`${baseUrl}/api/categories/${category._id}`, {
    method: 'DELETE',
    headers: { cookie: firstCookie },
  });
  assert.equal(deleteCategoryResponse.status, 204);
  assert.equal((await Task.findById(task._id)).category, null);
  const deleteTaskResponse = await fetch(`${baseUrl}/api/tasks/${task._id}`, {
    method: 'DELETE',
    headers: { cookie: firstCookie },
  });
  assert.equal(deleteTaskResponse.status, 204);
  assert.equal(await Task.exists({ _id: task._id }), null);

  const refreshResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: refreshCookie },
  });
  assert.equal(refreshResponse.status, 200);
  const rotatedCookie = cookiesFrom(refreshResponse);
  assert.notEqual(cookieValue(rotatedCookie, 'todo_refresh'), cookieValue(firstCookie, 'todo_refresh'));

  const reusedTokenResponse = await fetch(`${baseUrl}/api/auth/refresh`, {
    method: 'POST',
    headers: { cookie: refreshCookie },
  });
  assert.equal(reusedTokenResponse.status, 401);

  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { cookie: rotatedCookie },
  });
  assert.equal(logoutResponse.status, 204);
  assert.equal(await Session.countDocuments({ user: firstUserId }), 0);
});
