const toml = require('toml'), fs = require('fs'), path = require('path');
const crypto = require('crypto'), mimeTypes = require('mime-types');
const cpsu = {
    log: {
        http: require('debug')('cpsu:http'),
        app: require('debug')('cpsu:app')
    }
};

module.exports = async function start() {
    if (!fs.existsSync("config.toml"))
    {
        cpsu.log.app("Config file missing");
        process.exit(1);
    }

    if (!fs.existsSync("data"))
        fs.mkdir("data");

    cpsu.config = toml.parse(fs.readFileSync("config.toml", "utf8"));
    cpsu.database = await require("./database")(cpsu);

    await syncDataFolder();
    await require("./http")(cpsu);
};

/* File folder */
async function syncDataFolder() {
    let filesInDatabase = await cpsu.database.getAllFileNames();
    let files = fs.readdirSync("data");

    cpsu.log.app("Synchronizing data folder with database");

    for (let index in files) {
        let file = files[index], parsedName = parseFileName(file);
        if (!isValidName(parsedName.name)) continue;

        let fileStat = fs.statSync("data/" + file);
        if (!fileStat.isFile() || filesInDatabase.includes(file)) continue;

        cpsu.log.app("File '%s' exists in folder, but not in database. Inserting it with default user", file);

        await cpsu.database.insertFile({
            name: parsedName.name,
            fileName: file,
            mimeType: mimeTypes.lookup(parsedName.extension) || mimeTypes.lookup('bin'),
            creationDate: cpsu.database.date(fileStat.mtime),
            size: fileStat.size,
            accessKey: cpsu.generateKey(),
            processor: "datasync",
            userId: 0
        });
    }

    for (let index in filesInDatabase) {
        if (!filesInDatabase.hasOwnProperty(index)) continue;

        let fileName = filesInDatabase[index];
        if (files.includes(fileName)) continue;

        cpsu.log.app("File '%s' exists in data, but not in folder. Deleting it from database", fileName);

        await cpsu.database.deleteFileByFileName(fileName);
    }
}

/* Http */


/* Naming & Security */
const alphanumericChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";

function isValidName(name) {
    return name.length > 0 && name.length < 20 && !name.includes('.');
}

function parseFileName(fileName) {
    let extension =  path.extname(fileName);
    return {
        extension: extension,
        name: fileName.substr(0, fileName.length - extension.length)
    }
}

function generateName() {
    let bytes = crypto.randomBytes(cpsu.config.app["nameLength"] * 4), result = "";

    for (let i = 0; i < bytes.length; i += 4) {
        let num = parseInt(bytes.subarray(i, i + 4).toString('hex'), 16);
        result += alphanumericChars[num % alphanumericChars.length];
    }

    return result;
}

cpsu.generateRandomAlphaNumeric = (len) => {
    let result = "";
    while (len-- !== 0) {
        result += alphanumericChars[Math.floor(Math.random() * alphanumericChars.length)];
    }
    return result;
};

cpsu.findFreeName = async function() {
    let name = generateName();
    while (await cpsu.database.nameExists(name)) name = generateName();
    return name;
};

cpsu.generateKey = function() {
    return crypto.randomBytes(16).toString('hex');
};


