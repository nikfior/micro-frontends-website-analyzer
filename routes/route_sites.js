const express = require("express");
const router = express.Router();

const {
  getAllSites,
  createSite,
  getSite,
  updateSite,
  deleteSite,
} = require("../controllers/controller_sites");

router.get("/", getAllSites);
router.post("/", createSite);
router.get("/:id", getSite);
router.patch("/:id", updateSite);
router.delete("/:id", deleteSite);

// router.route("/").get(getAllSites).post(createSite);
// router.route("/:id").get(getSite).patch(updateSite).delete(deleteSite);

module.exports = router;
