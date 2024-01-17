// If the app terminates unexpectedly then the children won't have finished their work. So mark their unfinished worked as error instead of as pending
// also delete any leftover .txt files that were created as part of the analysis but not deleted due to the unexpected termination

const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const DB_Model_Sites = require("../db/Model_Site");
const { unlinkSync, readdirSync } = require("fs");
const { extname } = require("path");

const childrenCleanup = async () => {
  await DB_Model_Analysis.updateMany(
    { status: /^Analyzing\.\.\./ },
    {
      status: "Error analyzing. Cleaned up at " + new Date(),
      analysis: null,
    }
  );

  await DB_Model_Sites.updateMany(
    { status: /^Scraping\.\.\./ },
    {
      status: "Error scraping. Cleaned up at " + new Date(),
    }
  );

  readdirSync(".").forEach((file) => {
    if (
      extname(file) === ".txt" &&
      /^[0-9a-fA-F]+(?:gspanInKmeans|gspanInSingleLink|gspanInCompleteLink).txt$/.test(file)
    ) {
      unlinkSync(file);
    }
  });

  //
};

module.exports = { childrenCleanup };
