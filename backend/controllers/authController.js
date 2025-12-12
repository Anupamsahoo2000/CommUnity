const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const { uploadPublicFile } = require("../utils/s3");
const { User } = require("../models/sql");

require("dotenv").config();

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
};

const signup = async (req, res) => {
  try {
    const { name, email, password, role, city, lat, lng } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email and password are required" });
    }

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: passwordHash,
      role: role || "USER",
      city,
      lat,
      lng,
    });

    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        city: user.city,
        lat: user.lat,
        lng: user.lng,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        city: user.city,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: ["id", "name", "email", "role", "city", "lat", "lng"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * POST /auth/me/avatar
 * Auth: required
 * Form-data field: avatar (file)
 */
const uploadAvatar = async (req, res) => {
  try {
    const user = req.user;
    const file = req.file;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!file) {
      return res.status(400).json({ message: "avatar file is required" });
    }

    const ext = path.extname(file.originalname) || ".jpg";
    const key = `users/${user.id}/avatar${ext}`;

    const avatarUrl = await uploadPublicFile(file.buffer, key, file.mimetype);

    await User.update({ avatarUrl }, { where: { id: user.id } });

    return res.json({ avatarUrl });
  } catch (err) {
    console.error("uploadAvatar error:", err);
    return res.status(500).json({ message: "Failed to upload avatar" });
  }
};

module.exports = {
  signup,
  login,
  getUserProfile,
  uploadAvatar,
};
