const DB_Model_Sites = require("../db/Model_Site");
const DB_Model_Users = require("../db/Model_Users");
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
    const sites = await DB_Model_Sites.find({}, "_id url creationDate");
    const userDB = await DB_Model_Users.findById(req.middlewareUserId);
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
    if (!sanitizedUrl.startsWith("http://") && !sanitizedUrl.startsWith("https://")) {
      sanitizedUrl = "http://" + sanitizedUrl;
    }

    // test for url validity
    const html = await axios.get(sanitizedUrl);

    const childProcess = fork("./controllers/children/child_createSite");
    childProcess.send({ url: sanitizedUrl });

    return res
      .status(201)
      .json({ msg: "The site is being scraped. The new listing will be shown in the menu when ready" });
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
    const sanitizedId = req.params.id.toString().replace(/\$/g, "");
    const site = await DB_Model_Sites.findOneAndDelete({ _id: sanitizedId });
    if (!site) {
      return res.status(404).json({ msg: `No site with id: ${sanitizedId}` });
    }
    res.status(200).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.message });
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
