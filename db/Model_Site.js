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
    // I could use undefined as default in order to not create an empty array when not problem is found
    // default: undefined,
  },
});

module.exports = mongoose.model("Dataset", TaskSchema, "dataset");
