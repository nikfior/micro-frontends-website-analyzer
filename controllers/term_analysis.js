const DB_Model_Sites = require("../db/Model_Site");
const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const { fork } = require("child_process");

const getTermAnalysis = async (req, res) => {
  try {
    // check and verify correct inputs

    // sanitizedId (id) is the id that corresponds to the scraped site. Basically, the datasetSiteId.
    // sanitizedSavedAnalysisId (savedanalysisid) is the id that corresponds to a saved analysis of a scraped site. Basically, it's the _id of the database that saves the analyses.
    const sanitizedId = req.query.id?.toString().match(/^[0-9a-f]*$/i)?.[0];
    // alternative sanitization // const sanitizedId = req.query.id?.toString().replace(/\$/g, "");
    const sanitizedSavedAnalysisId = req.query.savedanalysisid?.toString().match(/^[0-9a-f]*$/i)?.[0];
    if (!sanitizedId) {
      throw new Error("Invalid site id");
    }
    let sanitizedUpperNodeLimit = req.query.uppernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedUpperSubdirNum = req.query.uppersubdirnum?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedPythonSupport = req.query.pythonsupport?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedLowerNodeLimit = req.query.lowernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedPythonUpperNodeLimit = req.query.pythonuppernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedPythonLowerNodeLimit = req.query.pythonlowernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    const sanitizedAggressiveTrimming = req.query.aggressivetrimming?.toString().toLowerCase() === "true";
    const sanitizedUseEmbeddedFrequentTreeMining =
      req.query.useembeddedfrequenttreemining?.toString().toLowerCase() === "true";
    const sanitizedNoOfMicrofrontends = req.query.noofmicrofrontends?.toString().match(/^[0-9]*$/)?.[0];

    //
    //

    // -----------------------------------
    // Each analysis is saved in the db with a specific savedanalysisid.
    // Here in the beginning I check if the scraped site with the given id exists.
    // If not then I return a 404.
    // If it exists then I move on (to create the analysis or find it from the db).
    const site = await DB_Model_Sites.findById(sanitizedId);
    if (!site) {
      return res.status(404).json({ msg: "Site not found for analysis. Please add site first" });
    }

    let newdAnalysis;
    let dbAnalysis;
    // I then check if the user has given a savedanalysisid which corresponds to a previously saved analysis
    if (sanitizedSavedAnalysisId) {
      dbAnalysis = await DB_Model_Analysis.findById(sanitizedSavedAnalysisId);
    }
    // I enter here If there is a saved analysis which corresponds to the savedanalysisid
    if (dbAnalysis) {
      // if the forcereanalyze query is not set, I just return the saved analysis which corresponds to that savedanalysisid
      if (
        !req.query.forcereanalyze?.toString() ||
        req.query.forcereanalyze?.toString().toLowerCase() === "false"
      ) {
        return res.json(dbAnalysis);
      }

      // if the forcereanalyze query is set, I then reanalyze it and overwrite the previous analysis that corresponds to that savedanalysisid
      // While it is analyzed, return and save to db an "Analyzing..." status
      // I also use the datasetSiteId as a filter in addition to the savedanalysisid which should be enough, just to make sure there is no discrepancy between the savedanalysisid (sanitizedSavedAnalysisId) and the scraped site's id (sanitizedId) that it corresponds to
      newdAnalysis = await DB_Model_Analysis.findOneAndUpdate(
        { _id: sanitizedSavedAnalysisId, datasetSiteId: sanitizedId },
        { status: "Analyzing... since " + new Date(), analysis: null, parameters: null },
        { new: true } // , upsert: true }
      );

      if (!newdAnalysis) {
        throw new Error(
          "Error starting the analysis. Possible discrepancy between savedanalysisid and scraped site's id"
        );
      }
    }

    // if there is not a saved analysis that corresponds to the savedanalysisid because the savedanalysisid didn't correspond with a saved analysis or because it was not provided, then just analyze and save it to db with a newly created savedanalysisid
    // While it is created, return and save to db an "Analyzing..." status
    else {
      newdAnalysis = await DB_Model_Analysis.create({
        datasetSiteId: sanitizedId,
        status: "Analyzing... since " + new Date(),
        analysis: null,
        parameters: null,
      });
    }

    if (!newdAnalysis) {
      throw new Error("Error starting the analysis");
    }

    const childProcess = fork("./controllers/children/child_termAnalysis");
    childProcess.send({
      sanitizedId,
      sanitizedSavedAnalysisId: newdAnalysis.id,
      sanitizedUpperNodeLimit,
      sanitizedUpperSubdirNum,
      sanitizedPythonSupport,
      sanitizedLowerNodeLimit,
      sanitizedPythonUpperNodeLimit,
      sanitizedPythonLowerNodeLimit,
      sanitizedAggressiveTrimming,
      sanitizedUseEmbeddedFrequentTreeMining,
      sanitizedNoOfMicrofrontends,
    });

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
