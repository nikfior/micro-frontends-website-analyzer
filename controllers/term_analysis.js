const DB_Model_Sites = require("../db/Model_Site");
const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const { fork } = require("child_process");

const getTermAnalysis = async (req, res) => {
  const sanitizedId = req.query.id.toString().replace(/\$/g, "");
  // ---------------------------------------------TODO use Set to remove duplicates; check for title, not only text
  // save the analysis in the db and here at the beginning check if it exists in the db first and if it doesn't then execute it and save it in the db then
  // maybe even it analyzes for first time add loading animation and say it might take a while
  try {
    const site = await DB_Model_Sites.findById(sanitizedId);
    if (!site) {
      return res.status(404).json({ msg: "Site not found for analysis. Please add site first" });
    }

    const dbAnalysis = await DB_Model_Analysis.findOne({ datasetSiteId: sanitizedId });

    if (dbAnalysis && dbAnalysis.status.startsWith("Analyzing")) {
      return res.json(dbAnalysis);
    }

    // here and below if it's completed or not done yet

    // if there is a forceReanalyze query then reanalyze it and don't get it from the database
    if (!req.query.forcereanalyze) {
      if (dbAnalysis && dbAnalysis.status.startsWith("Completed")) {
        return res.json(dbAnalysis);
      }

      if (dbAnalysis && dbAnalysis.status.startsWith("Error")) {
        return res.json(dbAnalysis);
      }
    }

    const newdAnalysis = await DB_Model_Analysis.findOneAndUpdate(
      { datasetSiteId: sanitizedId },
      { status: "Analyzing......... since " + new Date(), analysis: null },
      { new: true, upsert: true }
    );

    const childProcess = fork("./controllers/children/child_termAnalysis");
    childProcess.send({ sanitizedId });

    return res.json(newdAnalysis);
  } catch (error) {
    // console.log(error);
    return res.status(500).json({ msg: error.message });
  }
};

//
//
//

module.exports = { getTermAnalysis };
