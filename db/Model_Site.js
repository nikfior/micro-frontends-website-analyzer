const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, "You must provide a url"],
    trim: true,
  },
  html: {
    type: String,
    required: [true, "html data must be provided"],
  },
});

module.exports = mongoose.model("Site", TaskSchema);
