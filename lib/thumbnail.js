const sharp = require("sharp"), fs = require("fs"), os = require("os"), path = require("path");
const contentTypes = [
    "image/jpeg", "image/png", "image/gif", "image/tiff"
];
const files = [];

function sharpResize(inputFile) {
    return sharp(inputFile)
        .resize({ height: 240, width: 426, fit: "fill"})
        .jpeg( {
            quality: 90,
            force: true
        })
        .toBuffer();
}

function clearDirectory(dir) {
    let list = fs.readdirSync(dir);

    for(let i = 0; i < list.length; i++) {
        let filename = path.join(dir, list[i]);
        if (filename === "." || filename === "..") continue;
        fs.unlinkSync(filename);
    }
}

module.exports = (cpsu) => {
    const thumbnail = {
        cleanup(extra) {
            let totalSize = files.reduce((total, cur) => total + cur.size, 0) + extra;
            while (totalSize > thumbnail.maxCacheSize && files.length > 0)
                fs.unlinkSync(files.shift().filePath);
        },

        async generate(name, inputFile, type) {
            if (!contentTypes.includes(type))
                return null;

            let file = files.find(file => file.name === name);
            if (file && fs.existsSync(file.filePath))
                return fs.readFileSync(file.filePath);

            let outputBuffer = await sharpResize(inputFile);
            let filePath = thumbnail.tempFolder + path.sep + name + ".thumbnail.jpg";
            thumbnail.cleanup(outputBuffer.length);

            fs.writeFileSync(filePath, outputBuffer);
            files.push({
                name: name,
                filePath: filePath,
                size: outputBuffer.length
            });

            return outputBuffer;
        }
    };

    thumbnail.tempFolder = os.tmpdir() + path.sep + "cpsu-thumbnails";
    thumbnail.maxCacheSize = cpsu.config.app["maxThumbnailCacheMB"] * 1024 * 1024;

    if (fs.existsSync(thumbnail.tempFolder))
        clearDirectory(thumbnail.tempFolder);
    else
        fs.mkdirSync(thumbnail.tempFolder);

    return thumbnail;
};