const DB_Model_Sites = require("../db/Model_Site");
const axios = require("axios");
// const { parse } = require("node-html-parser");

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

    // const root = parse(html.data);
    // console.log(root.querySelector("input"));

    // console.log(`first ${req.body.url}`);
    // console.log(html);
    const site = await DB_Model_Sites.create({
      url: req.body.url,
      html: html.data,
    });
    res.status(201).json({ site });
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
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
