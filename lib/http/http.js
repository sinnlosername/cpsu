const express = require('express'), moment = require('moment'), cors = require('cors');
const session = require("./session");
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
let cpsu;

/* Middleware */
function loggingMiddleware(req, res, next) {
  if (req.path === "/favicon.ico") { // Do not log favicon requests
    next();
    return;
  }

  let ipHeader = cpsu.config.http["realIPHeader"];
  let ip = ipHeader.length > 0 ? req.header(ipHeader) || req.ip : req.ip;
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
  req.cpsu = cpsu;
  req.getBaseURL = () => {
    return (cpsu.config.http["overwriteProtocol"].length > 0 ? cpsu.config.http["overwriteProtocol"]
      : req.protocol) + '://' + req.get('host');
  };
  req.getClientInfo = () => {
    let userAgent = req.get("User-Agent") || "";
    return clientDetections.find(cd => cd.names.find(name => userAgent.includes(name + "/"))) || {};
  };

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
  res.createSession = session.createSession;
  res.destroySession = session.destroySession;

  next();
}

/* Validation */
function getValidateHandler(schema) {
  return (req, res, next) => {
    if (req.body == null) {
      res.sendError(400, "This endpoint requires a valid json body");
      return;
    }

    const result = schema.validate(req.body);
    if (result.error) {
      res.sendError(400, result.error.message);
      return;
    }

    next();
  };
}

/* Route definition */
function parsePathDefinition(definition) {
  const split = definition.split(" ");
  return {
    method: split[0],
    path: split.slice(1).join(" ")
  };
}

function parseRouteDefinition(definition) {
  if (typeof definition === "function")
    definition = {handler: definition};
  return definition;
}

function registerRoutes(expressApp, definitions) {
  Object.keys(definitions).forEach(pathDefinition => {
    const path = parsePathDefinition(pathDefinition);
    const route = parseRouteDefinition(definitions[pathDefinition]);
    const handlers = [route.handler];

    if (route.session !== undefined)
      handlers.unshift(session.sessionHandler);

    if (route.validate !== undefined)
      handlers.unshift(getValidateHandler(route.validate));

    expressApp[path.method.toLowerCase()](path.path, ...handlers);
  });
}

/* Error handling */
function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    res.sendError(400, "The supplied body is invalid");
  } else {
    res.sendError(500, "An internal error occured");
    req.log(err.stack, next);
  }
}

module.exports = (rcpsu) => {
  cpsu = rcpsu;

  let expressApp = cpsu.expressApp = express();
  expressApp.disable('x-powered-by');
  expressApp.set('view engine', 'ejs');
  expressApp.set('views', 'resources/views');

  expressApp.use(loggingMiddleware);
  expressApp.use(helperMiddleware);
  expressApp.use(express.json());
  expressApp.use(require("cookie-parser")());
  expressApp.use(errorHandler);

  if (process.env.NODE_ENV === "development") {
    expressApp.use(cors({
      origin: "http://localhost:3000",
      methods: "GET,HEAD,PUT,POST,DELETE",
      preflightContinue: false,
      credentials: true
    }));
  }

  registerRoutes(expressApp, require("./routes/sites"));
  registerRoutes(expressApp, require("./routes/files"));
  registerRoutes(expressApp, require("./routes/dashboard"));

  expressApp.listen(cpsu.config.http.port, cpsu.config.http.host, () => {
    cpsu.log.http("Server listening on %s:%d", cpsu.config.http.host, cpsu.config.http.port);
  });
};