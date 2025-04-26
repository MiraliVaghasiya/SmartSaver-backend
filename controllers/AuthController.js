const bcrypt = require("bcrypt");
const usermodel = require("../model/User");
const jwt = require("jsonwebtoken");

const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please provide name, email, and password",
        success: false,
      });
    }

    const existingUser = await usermodel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists, you can login",
        success: false,
      });
    }

    // Encrypt password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new usermodel({ name, email, password: hashedPassword });
    await user.save();

    // ✅ Generate JWT Token immediately after signup
    const jwtToken = jwt.sign(
      { email: user.email, _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(201).json({
      message: "Signup successful",
      success: true,
      jwtToken, // ✅ Send token to frontend
      name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email and password", success: false });
    }

    const user = await usermodel.findOne({ email });
    const errorMessage = "Authentication failed: Incorrect email or password";

    if (!user) {
      return res.status(403).json({ message: errorMessage, success: false });
    }

    // Compare entered password with hashed password
    const isPassEqual = await bcrypt.compare(password, user.password);
    if (!isPassEqual) {
      return res.status(403).json({ message: errorMessage, success: false });
    }

    const jwtToken = jwt.sign(
      { email: user.email, _id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Login successful",
      success: true,
      jwtToken,
      email,
      name: user.name,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error", success: false });
  }
};

module.exports = { signup, login };
