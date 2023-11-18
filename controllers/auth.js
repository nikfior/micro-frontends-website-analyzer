const DB_Model_Users = require("../db/Model_Users");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const githubLogin = async (req, res) => {
  try {
    const frontendRedirectCallback = req.query.frontend_redirect_callback;
    if (frontendRedirectCallback) {
      res.cookie("frontendRedirectCallback", frontendRedirectCallback, {
        signed: true,
      });
    }
    return res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URL}`
    );
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

const githubLoginCallback = async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(401).json({ msg: "Unauthorized" });
    }

    const access_token = await getAccessToken({
      code,
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
    });

    const user = await getGithubUser(access_token);
    if (!user) {
      return res.status(401).json({ msg: "Login did not succeed!" });
    }

    const userDB = await DB_Model_Users.findOneAndUpdate(
      { githubId: user.id },
      { githubUsername: user.login, accessToken: access_token },
      { new: true, upsert: true }
    );

    const frontendRedirectCallback = req.signedCookies.frontendRedirectCallback;
    res.clearCookie("frontendRedirectCallback");

    const jwttoken = jwt.sign({ id: userDB.id }, process.env.COOKIE_JWT_SECRET);

    // For keeping API session (backend)
    res.cookie("jwttoken", jwttoken, { signed: true, maxAge: 1000 * 60 * 60 * 24 * 30 });

    // For keeping frontend session. I send the jwt to the front end for the session in two ways. Through a custom header and as a query in the callback url
    if (frontendRedirectCallback) {
      res.set("Custom-Authorization", jwttoken); // ---------------
      return res.redirect(`${frontendRedirectCallback}?jwttoken=${jwttoken}`);
    }

    return res.redirect("/login/success");
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

const getAccessToken = async ({ code, client_id, client_secret }) => {
  const response = await axios.post(
    "https://github.com/login/oauth/access_token",
    {
      client_id,
      client_secret,
      code,
    },
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  // I can use the following commented lines to get the token if it was not in json format if I didn't include the Accept: "application/json"
  // // const params = new URLSearchParams(response.data);
  // // return params.get("access_token");
  return response.data.access_token;
};

const getGithubUser = async (token) => {
  const response = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: "Bearer " + token,
    },
  });
  return response.data;
};

module.exports = {
  githubLogin,
  githubLoginCallback,
};
