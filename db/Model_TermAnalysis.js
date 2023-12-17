const mongoose = require("mongoose");

const AnalysisSchema = new mongoose.Schema({
  datasetSiteId: {
    type: String,
  },
  url: String,
  status: String,
  analysisDate: Date,
  parameters: Object,
  analysis: Object,
});

module.exports = mongoose.model("Analyses", AnalysisSchema, "analyses");
