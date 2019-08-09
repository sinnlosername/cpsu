const express = require('express'), fs = require('fs'), moment = require('moment'), path = require('path');
let cpsu;
const uploadProcessors = {
    "simple": require("./uploadSimple"),
    "sharex": require("./uploadSharex.js"),
};
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
const noCache = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "Sun, 11 Mar 1984 13:37:00 GMT"
};
const clientDetections = [
    {
        names: ["Trident", "AppleWebKit", "Gecko", "Presto"], // Browser render engines
        richView: true
    },
    {
        names: ["Discordbot", "Twitterbot", "facebookexternalhit"], // Social media bots
        richView: true
    }
];

/* Routes */
async function handleShareXConfig(req, res) {
    let baseUrl = req.getBaseURL();

    res.renderJson({
        title: "ShareX Config - CPSU",
        location: {
            base: baseUrl,
            path: req.path
        },
        locals: {
            metaTitle: true
        },
        body: {
            Version: "12.4.1",
            Name: "CPSU",
            DestinationType: "ImageUploader, TextUploader, FileUploader, URLShortener",
            RequestMethod: "POST",
            RequestURL: baseUrl + "/feed",
            Headers: {
                "CPSU-Key": req.query.key || "(Your key)",
                "CPSU-Processor": "sharex"
            },
            Body: "MultipartFormData",
            Arguments: {
                url: "$input:url$"
            },
            FileFormName: "files",
            URL: baseUrl + "/$json:name$",
            ThumbnailURL: baseUrl + "/$json:name$/thumbnail",
            DeletionURL: baseUrl + "/x/delete/$json:accessKey$"
        }
    });
}

async function handleIndex(req, res) {
    res.renderJson({
        title: "CPSU",
        locals: {
            metaTitle: true
        },
        location: {
            base: req.getBaseURL(),
            path: req.path
        },
        body: {
            name: "CPSU",
            fullName: "Communist Processor to Share to U",
            author: "Florian (florian.ws)",
            message: "Welcome! You can view images at /(name) and upload images using the config from /s/sharex",
            disclaimer: "Every user is responsible for their own uploads"
        }
    });
}

async function handleDeleteFile(req, res) {
    let info = await cpsu.database.getFileByAccessKey(req.params.key);

    if (!info) {
        res.sendError(404, "There is no file with this key");
        return;
    }

    if (info["deletionDate"]) {
        res.sendError(404, "This file was already deleted");
        return;
    }

    await cpsu.database.deleteFileByFileId(info["fileId"]);

    if (info.fileName !== null) { // Links do not have a file
        fs.unlinkSync("data/" + info.fileName);
    }

    res.sendOkay({
        "name": info["name"],
        "message": "The file was deleted"
    });
}

async function handleGetFileAction(req, res) {
    let info = await cpsu.database.getFileByName(req.params.name);

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
        let thumbnail = await cpsu.thumbnail.generate(info.name, "data/" + info.fileName, info.mimeType);

        if (thumbnail === null) {
            res.sendError(422, "This file type does not have thumbnails");
            return;
        }

        res.type("image/jpeg").end(thumbnail);
        return;
    }

    res.sendError(404, "This action does not exist");
}

async function handleGetFile(req, res) {
    if (req.originalUrl.endsWith("+")) { // Shortcut for /full
        res.redirect(req.path.substr(0, req.path.length - 1) + "/full");
        return;
    }

    if (req.originalUrl.endsWith("?")) { // Shortcut for /info
        res.redirect(req.path + "/info");
        return;
    }

    let info = await cpsu.database.getFileByName(req.params.name);
    if (!info || info["deletionDate"]) {
        res.sendError(404, "This file does not exist or was deleted");
        return;
    }

    res.set("Cache-Control", cpsu.config.app["fileCachingHeader"]);
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
}

async function handleFeed(req, res) {
    let key = req.header("CPSU-Key") || req.header("USSR-Key");
    if (!key) {
        res.sendError(401, "No key provided");
        return;
    }

    let processor = req.header("CPSU-Processor") || req.header("USSR-Processor");
    if (!processor) {
        res.sendError(400, "No processor provided");
        return;
    }

    req.user = await cpsu.database.getUserByKey(key.trim());
    if (!req.user || req.user.userId < 1) {
        res.sendError(401, "Provided key is not valid");
        return;
    }

    let processorFunc = uploadProcessors[processor];
    if (!processorFunc) {
        res.sendError(400, "Provided processor could not be found");
        return;
    }

    processorFunc(req, res, cpsu);
}

/* Middleware */
function loggingMiddleware(req, res, next) {
    if (req.path === "/favicon.ico") { // Do not log favicon requests
        next();
        return;
    }

    let ip = req.header(cpsu.config.http["realIPHeader"]) || req.ip;
    let time = moment(Date.now()).format('DD.MM HH:mm:ss');
    let logInfo = `(IP: ${ip}, Time: ${time}, Host: ${req.get("host")})`;

    req.id = cpsu.generateRandomAlphaNumeric(4);

    cpsu.log.http("[%s] %s %s %s", req.id, req.method, req.path, logInfo);
    req.log = (...args) => {
        args[0] = "[%s] " + args[0];
        args.splice(1, 0, req.id);

        cpsu.log.http.apply(cpsu.log.http, args);
    };
    next();
}

function helperMiddleware(req, res, next) {
    res.renderJson = (data) => {
        if (!req.getClientInfo().richView) {
            res.sendOkay(data.body);
            return;
        }

        res.render("json-viewer", data);
    };
    res.sendOkay = (json) => {
        if (res.sent) return;
        req.log("Responding with okay");

        res.set(noCache).type("application/json; charset=utf8").send(JSON.stringify(json, null, 2));
        res.sent = true;
    };
    res.sendError = (code, message) => {
        if (res.sent) return;
        req.log("Responsing with error. Code: %d, Message: '%s'", code, message);
        res.set(noCache).type("application/json; charset=utf8").status(code).send(JSON.stringify({
            message: message
        }, null, 2));
        res.sent = true;
    };
    req.getBaseURL = () => {
        return (cpsu.config.http["overwriteProtocol"].length > 0 ? cpsu.config.http["overwriteProtocol"]
            : req.protocol) + '://' + req.get('host');
    };
    req.getClientInfo = () => {
        let userAgent = req.header("User-Agent") || "";
        return clientDetections.find(cd => cd.names.find(name => userAgent.includes(name + "/"))) || {};
    };
    next();
}

module.exports = (rcpsu) => {
    cpsu = rcpsu;

    let expressApp = cpsu.expressApp = express();
    expressApp.disable('x-powered-by');
    expressApp.set('view engine', 'ejs');

    expressApp.use(loggingMiddleware);
    expressApp.use(helperMiddleware);

    expressApp.get('/favicon.ico', (req, res) => res.status(404).end());
    expressApp.get('/robots.txt', (req, res) => res.type("text/plain").render("robots.ejs"));
    expressApp.get('/s/index', handleIndex);
    expressApp.get('/s/sharex', handleShareXConfig);
    expressApp.get('/', (req, res) => res.redirect("/s/index"));

    expressApp.get('/x/delete/:key', handleDeleteFile);
    expressApp.get('/:name', handleGetFile);
    expressApp.get('/:name/:action', handleGetFileAction);
    expressApp.post('/feed', handleFeed);

    expressApp.listen(cpsu.config.http.port, cpsu.config.http.host, () => {
        cpsu.log.http("Server listening on %s:%d", cpsu.config.http.host, cpsu.config.http.port);
    });
};