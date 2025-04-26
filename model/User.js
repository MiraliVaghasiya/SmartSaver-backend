const mongoose = require("mongoose");

// Check if the model already exists
const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function() {
          return !this.googleId; // Password is only required if not using Google auth
        }
    },
      googleId: {
        // ✅ New field for Google authentication
        type: String,
        unique: true,
        sparse: true, // ✅ Allows unique constraint but accepts null values
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    })
  );

module.exports = User;
