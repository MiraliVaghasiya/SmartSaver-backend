const express = require("express");
const router = express.Router();
const { OAuth2Client } = require("google-auth-library");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const User = require("../model/User");
require("dotenv").config();

// Import controllers & validation middleware
const { signup, login } = require("../controllers/AuthController");
const {
  signupValidation,
  loginValidation,
} = require("../middlewares/AuthValidadion");

// Normal Login and Signup
router.post("/login", loginValidation, login);
router.post("/signup", signupValidation, signup);

// Google One Tap Authentication
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res
        .status(400)
        .json({ success: false, message: "Missing credential" });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;

    let user = await User.findOne({ email });

    if (!user) {
      user = new User({ name, email, googleId });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
    }

    const jwtToken = jwt.sign(
      { email, _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ success: true, jwtToken, name, email });
  } catch (error) {
    console.error("Google Login Error:", error);
    res.status(401).json({ success: false, message: "Invalid Google token" });
  }
});

// Google OAuth Redirect Flow (Passport)
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    if (!req.user) {
      return res.redirect("http://localhost:3000/login");
    }

    // Generate JWT Token
    const token = jwt.sign(
      { email: req.user.email, _id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Redirect to frontend with token
    res.redirect(
      `http://localhost:3000/google-auth-success?token=${token}&name=${req.user.name}`
    );
  }
);

router.post("/google-signup", async (req, res) => {
  const { credential } = req.body;
  if (!credential)
    return res
      .status(400)
      .json({ success: false, message: "Missing credential" });

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    // Check if user already exists in DB
    let user = await User.findOne({ email: payload.email });
    if (!user) {
      user = new User({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
      });
      await user.save();
    }

    // Generate JWT token
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ success: true, jwtToken: token });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Google authentication failed" });
  }
});

module.exports = router;
