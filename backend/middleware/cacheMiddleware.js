const client = require("../config/redis");

const cache = (ttl = 300) => async (req, res, next) => {
  if (req.method !== "GET") return next();

  const url = req.originalUrl || req.url;
  const key = req.user?.id ? `cache:u:${req.user.id}:${url}` : `cache:${url}`;

  try {
    const data = await client.get(key);
    if (data) return res.json(JSON.parse(data));

    // capture response to cache it
    const sendJson = res.json;
    res.json = function(body) {
      if (res.statusCode === 200) {
        client.set(key, JSON.stringify(body), "EX", ttl);
      }
      return sendJson.call(this, body);
    };

    next();
  } catch (err) {
    next();
  }
};

module.exports = cache;
