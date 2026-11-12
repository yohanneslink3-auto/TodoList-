const { createTask, deleteTask, getStatistics, getTask, listTasks, updateTask } = require('./task.service');

const controller = {
  async list(req, res) {
    res.json(await listTasks(req.user.id, req.validated.query));
  },
  async create(req, res) {
    res.status(201).json({ task: await createTask(req.user.id, req.validated.body) });
  },
  async get(req, res) {
    res.json({ task: await getTask(req.user.id, req.validated.params.id) });
  },
  async update(req, res) {
    res.json({ task: await updateTask(req.user.id, req.validated.params.id, req.validated.body) });
  },
  async remove(req, res) {
    await deleteTask(req.user.id, req.validated.params.id);
    res.status(204).end();
  },
  async statistics(req, res) {
    res.json({ statistics: await getStatistics(req.user.id, req.validated.query.timezoneOffset) });
  },
};

module.exports = { controller };
