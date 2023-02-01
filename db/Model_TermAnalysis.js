const mongoose = require("mongoose");

const AnalysisSchema = new mongoose.Schema({
  datasetSiteId: {
    type: String,
  },
  status: String,
  parameters: Object,
  analysis: Object,
});

module.exports = mongoose.model("Analyses", AnalysisSchema, "analyses");
