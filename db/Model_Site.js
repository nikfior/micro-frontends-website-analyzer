const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, "You must provide a url"],
    trim: true,
  },
  subdirsname: {
    type: Array,
    required: [true, "html data must be provided"],
  },
  html: {
    type: Array,
    required: [true, "html data must be provided"],
  },
});

module.exports = mongoose.model("Dataset", TaskSchema, "dataset");
