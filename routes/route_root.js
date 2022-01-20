const express = require("express");
const router = express.Router();
const { sessionCheck } = require("../middlewares/check_session");

const { githubLogin, githubLoginCallback } = require("../controllers/auth");
const {
  adminPanel,
  logoutUser,
  home,
} = require("../controllers/controller_root");

router.get("/", home);
router.get("/admin", sessionCheck, adminPanel);
router.get("/logout", logoutUser);
router.get("/login/github", githubLogin);
router.get("/login/github/callback", githubLoginCallback);

module.exports = router;
