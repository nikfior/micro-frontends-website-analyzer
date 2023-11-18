const DB_Model_Sites = require("../db/Model_Site");
const DB_Model_Users = require("../db/Model_Users");
const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const { fork } = require("child_process");
const axios = require("axios");

// const jsdom = require("jsdom");
// const { JSDOM } = jsdom;

const getAllSites = async (req, res) => {
  try {
    const sites = await DB_Model_Sites.find({});
    res.status(200).json({ sites });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const getMenu = async (req, res) => {
  try {
    const sitesDB = await DB_Model_Sites.find({}, "url creationDate status");
    const userDB = await DB_Model_Users.findById(req.middlewareUserId);
    const analysis = await DB_Model_Analysis.find({}, "status parameters datasetSiteId");
    const sites = sitesDB.map((site) => {
      // // const anal = analysis.find((x) => x.datasetSiteId === site._id.toString());
      const anal = [];
      analysis.forEach((x) => {
        if (x.datasetSiteId === site.id) {
          anal.push({ savedAnalysisId: x.id, analysisStatus: x.status, parameters: x.parameters });
        }
      });
      return {
        id: site.id,
        url: site.url,
        creationDate: site.creationDate,
        scrapeStatus: site.status,
        analyses: anal,
      };
    });
    res.status(200).json({ sites, username: userDB.githubUsername });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const createSite = async (req, res) => {
  try {
    if (!req.body.url) {
      return res.status(400).json({ msg: "The url to be processed is missing" });
    }

    let sanitizedUrl = req.body.url.toString();
    const sanitizedSlowCrawl = req.body.slowCrawl?.toString().toLowerCase() === "true";
    if (!sanitizedUrl.startsWith("http://") && !sanitizedUrl.startsWith("https://")) {
      sanitizedUrl = "http://" + sanitizedUrl;
    }

    // test for url validity
    const html = await axios.get(sanitizedUrl);

    const newScrapedSite = await DB_Model_Sites.create({
      url: sanitizedUrl,
      status: "Scraping... since " + new Date(),
      html: null,
      subdirsname: null,
      creationDate: null,
    });

    const childProcess = fork("./controllers/children/child_createSite");
    childProcess.send({
      siteId: newScrapedSite.id,
      url: sanitizedUrl,
      useHeadlessBrowser: sanitizedSlowCrawl,
    });

    return res.status(201).json({ msg: "The site is being scraped." });
  } catch (error) {
    if (error.response) {
      return res.status(400).json({
        msg: "The requested page url returns an error status code. Please make sure the requested webpage works as expected",
      });
    } else if (error.request) {
      return res.status(400).json({
        msg: "The url to be processed is invalid. Make sure you have included the correct protocol (http/https) and that the url is valid",
      });
    }
    return res.status(500).json({ msg: error.message });
  }
};

const getSite = async (req, res) => {
  try {
    const sanitizedId = req.params.id.toString().replace(/\$/g, "");
    const site = await DB_Model_Sites.findOne({
      _id: sanitizedId,
    });
    if (!site) {
      return res.status(404).json({ msg: `No site with id: ${sanitizedId}` });
    }
    res.status(200).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const updateSite = async (req, res) => {
  try {
    const sanitizedId = req.params.id.toString().replace(/\$/g, "");
    const site = await DB_Model_Sites.findOneAndUpdate({ _id: sanitizedId }, req.body, {
      new: true,
      runValidators: true,
    });
    if (!site) {
      return res.status(404).json({ msg: `No site with id: ${sanitizedId}` });
    }
    res.status(200).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

const deleteSite = async (req, res) => {
  try {
    // // const sanitizedId = req.params.id.toString().replace(/\$/g, "");
    const sanitizedId = req.params.id?.toString().match(/^[0-9a-f]*$/i)?.[0];
    const sanitizedSavedAnalysisId = req.query.savedanalysisid?.toString().match(/^[0-9a-f]*$/i)?.[0];
    if (!sanitizedId) {
      throw new Error("Invalid or missing id");
    }

    // If I am given a savedanalysisid query then, I only delete the saved analysis and not the scraped site or the other analyses
    // I use both the site's id in addition to the savedanalysisid which should be enough as a filter, just to make sure there is no discrepancy between the savedanalysisid (sanitizedSavedAnalysisId) and the scraped site's id (sanitizedId) that it corresponds to and also to make sure that the site's id exists
    if (sanitizedSavedAnalysisId) {
      const analysis = await DB_Model_Analysis.findOneAndDelete({
        _id: sanitizedSavedAnalysisId,
        datasetSiteId: sanitizedId,
      });
      if (analysis) {
        return res.status(200).json({ msg: "Analysis deleted successfully" });
      }
      return res.status(404).json({ msg: "No saved analysis with specified parameters" });
    }

    const site = await DB_Model_Sites.findOneAndDelete({ _id: sanitizedId });

    if (!site) {
      return res.status(404).json({ msg: "No saved site with specified id" });
    }

    const analyses = await DB_Model_Analysis.deleteMany({ datasetSiteId: sanitizedId });
    return res.status(200).json({ msg: "Site and analyses deleted successfully" });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

module.exports = {
  getAllSites,
  getMenu,
  createSite,
  getSite,
  updateSite,
  deleteSite,
};
