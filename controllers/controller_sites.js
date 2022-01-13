const DB_Model_Sites = require("../db/Model_Site");
const axios = require("axios");
const { parse } = require("node-html-parser");
// const jsdom = require("jsdom");
// const { JSDOM } = jsdom;

const getAllSites = async (req, res) => {
  try {
    const sites = await DB_Model_Sites.find({});
    res.status(200).json({ sites });
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

const createSite = async (req, res) => {
  try {
    // fetch and parse
    const html = await axios.get(req.body.url);
    // console.log(html.status);
    // console.log(html.data);
    const dom = parse(html.data);
    const subDirs = await crawler(dom);
    subDirs.unshift(html.data);

    const site = await DB_Model_Sites.create({
      url: req.body.url,
      html: subDirs,
    });
    res.status(201).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

const crawler = async (dom) => {
  const subdirs = dom.querySelectorAll("a");
  let subdirHTMLArr = [];
  for (let node of subdirs) {
    try {
      let html = await axios.get(node.getAttribute("href"));
      subdirHTMLArr.push(html.data);
    } catch (error) {
      if (
        error.message != "Cannot read property 'replace' of null" ||
        !(error instanceof TypeError)
      ) {
        // console.log("Print error that is not just invalid URL");
        throw error;
      }
    }
  }

  return subdirHTMLArr;
};

const getSite = async (req, res) => {
  try {
    const site = await DB_Model_Sites.findOne({ _id: req.params.id });
    if (!site) {
      return res.status(404).json({ msg: `No site with id: ${req.params.id}` });
    }
    res.status(200).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

const updateSite = async (req, res) => {
  try {
    const site = await DB_Model_Sites.findOneAndUpdate(
      { _id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!site) {
      return res.status(404).json({ msg: `No site with id: ${req.params.id}` });
    }
    res.status(200).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

const deleteSite = async (req, res) => {
  try {
    const site = await DB_Model_Sites.findOneAndDelete({ _id: req.params.id });
    if (!site) {
      return res.status(404).json({ msg: `No site with id: ${req.params.id}` });
    }
    res.status(200).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

module.exports = {
  getAllSites,
  createSite,
  getSite,
  updateSite,
  deleteSite,
};
