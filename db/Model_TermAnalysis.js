const mongoose = require("mongoose");

const AnalysisSchema = new mongoose.Schema({
  siteId: {
    type: mongoose.ObjectId,
  },
  analysis: Object,
});

module.exports = mongoose.model("Analyses", AnalysisSchema, "analyses");
