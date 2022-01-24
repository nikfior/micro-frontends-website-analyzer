const express = require("express");
const router = express.Router();
const { sessionCheck } = require("../middlewares/check_session");

const { githubLogin, githubLoginCallback, getToken } = require("../controllers/auth");
const { loginSuccess, logoutUser, home } = require("../controllers/controller_root");

router.get("/", home);
router.get("/logout", logoutUser);
router.get("/login/github", githubLogin);
router.get("/login/github/callback", githubLoginCallback);
router.get("/login/getToken", sessionCheck, getToken);
router.get("/login/success", sessionCheck, loginSuccess);

module.exports = router;
