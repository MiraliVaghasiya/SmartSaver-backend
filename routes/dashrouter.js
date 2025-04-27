const ensureAuthenticated = require("../middlewares/auth");
const User = require("../model/User");

const router = require("express").Router();

router.get("/", ensureAuthenticated, (req, res) => {
  console.log("---login user name ---", req.user.email);
  res.status(200).json({ message: "done" });
});

// Add profile endpoint
router.get("/users/profile", ensureAuthenticated, async (req, res) => {
  try {
    // Find user by ID from the token
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return user data
    const userData = {
      username: user.name || "",
      email: user.email || "",
      id: user._id || "",
    };

    res.status(200).json(userData);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

module.exports = router;
