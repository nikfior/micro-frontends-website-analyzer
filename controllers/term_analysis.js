const DB_Model_Sites = require("../db/Model_Site");
const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const { fork } = require("child_process");

const getTermAnalysis = async (req, res) => {
  try {
    // convert queries to lowercase
    const queriesNorm = {};
    for (const i in req.query) {
      queriesNorm[i.toLowerCase()] = req.query[i];
    }

    // check and verify correct inputs

    // sanitizedId (id) is the id that corresponds to the scraped site. Basically, the datasetSiteId.
    // sanitizedSavedAnalysisId (savedanalysisid) is the id that corresponds to a saved analysis of a scraped site. Basically, it's the _id of the database that saves the analyses.
    const sanitizedId = queriesNorm.id?.toString().match(/^[0-9a-f]*$/i)?.[0];
    // alternative sanitization // const sanitizedId = queriesNorm.id?.toString().replace(/\$/g, "");
    const sanitizedSavedAnalysisId = queriesNorm.savedanalysisid?.toString().match(/^[0-9a-f]*$/i)?.[0];
    if (!sanitizedId) {
      throw new Error("Invalid site id");
    }
    let sanitizedUpperNodeLimit = queriesNorm.uppernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedUpperSubdirNum = queriesNorm.uppersubdirnum?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedPythonSupport = queriesNorm.pythonsupport?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedLowerNodeLimit = queriesNorm.lowernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedPythonUpperNodeLimit = queriesNorm.pythonuppernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    let sanitizedPythonLowerNodeLimit = queriesNorm.pythonlowernodelimit?.toString().match(/^[0-9]*$/)?.[0];
    const sanitizedAggressiveTrimming = queriesNorm.aggressivetrimming?.toString().toLowerCase() === "true";
    const sanitizedUseEmbeddedFrequentTreeMining =
      queriesNorm.useembeddedfrequenttreemining?.toString().toLowerCase() === "true";
    const sanitizedNoOfMicrofrontends = queriesNorm.noofmicrofrontends?.toString().match(/^[0-9]*$/)?.[0];

    const sanitizedPythonExecutable = queriesNorm.pythonexecutable?.toString().match(/^[0-9a-z]+$/)?.[0];

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
    // I then check if the user has given a savedanalysisid and site id which corresponds to a previously saved analysis
    // I check if both the datasetSiteId and the savedanalysisid match one analysis because if I used just the findById I might have returned a saved analysis but the datasetsiteid might belong to another saved site since I do not previously check if the datasetsiteid and savedanalysis id correspond to the same saved analysis
    // Essentially I use both the datasetSiteId in addition to the savedanalysisid which should be enough as a filter, just to make sure there is no discrepancy between the savedanalysisid (sanitizedSavedAnalysisId) and the scraped site's id (sanitizedId) that it corresponds to
    if (sanitizedSavedAnalysisId) {
      dbAnalysis = await DB_Model_Analysis.findOne({
        _id: sanitizedSavedAnalysisId,
        datasetSiteId: sanitizedId,
      });
    }
    // I enter here If there is a saved analysis which corresponds to the savedanalysisid
    if (dbAnalysis) {
      // if the forcereanalyze query is not set to true, then I just return the saved analysis which corresponds to that savedanalysisid
      if (queriesNorm.forcereanalyze?.toString().toLowerCase() !== "true") {
        return res.status(200).json(dbAnalysis);
      }

      // if the forcereanalyze query is set to true, I then reanalyze it and overwrite the previous analysis that corresponds to that savedanalysisid
      // While it is analyzed, return and save to db an "Analyzing..." status
      newdAnalysis = await DB_Model_Analysis.findOneAndUpdate(
        { _id: sanitizedSavedAnalysisId, datasetSiteId: sanitizedId },
        { status: "Analyzing... since " + new Date(), analysis: null, parameters: null },
        { new: true } // , upsert: true }
      );
    }

    // if a savedanalysisid and site id was given but did not correspond to any savedanalysisid and site id in the database, then return a 404.
    else if (sanitizedSavedAnalysisId && !dbAnalysis) {
      return res.status(404).json({ msg: "A saved analysis with the specified parameters was not found" });
    }

    // if a savedanalysisid was not provided, then just analyze and save it to db with a newly created savedanalysisid
    // While it is created, return and save to db an "Analyzing..." status
    else {
      newdAnalysis = await DB_Model_Analysis.create({
        datasetSiteId: sanitizedId,
        url: site.url,
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
      sanitizedPythonExecutable,
    });

    return res.status(201).json(newdAnalysis);
  } catch (error) {
    // console.log(error);
    return res.status(500).json({ msg: error.message });
  }
};

//
//
//

module.exports = { getTermAnalysis };
