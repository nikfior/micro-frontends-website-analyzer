const express = require("express");
const router = express.Router();

const {
  getAllSites,
  createSite,
  getSite,
  updateSite,
  deleteSite,
} = require("../controllers/controller_sites");

const { sessionCheck } = require("../middlewares/check_session");

const { getTermAnalysis } = require("../controllers/term_analysis");

router.get("/", getAllSites);
router.get("/search", getTermAnalysis);
router.get("/:id", getSite);
router.post("/", createSite);
router.patch("/:id", updateSite);
router.delete("/:id", deleteSite);

// router.route("/").get(getAllSites).post(createSite);
// router.route("/:id").get(getSite).patch(updateSite).delete(deleteSite);

module.exports = router;
