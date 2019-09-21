const fs = require("fs"), path = require("path");

const richViews = [
  {
    pattern: /image\/\w/,
    view: "image-viewer",
    requiresBody: false
  },
  {
    pattern: /text\/plain/,
    view: "text-viewer",
    requiresBody: true
  },
  {
    pattern: /video\/\w/,
    view: "video-viewer",
    requiresBody: false
  }
];

const uploadProcessors = {
  "simple": require("../../uploadSimple"),
  "sharex": require("../../uploadSharex.js"),
};

module.exports = {
  "POST /feed": async (req, res) => {
    let key = req.get("CPSU-Key") || req.get("USSR-Key");
    if (!key) {
      res.sendError(401, "No key provided");
      return;
    }

    let processor = req.get("CPSU-Processor") || req.get("USSR-Processor");
    if (!processor) {
      res.sendError(400, "No processor provided");
      return;
    }

    req.user = await req.cpsu.database.getUserByKey(key.trim());
    if (!req.user || req.user.userId < 1) {
      res.sendError(401, "Provided key is not valid");
      return;
    }

    let processorFunc = uploadProcessors[processor];
    if (!processorFunc) {
      res.sendError(400, "Provided processor could not be found");
      return;
    }

    processorFunc(req, res, req.cpsu);
  },
  "GET /:name": async (req, res) => {
    if (req.originalUrl.endsWith("+")) { // Shortcut for /full
      res.redirect(req.path.substr(0, req.path.length - 1) + "/full");
      return;
    }

    if (req.originalUrl.endsWith("?")) { // Shortcut for /info
      res.redirect(req.path + "/info");
      return;
    }

    let info = await req.cpsu.database.getFileByName(req.params.name);
    if (!info || info["deletionDate"]) {
      res.sendError(404, "This file does not exist or was deleted");
      return;
    }

    res.set("Cache-Control", req.cpsu.config.app["fileCachingHeader"]);
    if (info.link) {
      res.redirect(302, info.link);
      return;
    }

    let richView = richViews.find((elem) => elem.pattern.test(info["mimeType"]));
    if (richView && req.params.name === info.name && req.getClientInfo().richView) {
      let body;
      if (richView.requiresBody)
        body = fs.readFileSync(path.resolve("data/" + info.fileName), "utf8");

      res.render(richView.view, {
        title: info.name + " - CPSU Viewer",
        location: {
          base: req.getBaseURL(),
          path: req.path
        },
        locals: {},
        body: body,
        info: info
      });

      req.log("File viewer served");
      return;
    }

    try {
      res.type(info["mimeType"]).sendFile(path.resolve("data/" + info.fileName));
      req.log("File served");
    } catch (e) {
      req.log("Error while serving file");
    }
  },
  "GET /:name/:action": async (req, res) => {
    let info = await req.cpsu.database.getFileByName(req.params.name);

    if (!info || info["deletionDate"]) {
      res.sendError(404, "This file does not exist or was deleted");
      return;
    }

    let action = req.params.action;
    if (action === "info") {
      req.log("File info served");
      res.sendOkay({
        name: info.name,
        fileName: info.fileName,
        mimeType: info.mimeType,
        size: info.size
      });
      return;
    }

    if (action === "full") {
      req.log("File redirect served");
      res.redirect("../" + info.fileName);
      return;
    }

    if (action === "thumbnail") {
      let thumbnail = await req.cpsu.thumbnail.generate(info.name, "data/" + info.fileName, info.mimeType);

      if (thumbnail === null) {
        res.sendError(422, "This file type does not have thumbnails");
        return;
      }

      res.type("image/jpeg").end(thumbnail);
      return;
    }

    res.sendError(404, "This action does not exist");
  },
  "GET /x/delete/:key": async (req, res) => {
    let info = await req.cpsu.database.getFileByAccessKey(req.params.key);

    if (!info) {
      res.sendError(404, "There is no file with this key");
      return;
    }

    if (info["deletionDate"]) {
      res.sendError(404, "This file was already deleted");
      return;
    }

    await req.cpsu.database.deleteFileByFileId(info["fileId"]);

    if (info.fileName !== null) { // Links do not have a file
      fs.unlinkSync("data/" + info.fileName);
    }

    res.sendOkay({
      "name": info["name"],
      "message": "The file was deleted"
    });
  }
};
