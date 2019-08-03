const mimeTypes = require('mime-types'), fs = require("fs"), path = require("path");

module.exports = async (req, res, cpsu) => {
    let contentLength = req.header("Content-Length");
    if (!contentLength || contentLength > cpsu.config.app["maxSingleFileSizeMB"] * 1024 * 1024) {
        res.sendError(413, "Upload exceeds maximum file size or content length is missing");
        return;
    }

    if (!req.header('content-type')) {
        res.sendError(400, "Content type is missing");
        return;
    }

    let extension = mimeTypes.extension(req.header('content-type'));
    if (!extension || extension.length === 0) {
        res.sendError(422, "Unable to resolve extension for content type");
        return;
    }

    let name = await cpsu.findFreeName(), accessKey = cpsu.generateKey();
    let filePath = path.resolve("data/" + name + "." + extension);
    let stream = req.pipe(fs.createWriteStream(filePath));

    stream.on('finish', async () => {
        await cpsu.database.insertFile({
            name: name,
            fileName: name + "." + extension,
            mimeType: req.header("content-type"),
            userId: req.user.userId,
            accessKey: accessKey,
            creationDate: cpsu.database.date(Date.now()),
            size: contentLength,
            processor: "sharex"
        });

        res.sendOkay({
            name: name,
            accessKey: accessKey
        });
    });

};