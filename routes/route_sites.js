const express = require("express");
const router = express.Router();

const {
  getAllSites,
  getMenu,
  createSite,
  getSite,
  updateSite,
  deleteSite,
} = require("../controllers/controller_sites");

const { sessionCheck } = require("../middlewares/check_session");

const { getTermAnalysis } = require("../controllers/term_analysis");

router.get("/", sessionCheck, getAllSites);
router.get("/getMenu", sessionCheck, getMenu);
router.get("/analysis", sessionCheck, getTermAnalysis);
router.get("/:id", sessionCheck, getSite);
router.post("/", sessionCheck, createSite);
router.patch("/:id", sessionCheck, updateSite);
router.delete("/:id", sessionCheck, deleteSite);

// router.route("/").get(getAllSites).post(createSite);
// router.route("/:id").get(getSite).patch(updateSite).delete(deleteSite);

module.exports = router;
