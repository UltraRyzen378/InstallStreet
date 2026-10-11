'use strict';

async function installLatestUpdate({ updates, install, workActive }) {
  if (workActive()) throw new Error('Wait for setup and StorageSense to finish before updating.');
  if (!updates.downloaded) {
    await updates.check();
    if (!updates.release) return { current: true };
    await updates.download();
  }
  return install();
}

module.exports = { installLatestUpdate };
