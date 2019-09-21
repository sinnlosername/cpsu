const argon2 = require("argon2"), joi = require("@hapi/joi");
const argon2Params = {
  memoryCost: 1024 * 8,
  parallelism: 1,
  type: argon2.argon2id
};

module.exports = {
  "GET /x/user/stats": {
    session: true,
    handler: async (req, res) => {
      res.sendOkay(await req.cpsu.database.getUserStats(req.user.userId));
    }
  },

  "POST /x/user/session": {
    validate: joi.object({
      username: joi.string().required(),
      password: joi.string().required()
    }),
    handler: async (req, res) => {
      let username = req.body.username, password = req.body.password;

      let user = await req.cpsu.database.getUserByName(username);
      if (user && (user.key === password || (user.password != null && await argon2.verify(user.password, password)))) {
        res.createSession(req, res, user);
        res.sendOkay({
          redirect: "home"
        });
        return;
      }

      res.sendError(403, "Invalid username or password");
    }
  },
  "DELETE /x/user/session": (req, res) => {
    res.destroySession(req, res);
    res.sendOkay({
      redirect: "login"
    });
  }
};


