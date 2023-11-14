// If the app terminates unexpectedly then the children won't have finished their work. So mark their unfinished worked as error instead of as pending

const DB_Model_Analysis = require("../db/Model_TermAnalysis");
const DB_Model_Sites = require("../db/Model_Site");

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

  //   console.log("UN ");
};

module.exports = { childrenCleanup };
