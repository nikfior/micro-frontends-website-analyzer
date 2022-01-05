// const DB_Model_Users = require("../db/Model_Users");
const axios = require("axios");

const githubLogin = async (req, res) => {
  try {
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URL}`
    );
  } catch (error) {
    res.status(500).json({ msg: error.name });
  }
};

const githubLoginCallback = async (req, res) => {
  try {
    const code = req.query.code;
    const access_token = await getAccessToken({
      code,
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
    });

    const user = await getGithubUser(access_token);
    if (user) {
      req.session.accessToken = access_token;
      req.session.githubId = user.data.id.toString();

      //   await DB_Model_Users.create({
      //     accessToken: access_token,
      //     githubId: user.data.id,
      //   });

      res.redirect("/admin");
    } else {
      res.send("Login did not succeed!");
    }
  } catch (error) {
    res.status(500).json({ msg: error.name });
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
        "Content-Type": "application/json",
      },
    }
  );
  const params = new URLSearchParams(response.data);
  return params.get("access_token");
};

const getGithubUser = async (token) => {
  const response = await axios.get("https://api.github.com/user", {
    headers: {
      Authorization: "bearer " + token,
    },
  });
  return response;
};

module.exports = {
  githubLogin,
  githubLoginCallback,
};
