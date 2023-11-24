const mongoose = require("mongoose");
const { array } = require("wink-nlp/src/as");

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
  problemsDuringScraping: {
    type: Array,
    // I use the undefined default because otherwise it always creates an empty array
    default: undefined,
  },
});

module.exports = mongoose.model("Dataset", TaskSchema, "dataset");
