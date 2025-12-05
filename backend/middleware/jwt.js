const jwt = require("jsonwebtoken");
require("dotenv").config();

const authenticate = (roles = []) => {
  // roles can be string or array
  if (typeof roles === "string") {
    roles = [roles];
  }

  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      if (roles.length && !roles.includes(decoded.role)) {
        return res
          .status(403)
          .json({ message: "Forbidden: insufficient role" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
};

module.exports = authenticate;
