const express = require('express'), argon2 = require("argon2");
const argon2Params = {
    memoryCost: 1024 * 8,
    parallelism: 1,
    type: argon2.argon2id
};
const sessions = {};

function createSession(req, res, user) {
    let sessionId = req.cpsu.generateKey();
    sessions[sessionId] = user.userId;

    res.cookie("session", sessionId, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7
    });
}

function destroySession(req, res) {
    res.clearCookie("session");

    let sessionId = req.cookies["session"];
    if (!sessionId || typeof sessionId !== "string") return;

    delete sessions[sessionId];
}

function getUserBySession(req) {
    let sessionId = req.cookies["session"];
    if (!sessionId || typeof sessionId !== "string" || sessions[sessionId] === undefined)
        return null;

    let user = req.cpsu.database.getUserById(sessions[sessionId]);
    if (!user)
        return null;

    return user;
}

function checkSessionAPI(req, res, next) {
    req.user = getUserBySession(req);
    if (req.user === null) {
        destroySession(req, res);
        res.sendError(401, "You must be logged in to use this endpoint");
        return;
    }

    next();
}
function checkSessionUI(req, res, next) {
    req.user = getUserBySession(req);
    if (req.user === null) {
        destroySession(req, res);
        res.redirect("/a/login");
        return;
    }

    next();
}

function checkJson(fields) {
    return function (req, res, next) {
        if (!req.header("Content-Type").startsWith("application/json") || !req.body) {
            res.sendError(415, "Only json requests are accepted");
            return;
        }

        for (let i = 0; i < fields.length; i++) {
            if (req.body[fields[i]]) continue;
            res.sendError(400, `Field '${fields[i]}' is missing`);
            return;
        }

        next();
    };
}

async function handleLogin(req, res) {
    let username = req.body.username, password = req.body.password;
    if (typeof username !== "string" || typeof password !== "string") {
        res.sendError(400, "Field has invalid type");
        return;
    }

    let user = await req.cpsu.database.getUserByName(username);
    if (user && (user.key === password || (user.password != null && await argon2.verify(user.password, password)))) {
        createSession(req, res, user);
        res.sendOkay({
            redirect: "overview"
        });
        return;
    }

    res.sendError(403, "Invalid username or password");
}

async function handleLogout(req, res) {
    destroySession(req, res);
    res.sendOkay({
        redirect: "/a/login"
    });
}

module.exports = function(expressApp) {
    expressApp.use('/a', express.static('resources/assets'));
    expressApp.get("/a", (req, res) => res.redirect("login"));
    expressApp.get('/a/login', (req, res) => res.render('dashboard/login'));
    expressApp.get('/a/overview', checkSessionUI, (req, res) => res.render('dashboard/overview'));

    expressApp.post("/x/user/session", checkJson(["username", "password"]), handleLogin);
    expressApp.delete("/x/user/session", handleLogout);
};