const Notification = require('./notification.model');

function notFound() {
  const error = new Error('Notification not found.');
  error.status = 404;
  return error;
}

const controller = {
  async list(req, res) {
    const [data, unreadCount] = await Promise.all([
      Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).populate('task', 'title status').lean(),
      Notification.countDocuments({ user: req.user.id, readAt: null }),
    ]);
    res.json({ data, unreadCount });
  },
  async markRead(req, res) {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { readAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!notification) throw notFound();
    res.json({ notification });
  },
  async markAllRead(req, res) {
    await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    res.status(204).end();
  },
  async dismiss(req, res) {
    const notification = await Notification.findOneAndDelete({
      _id: req.validated.params.id,
      user: req.user.id,
    });
    if (!notification) throw notFound();
    res.status(204).end();
  },
};

module.exports = { controller };
