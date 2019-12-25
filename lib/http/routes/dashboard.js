const argon2 = require("argon2"), joi = require("@hapi/joi");
const argon2Params = {
  memoryCost: 1024 * 16,
  parallelism: 2,
  timeCost: 2,
  type: argon2.argon2id,
  raw: false
};

module.exports = {
  "GET /x/user/stats": {
    session: true,
    handler: async (req, res) => {
      res.sendOkay(await req.cpsu.database.getUserStats(req.user.userId));
    }
  },
  "GET /x/user/files/:page": {
    session: true,
    validate: joi.object({
      page: joi.number().min(0)
    }),
    handler: async (req, res) => {
      res.sendOkay((await req.cpsu.database.getFilesByUser(req.user.userId, req.params.page, 10)).map(file => {
        return {
          fileId: file.fileId,
          name: file.name,
          fileName: file.fileName,
          mimeType: file.mimeType,
          creationDate: file.creationDate,
          deletionDate: file.deletionDate,
          size: file.size,
          accessKey: file.accessKey
        };
      }));
    }
  },
  "GET /x/user/profile": {
    session: true,
    handler: async (req, res) => {
      res.sendOkay({
        username: req.user.name,
        key: req.user.key
      });
    }
  },
  "POST /x/user/password": {
    session: true,
    validate: joi.object({
      newPassword: joi.string().required().min(8)
    }),
    handler: async (req, res) => {
      const hashedPassword = await argon2.hash(req.body.newPassword, argon2Params);

      await req.cpsu.database.updateUserPassword(req.user.userId, hashedPassword);
      res.sendOkay({});
    }
  },
  "POST /x/user/session": {
    validate: joi.object({
      username: joi.string().required(),
      password: joi.string().required()
    }),
    handler: async (req, res) => {
      const username = req.body.username, password = req.body.password;
      const user = await req.cpsu.database.getUserByName(username);
      if (user == null || user.userId === 0) {
        res.sendError(403, "Invalid username or password");
        return;
      }

      const keyLogin = user.key === password;
      const passLogin = user.password != null && (await argon2.verify(user.password, password));
      if (!keyLogin && !passLogin) {
        res.sendError(403, "Invalid username or password");
        return;
      }

      if (user["banned"] === 1) {
        res.sendError(403, "Your account is banned");
        return;
      }

      res.createSession(req, res, user);
      res.sendOkay({
        redirect: "home"
      });
    }
  },
  "DELETE /x/user/session": (req, res) => {
    res.destroySession(req, res);
    res.sendOkay({
      redirect: "login"
    });
  }
};