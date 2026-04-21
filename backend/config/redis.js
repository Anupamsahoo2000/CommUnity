const Redis = require("ioredis");

const client = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// prevents the app from crashing if redis is down
client.on("error", (err) => {});

client.clear = async (pattern) => {
  try {
    const keys = await client.keys(pattern);
    if (keys.length) await client.del(keys);
  } catch (e) {}
};

module.exports = client;