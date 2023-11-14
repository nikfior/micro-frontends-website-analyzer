const mongoose = require("mongoose");

const connectDB = (url) => {
  // strictQuery should be set to false, because otherwise it removes the filter properties (queries) that aren't in the schema.
  // So if it would be set to true and I accidentally used a schema property that isn't included in the schema eg. id instead of _id in findOneAndUpdate({id:xxx},{randomPropert:xxx}) then it would return and update the first random document it finds. It would be equivalent to findOneAndUpdate({},{randomPropert:xxx})
  mongoose.set("strictQuery", false);
  return mongoose.connect(url);
};

module.exports = connectDB;
