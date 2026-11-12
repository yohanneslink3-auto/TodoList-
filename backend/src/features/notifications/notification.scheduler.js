const { processDueJobs, reconcileTaskJobs } = require('./notification.service');

function startReminderScheduler() {
  let stopped = false;
  let running = false;
  let initialized = false;
  let timer;

  async function poll() {
    if (stopped || running) return;
    running = true;
    try {
      if (!initialized) {
        await reconcileTaskJobs();
        initialized = true;
      }
      await processDueJobs();
    } catch (error) {
      console.error(`Reminder scheduler failed: ${error.message}`);
    } finally {
      running = false;
      if (!stopped) {
        timer = setTimeout(poll, 30_000);
        timer.unref();
      }
    }
  }

  poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

module.exports = { startReminderScheduler };
