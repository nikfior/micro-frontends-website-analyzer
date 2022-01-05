const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  accessToken: {
    type: String,
    required: [true, "Access token not provided"],
  },
  githubId: {
    type: String,
    required: [true, "Github Id not provided"],
  },
});

module.exports = mongoose.model("User", UserSchema);
