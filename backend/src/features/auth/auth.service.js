const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Category = require('../categories/category.model');
const Session = require('./session.model');
const User = require('./user.model');

const DEFAULT_CATEGORIES = [
  { name: 'Personal', color: '#818cf8' },
  { name: 'Work', color: '#38bdf8' },
  { name: 'Learning', color: '#c084fc' },
  { name: 'Health', color: '#34d399' },
];
const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const transactionSupportByClient = new WeakMap();

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isTransactionUnsupported(error) {
  const causes = [error, error.originalError, error.cause, error.errorResponse?.originalError];
  return causes.some((cause) => cause?.code === 20
    || (cause?.codeName === 'IllegalOperation' && /transaction numbers are only allowed/i.test(cause.message)));
}

async function supportsTransactions() {
  const client = mongoose.connection.getClient();
  if (transactionSupportByClient.has(client)) return transactionSupportByClient.get(client);
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  const supported = Boolean(hello.setName || hello.msg === 'isdbgrid' || hello.serviceId);
  transactionSupportByClient.set(client, supported);
  return supported;
}

async function createUserAndCategories({ name, email, passwordHash }) {
  if (await supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let user;
      await session.withTransaction(async () => {
        [user] = await User.create([{ name, email, passwordHash }], { session });
        await Category.insertMany(
          DEFAULT_CATEGORIES.map((category) => ({ ...category, user: user.id })),
          { session },
        );
      });
      return user;
    } catch (error) {
      if (!isTransactionUnsupported(error)) throw error;
    } finally {
      await session.endSession();
    }
  }

  const user = await User.create({ name, email, passwordHash });
  try {
    await Category.insertMany(DEFAULT_CATEGORIES.map((category) => ({ ...category, user: user.id })));
    return user;
  } catch (registrationError) {
    const cleanupErrors = [];
    try {
      await Category.deleteMany({ user: user.id });
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError);
    }
    try {
      await User.deleteOne({ _id: user.id });
    } catch (cleanupError) {
      cleanupErrors.push(cleanupError);
    }
    if (cleanupErrors.length) {
      throw new AggregateError(
        [registrationError, ...cleanupErrors],
        'Account setup failed and cleanup of its partial records was incomplete.',
      );
    }
    throw registrationError;
  }
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

async function register({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  return createUserAndCategories({ name, email, passwordHash });
}

async function authenticate({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Email or password is incorrect.');
    error.status = 401;
    throw error;
  }
  return user;
}

function createToken(user, jwtSecret) {
  return jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '15m' });
}

async function createSession(user) {
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await Session.create({
    user: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
  });
  return refreshToken;
}

async function rotateSession(refreshToken) {
  if (!refreshToken) return null;
  const nextRefreshToken = crypto.randomBytes(48).toString('base64url');
  const now = new Date();
  const session = await Session.findOneAndUpdate(
    { tokenHash: hashRefreshToken(refreshToken), expiresAt: { $gt: now } },
    {
      $set: {
        tokenHash: hashRefreshToken(nextRefreshToken),
        expiresAt: new Date(now.getTime() + REFRESH_SESSION_TTL_MS),
      },
    },
    { returnDocument: 'after' },
  ).populate('user');
  if (!session?.user) {
    if (session) await Session.deleteOne({ _id: session.id });
    return null;
  }
  return { user: session.user, refreshToken: nextRefreshToken };
}

async function revokeSession(refreshToken) {
  if (!refreshToken) return;
  await Session.deleteOne({ tokenHash: hashRefreshToken(refreshToken) });
}

module.exports = { authenticate, createSession, createToken, publicUser, register, revokeSession, rotateSession };
