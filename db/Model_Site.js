const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, "You must provide a url"],
    trim: true,
  },
  creationDate: {
    type: Date,
  },
  status: {
    type: String,
  },
  subdirsname: {
    type: Array,
  },
  html: {
    type: Array,
  },
});

module.exports = mongoose.model("Dataset", TaskSchema, "dataset");
