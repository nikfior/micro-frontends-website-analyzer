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

router.get("/", sessionCheck, (req, res) => {
  res.redirect(`${req.baseUrl}/getMenu`);
});

/**
 * @openapi
 *   /api/sites/getMenu:
 *   get:
 *     description: Returns brief info about all sites
 *     responses:
 *       200:
 *         description: Return info successfully
 *       500:
 *         description: Error occured
 */
router.get("/getMenu", sessionCheck, getMenu);

/**
 * @openapi
 *   /api/sites/analysis:
 *   get:
 *     description: Analyses site
 *     parameters:
 *       - name: id
 *         in: query
 *         description: id of the site to be analyzed
 *         required: true
 *       - name: forcereanalyze
 *         in: query
 *         description: if set to true then the site is analyzed again with the given query parameters. Otherwise left to default, it just returns the saved analysis
 *       - name: uppersubdirnum
 *         in: query
 *         description: maximum number of subdirectories to be analyzed
 *       - name: noOfMicrofrontends
 *         in: query
 *         description: sets the maximum number of microfrontends to search for
 *       - name: useEmbeddedFrequentTreeMining
 *         in: query
 *         description: if set to true, it uses the embedded frequent tree mining merging algorithm. (Use only if the site is to big and there is not enough memory to analyze it normally)
 *       - name: aggressiveTrimming
 *         in: query
 *         description: aggressively trims the frequent trees. (Use only if the site is to big and there is not enough memory to analyze it normally)
 *       - name: pythonlowernodelimit
 *         in: query
 *         description: sets the lower node limit to search for frequent trees for in the gspan library. (dictates the minimum size of the frequent trees)
 *       - name: pythonuppernodelimit
 *         in: query
 *         description: sets the upper node limit to search for frequent trees for in the gspan library. (dictates the maximum size of the frequent trees if useEmbeddedFrequentTreeMining is set to false.)
 *       - name: lowernodelimit
 *         in: query
 *         description: sets the lower node limit of frequent trees. (dictates the minimum size of the frequent trees)
 *       - name: pythonsupport
 *         in: query
 *         description: sets the maximum support of the frequent trees.
 *     responses:
 *       200:
 *         description: Return info about analysis successfully
 *       404:
 *         description: Site with given id not found
 *       500:
 *         description: Error occured
 */
router.get("/analysis", sessionCheck, getTermAnalysis);
router.get("/:id", sessionCheck, getSite);

/**
 * @openapi
 *   /api/sites/:
 *   post:
 *     description: Add new site
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: The url to be crawled.
 *                 example: http://www.example.com
 *               slowCrawl:
 *                 type: boolean
 *                 default: false
 *                 description: the slowcrawl uses a headless browser to crawl the site, executing the javascript code as well.
 *     responses:
 *       201:
 *         description: Return info about site successfully
 *       400:
 *         description: Possible user error. Possibly wrong url
 *       500:
 *         description: Error occured
 */
router.post("/", sessionCheck, createSite);
router.patch("/:id", sessionCheck, updateSite);

/**
 * @openapi
 *   /api/sites/{id}:
 *   delete:
 *     description: Delete site and its analysis
 *     parameters:
 *      -  name: id
 *         in: path
 *         description: id of the site to be deleted
 *         required: true
 *     responses:
 *       200:
 *         description: Site and analysis deleted successfully
 *       404:
 *         description: Not site with given id found
 *       500:
 *         description: Error occured
 */
router.delete("/:id", sessionCheck, deleteSite);

// router.route("/").get(getAllSites).post(createSite);
// router.route("/:id").get(getSite).patch(updateSite).delete(deleteSite);

module.exports = router;
