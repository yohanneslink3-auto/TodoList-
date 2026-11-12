const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { after, before, test } = require('node:test');
const { createApp } = require('../src/app');
const { validate } = require('../src/middleware/validate');
const { loginSchema, registerSchema } = require('../src/features/auth/auth.validation');
const { listTasksSchema, statisticsSchema, updateTaskSchema } = require('../src/features/tasks/task.validation');

const app = createApp({
  clientUrl: 'http://localhost:5173',
  jwtSecret: 'test-secret-with-more-than-thirty-two-characters',
});
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeAllConnections();
  });
});

test('health endpoint reports server and database state', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'disconnected' });
});

test('session endpoint reports an anonymous session without an HTTP error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: null });
});

test('refresh endpoint requires a valid refresh session', async () => {
  const response = await fetch(`${baseUrl}/api/auth/refresh`, { method: 'POST' });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /session has expired/i);
});

test('OpenAPI contract and Swagger UI are served by the API', async () => {
  const [specResponse, uiResponse] = await Promise.all([
    fetch(`${baseUrl}/api/docs/openapi.json`),
    fetch(`${baseUrl}/api/docs/`),
  ]);
  assert.equal(specResponse.status, 200);
  const spec = await specResponse.json();
  assert.equal(spec.openapi, '3.1.0');
  assert.ok(spec.paths['/tasks/{id}'].patch);
  assert.equal(uiResponse.status, 200);
  assert.match(await uiResponse.text(), /swagger-ui/);
});

test('task and category APIs reject unauthenticated requests', async () => {
  const [tasks, categories, notifications, dismissNotification] = await Promise.all([
    fetch(`${baseUrl}/api/tasks`),
    fetch(`${baseUrl}/api/categories`),
    fetch(`${baseUrl}/api/notifications`),
    fetch(`${baseUrl}/api/notifications/${'a'.repeat(24)}`, { method: 'DELETE' }),
  ]);
  assert.equal(tasks.status, 401);
  assert.equal(categories.status, 401);
  assert.equal(notifications.status, 401);
  assert.equal(dismissNotification.status, 401);
});

test('unknown routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Route not found' });
});

test('malformed JSON receives a client error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'Request body must contain valid JSON.' });
});

test('authenticated task creation validates input before database access', async () => {
  const token = jwt.sign({ sub: '507f1f77bcf86cd799439011' }, 'test-secret-with-more-than-thirty-two-characters');
  const response = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `todo_session=${token}`,
    },
    body: JSON.stringify({ title: '' }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /body\.title/);
});

test('registration and login validate credentials', () => {
  assert.equal(registerSchema.safeParse({
    body: {
      name: 'Alex',
      email: 'ALEX@example.com',
      password: 'a-secure-password',
      confirmPassword: 'a-secure-password',
    },
    params: {},
    query: {},
  }).success, true);
  assert.equal(registerSchema.safeParse({
    body: {
      name: 'Alex',
      email: 'alex@example.com',
      password: 'a-secure-password',
      confirmPassword: 'a-different-password',
    },
    params: {},
    query: {},
  }).success, false);
  assert.equal(loginSchema.safeParse({
    body: { email: 'not-an-email', password: 'short' },
    params: {},
    query: {},
  }).success, false);
});

test('registration API rejects mismatched passwords', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Alex Morgan',
      email: 'alex@example.com',
      password: 'a-secure-password',
      confirmPassword: 'a-different-password',
    }),
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /Passwords do not match/);
});

test('reminders require a due date and must precede it', () => {
  const invalid = {
    body: { title: 'Review notes', reminderAt: '2026-11-12T10:00:00.000Z' },
    params: {},
    query: {},
  };
  const reversed = {
    body: {
      title: 'Review notes',
      dueDate: '2026-11-12T09:00:00.000Z',
      reminderAt: '2026-11-12T10:00:00.000Z',
    },
    params: {},
    query: {},
  };
  assert.equal(require('../src/features/tasks/task.validation').createTaskSchema.safeParse(invalid).success, false);
  assert.equal(require('../src/features/tasks/task.validation').createTaskSchema.safeParse(reversed).success, false);
});

test('task query validation bounds pagination and accepts filters', () => {
  const parsed = listTasksSchema.safeParse({
    body: {},
    params: {},
    query: { page: '2', limit: '25', priority: 'high', due: 'today' },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.query.page, 2);
  assert.equal(parsed.data.query.limit, 25);
  assert.equal(listTasksSchema.safeParse({
    body: {},
    params: {},
    query: { limit: '500' },
  }).success, false);
});

test('GET request validation accepts an absent JSON body', async () => {
  for (const schema of [listTasksSchema, statisticsSchema]) {
    let validationError;
    const request = { body: undefined, params: {}, query: {} };
    validate(schema)(request, {}, (error) => { validationError = error; });
    assert.equal(validationError, undefined);
    assert.deepEqual(request.validated.body, {});
  }
});

test('task updates require a field and validate task IDs', () => {
  assert.equal(updateTaskSchema.safeParse({ body: {}, params: { id: 'a'.repeat(24) }, query: {} }).success, false);
  assert.equal(updateTaskSchema.safeParse({
    body: { status: 'completed' },
    params: { id: 'a'.repeat(24) },
    query: {},
  }).success, true);
});
