const sessions = {};

module.exports = {
  async sessionHandler(req, res, next) {
    const sessionId = req.cookies["session"];
    if (sessionId === undefined || sessions[sessionId] === undefined) {
      res.sendError(401, "You must be logged in to use this endpoint");
      return;
    }

    req.user = await req.cpsu.database.getUserById(sessions[sessionId]);
    if (req.user == null) {
      res.sendError(401, "Your session is invalid. Please login again");
      return;
    }

    next();
  },
  createSession(req, res, user) {
    let sessionId = req.cpsu.generateKey();
    sessions[sessionId] = user.userId;

    res.cookie("session", sessionId, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7
    });

    res.cookie("has_session", "true", {
      httpOnly: false,
      maxAge: 1000 * 60 * 60 * 24 * 7
    })
  },
  destroySession(req, res) {
    res.clearCookie("session").clearCookie("has_session");

    let sessionCookie = req.cookies["session"];
    if (sessionCookie != null && typeof sessionCookie === "string") delete sessions[sessionCookie];
  }
};