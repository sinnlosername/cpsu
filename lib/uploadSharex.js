const mimeTypes = require('mime-types'), fs = require("fs"), path = require("path");
const multiparty = require("multiparty"), tmp = require("tmp"), urlRegex = require('url-regex');

//func
module.exports = (req, res, cpsu) => {
    if (!req.header("Content-Type") || !req.header("Content-Type").startsWith("multipart/form-data")) {
        res.sendError(400, "Expected multipart, found " + req.header("Content-Type"));
        return;
    }

    let form = new multiparty.Form({
        maxFields: 1,
        maxFieldsSize: cpsu.config.app["maxSingleFileSizeMB"] * 1024 * 1024
    });

    form.parts = [];
    form.on('error', function (err) {
        if (err.name === "PayloadTooLargeError") {
            res.sendError(413, "The multipart body may only have one part")
        } else {
            res.sendError(500, "An unknown error occured");
            req.log("Unknown multipart error", err.stack);
        }
    });

    form.on('part', function (part) {
        if (!["files", "url"].includes(part.name)) {
            res.sendError(400, "Multipart body may only contain 'files' or 'url' field");
            part.resume();
            return;
        }

        form.partCache = new PartCache();
        form.partCache.put(part);
    });

    form.on('close', async function () {
        if (!form.partCache) {
            res.sendError(400, "No request parts found");
            return;
        }

        if (form.partCache.error) {
            res.sendError(500, "Unknown error while reading body");
            req.log("Unknown error while reading body part", form.partCache.error);
            return;
        }

        if (form.partCache.name === "files") {
            await handleFile(req, res, cpsu, form.partCache);
        } else if (form.partCache.name === "url") {
            await handleURL(req, res, cpsu, form.partCache);
        }
    });

    form.parse(req);
};

async function handleURL(req, res, cpsu, partCache) {
    if (partCache.byteCount > 2048 || partCache.byteCount < 1) {
        res.sendError(400, "URL length must be between 1 and 2048 characters");
        return;
    }

    let url = Buffer.from(partCache.toString(), 'binary').toString("ascii").trim();
    if (!urlRegex({exact: true, strict: false}).test(url)) {
        res.sendError(400, "Not a valid url");
        return;
    }

    let name = await cpsu.findFreeName(), accessKey = cpsu.generateKey();
    await cpsu.database.insertFile({
        name: name,
        fileName: null,
        link: url,
        mimeType: "text/uri-list",
        userId: req.user.userId,
        accessKey: accessKey,
        creationDate: cpsu.database.date(Date.now()),
        size: partCache.byteCount,
        processor: "sharex"
    });

    res.sendOkay({
        name: name,
        accessKey: accessKey
    });
}

async function handleFile(req, res, cpsu, partCache) {
    if (!partCache.headers || !partCache.headers["content-type"]) {
        res.sendError(400, "Missing content type on part");
        return;
    }

    let extension = mimeTypes.extension(partCache.headers["content-type"]);
    if (!extension || extension.length === 0) {
        res.sendError(422, "Unknown content type on part");
        return;
    }

    let name = await cpsu.findFreeName(), accessKey = cpsu.generateKey();
    partCache.toFile(path.resolve("data/" + name + "." + extension));

    await cpsu.database.insertFile({
        name: name,
        fileName: name + "." + extension,
        mimeType: partCache.headers["content-type"],
        userId: req.user.userId,
        accessKey: accessKey,
        creationDate: cpsu.database.date(Date.now()),
        size: partCache.byteCount,
        processor: "sharex"
    });

    res.sendOkay({
        name: name,
        accessKey: accessKey
    });
}

class PartCache {
    put(part) {
        this.name = part.name;
        this.filename = part.filename;
        this.headers = part.headers;
        this.byteCount = part.byteCount;

        if (part.byteCount < 1024 * 100) { // 100 KB
            this.data = '';
            part.setEncoding('binary');
            part.on('data', (chunk) => this.data += chunk);
            part.on('error', (err) => this.error = err);
        } else {
            this.file = tmp.fileSync(undefined);

            let stream = part.pipe(fs.createWriteStream(this.file.name, 'binary'));
            stream.on('error', (err) => this.error = err);
        }
    }

    toFile(path) {
        if (this.data) {
            fs.writeFileSync(path, this.data, 'binary');
        } else if (this.file) {
            fs.renameSync(this.file.name, path);
        }
        this.cleanup();
    }

    toString() {
        if (this.data) {
            return this.data;
        } else if (this.file) {
            return fs.readFileSync(this.file.name, 'binary');
        }
        this.cleanup();
    }

    cleanup() {
        if (this.data) {
            delete this.data;
        } else if (this.file) {
            // noinspection JSCheckFunctionSignatures
            this.file.removeCallback();
        }
    }
}