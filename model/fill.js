const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema({
  filename: String,
  filedata: Buffer,
  uploadedBy: String,
  uploadedAt: Date,
});

const File = mongoose.model("File", fileSchema);
