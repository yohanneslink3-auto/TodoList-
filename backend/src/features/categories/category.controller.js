const Category = require('./category.model');
const Task = require('../tasks/task.model');

function notFound() {
  const error = new Error('Category not found.');
  error.status = 404;
  return error;
}

const controller = {
  async list(req, res) {
    const categories = await Category.find({ user: req.user.id }).sort({ name: 1 }).lean();
    res.json({ categories });
  },
  async create(req, res) {
    const category = await Category.create({ ...req.validated.body, user: req.user.id });
    res.status(201).json({ category });
  },
  async update(req, res) {
    const category = await Category.findOneAndUpdate(
      { _id: req.validated.params.id, user: req.user.id },
      { $set: req.validated.body },
      { returnDocument: 'after', runValidators: true },
    );
    if (!category) throw notFound();
    res.json({ category });
  },
  async remove(req, res) {
    const { id } = req.validated.params;
    const category = await Category.findOneAndDelete({ _id: id, user: req.user.id });
    if (!category) throw notFound();
    await Task.updateMany({ user: req.user.id, category: id }, { $set: { category: null } });
    res.status(204).end();
  },
};

module.exports = { controller };
