const mongoose = require("mongoose");

const datasetSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  data: {
    type: Array,
    required: true,
  },
  type: {
    type: String,
    enum: ["water", "electricity"],
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  analysis: {
    type: Object,
    default: {},
  },
  metadata: {
    totalRecords: Number,
    dateRange: {
      start: String,
      end: String,
    },
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
});

// Add indexes for better query performance
datasetSchema.index({ userId: 1, type: 1, uploadDate: -1 });
datasetSchema.index({ "metadata.dateRange.start": 1 });
datasetSchema.index({ "metadata.dateRange.end": 1 });

module.exports = mongoose.model("Dataset", datasetSchema);
 