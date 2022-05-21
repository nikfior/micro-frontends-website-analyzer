// If the app terminates unexpectedly then the children wont have finished their work. So mark their unfinished worked as error instead of as pending

const DB_Model_Analysis = require("../db/Model_TermAnalysis");

const childrenCleanup = async () => {
  await DB_Model_Analysis.updateMany(
    { status: /^Analyzing\.\.\./ },
    {
      status: "Error analyzing. Cleaned up at " + new Date(),
      analysis: null,
    }
  );

  //   console.log("UN ");
};

module.exports = { childrenCleanup };
