const toml = require("@iarna/toml"), fs = require("fs"), prompts = require("prompts"), crypto = require('crypto');
const mysql = require('promise-mysql'), readline = require('readline');
let config;

process.on('SIGINT', () => process.exit());

async function prompt(opts) {
    opts.name = "value";
    // noinspection JSUnusedGlobalSymbols
    return await prompts(opts, {
        onCancel: () => process.exit()
    });
}

async function select(opts) {
    opts.type = "select";
    opts.initial = 0;
    return await prompt(opts);
}

async function confirm(message, def) {
    return await prompt({
        type: 'confirm',
        message: message,
        initial: def
    })
}

async function selectCustom(opts, copts) {
    opts.choices.push({title: "Custom", value: "custom"});
    copts.name = "value";
    let result = await select(opts);

    if (result.value === "custom") {
        result = await prompt(copts);
    }

    return result;
}

function saveConfig() {
    fs.writeFileSync("config.toml", toml.stringify(config));
}

async function configureMenu() {
    let opts = {
        message: "What do you wanna do?",
        choices: [
            { title: "Configure web server",  value: 0 },
            { title: "Configure application", value: 1 },
            { title: "Configure database", value: 2 },
            { title: "Save and exit", value: 3},
            { title: "Exit", value: 4 }
        ],
    };

    let value;
    do {
        value = (await select(opts)).value;

        switch (value) {
            case 0: {
                await configureHTTP();
                break;
            }
            case 1: {
                await configureApp();
                break;
            }
            case 2: {
                await configureDatabase();
                break;
            }
            case 3:
                saveConfig();
                break;
            case 4: break
        }

    } while (value < 3);
}

async function configureWizard() {
    console.log("> No 'config.toml' found, looks like you're running this the first time");
    console.log("> This setup wizard will lead you trough all configuration options\n");
    console.log("> Let's start with the basic web server configuration");
    await configureHTTP();

    console.log("\n> Next let's configure the application itself");
    await configureApp();

    console.log("\n> Now let's configure the database for the server");
    await configureDatabase();

    await saveConfig();
    console.log("\n> Setup wizard finished. Configuration will be saved to config.toml");
    console.log("> You can now run the server using 'npm start'");
}


async function configureHTTP() {
    if (!config.http)
        config.http = {};

    config.http.host = (await selectCustom({
        message: "Who shall be able to access the sharing server?",
        choices: [
            { title: "Everyone (0.0.0.0)", value: "0.0.0.0"},
            { title: "Only this machine (localhost)",  value: "localhost" }
        ],
    }, {
        type: "text",
        message: "Custom HTTP Host: ",
        validate: value => value.length > 0 ? true : "Please enter a value"
    })).value;

    config.http.port = (await selectCustom({
        message: "Under which port shall the server be reachable?",
        choices: [
            { title: "Alternate HTTP (8080)",  value: 8080 },
            { title: "Default HTTP (80)", value: 80}
        ],
    }, {
        type: "number",
        message: "Custom HTTP Port",
        validate: value => value >= 1 && value <= 65535 ? true : "Port must be a number between 1 and 65535"
    })).value;

    let httpProxy = await confirm("Will this server be located behind a reverse proxy?", false);
    if (httpProxy.value) {
        config.http.overwriteProtocol = (await confirm("Does your proxy use https?", false)).value ? "https" : "";
        config.http.realIPHeader = (await selectCustom({
            message: "Which header do you want to use to resolve the real ip behind the proxy?",
            choices: [
                { title: "X-Forward-For",  value: "X-Forward-For" },
                { title: "X-Real-IP",  value: "X-Real-IP" },
                { title: "CF-Connecting-IP", value: "CF-Connecting-IP"}
            ],
        }, {
            type: "text",
            message: "Custom real ip header",
            validate: value => value.length > 0 ? true : "Please enter a value"
        })).value;
    } else {
        config.http.overwriteProtocol = "";
        config.http.realIPHeader = "";
    }
}

async function configureApp() {
    if (!config.app)
        config.app = {};

    config.app.nameLength = (await selectCustom({
        message: "Every uploaded file gets a random generated name. How long shall those names be?",
        choices: [
            {title: "4 characters (simple)", value: 4},
            {title: "12 characters (secure)", value: 20},
            {title: "20 characters (overkill)", value: 20},
        ],
    }, {
        type: "number",
        message: "Name length",
        validate: value => value >= 4 && value <= 20 ? true : "Name length must be a number between 4 and 20"
    })).value;

    config.app.maxSingleFileSizeMB = (await prompt({
        type: "number",
        message: "What's the maximum size an uploaded file may have (in megabytes)?",
        validate: value => {
            return value > 0 || typeof value === "string" ? true : "File size must be bigger than 0"
        },
        initial: 50
    })).value;

    config.app.maxThumbnailCacheMB = (await prompt({
        type: "number",
        message: "Generated thumbnails will be temporarly stored. How big may this storage?",
        validate: value => value > 0 || typeof value === "string" ? true : "Maximum storage size must be bigger than 0",
        initial: 25
    })).value;

    config.app.fileCachingHeader = (await selectCustom({
        message: "Browers and proxies can temporary store files. How long shall they store files?",
        choices: [
            {title: "Don't store at all", value: "no-cache, no-store, must-revalidate"},
            {title: "Store for 1 hour", value: "public, max-age=3600, s-maxage=3600"},
            {title: "Store for 4 hours", value: "public, max-age=14400, s-maxage=14400"},
            {title: "Store for 1 day", value: "public, max-age=‭86400‬, s-maxage=‭86400‬"}
        ],
    }, {
        type: "text",
        message: "Caching Header (Cache-Control)",
        validate: value => value.length > 0 ? true : "Please enter a value"
    })).value;
}

async function configureDatabase() {
    if (!config.database)
        config.database = {};

    config.database.host = (await prompt({
        type: "text",
        message: "What's the ip/host of your database server?",
        initial: "localhost",
        validate: value => value.length > 0 ? true : "Please enter a hostname"
    })).value;

    config.database.port = (await prompt({
        type: "number",
        message: "What's the port of your database server?",
        validate: value => (value >= 1 && value <= 65535) || typeof value === "string" ? true : "Port must be between 1 and 65535",
        initial: 3306
    })).value;

    config.database.user = (await prompt({
        type: "text",
        message: "Which database user shall be used?",
        initial: "cpsu",
        validate: value => value.length > 0 ? true : "Please enter a username"
    })).value;

    config.database.password = (await prompt({
        type: "text",
        message: `What's the password of the database user '${config.database.user}'?`,
        initial: config.database.user==="cpsu" ? "cpsu" : "",
        validate: value => value.length > 0 ? true : "Please enter a password"
    })).value;

    config.database.database = (await prompt({
        type: "text",
        message: `What's the name of your database?`,
        initial: config.database.user==="cpsu" ? "cpsu" : "",
        validate: value => value.length > 0 ? true : "Please enter a database name"
    })).value;

    config.database.connections = (await prompt({
        type: "number",
        message: "How many simultaneous database connections shall the server keep?",
        validate: value => (value >= 1) || typeof value === "string" ? true : "Please enter a number bigger than 0",
        initial: 5
    })).value;

    let connection;
    try {
        console.log("> Trying to connect to database");
        connection = await getDatabaseConnection();
        console.log("> Database connection successful. Great!");

        let tableCount = (await query(connection,
            "SELECT count(*) as count FROM information_schema.tables where table_schema=?;",
            [config.database.database]))[0].count;

        let confirmMessage = "Looks like this database is empty. Do you want to execute the " +
            "setup script for the database? If not, you must do this manually before starting the server";

        if (tableCount < 1 && (await confirm(confirmMessage, true)).value) {
            await setupDatabase(connection);
        }
    } catch (e) {
        let confirmMessage = `Unable to connect to database (${e.message}). Do you want to change database settings?`;

        if ((await confirm(confirmMessage, true)).value) {
            return await configureDatabase();
        }
        return false;
    } finally {
        await trashConnection(connection);
    }

    return true;
}


function setupDatabase(connection) {
    async function execute(lines) {
        let nextStatement = "", error;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];

            if (line.startsWith("--")) continue; // Comment
            if (line.startsWith("/*")) { // Version comment
                console.log("> Executing statement for version " + line.replace("/*", "")
                    .replace("*/", "").trim());
                continue;
            }

            if (!line.endsWith(";")) { // Statement not finished
                nextStatement += line + " ";
                continue;
            }
            nextStatement += line;

            try {
                await query(connection, nextStatement.trim(), []);
                nextStatement = "";
            } catch (e) {
                error = e;
                break;
            }
        }

        if (error) {
            console.log(`> An error occured while setting up the database (${error.message})`);
            return;
        }

        console.log("> The database setup script was successfully executed! :O");
        let name = (await prompt({
            type: "text",
            message: "In order to upload files you need a user. How do you want to call your first user?",
            validate: isUsernameValid
        })).value;

        let key = await addUser(connection, name);
        console.log(`\n> The user '${name}' was successfully created. The key is: ${key}`);
        console.log(`> (!) Please save this key, you will need it later to upload files (!)`);
    }

    return new Promise((resolve) => {
        const stream = fs.createReadStream('setup.sql');
        const rl = readline.createInterface({
            input: stream,
            terminal: false
        });

        rl.lines = [];
        rl.on('line', function(chunk) {
            rl.lines.push(chunk);
        });
        rl.on('close', function(){
            execute(rl.lines).finally(resolve)
        });
    });
}

async function addUser(connection, name) {
    let key = crypto.randomBytes(16).toString('hex');
    await query(connection,
        "insert into user (name, `key`) values (?, ?)",
        [name, key]);

    return key;
}

function isUsernameValid(name) {
    const validChars = "abcdefghijklmnopqrstuvwxyz1234567890_";
    if (name.length < 1 || name.length > 100)
        return "A username must be between 1 and 100 characters";

    name = name.toLowerCase();
    for (let i = 0; i < name.length; i++)
        if (!validChars.includes(name.charAt(i)))
            return "A username may only contain A-Z, 0-9 and underscores";
    return true;
}

function query(connection, sql, values) {
    return new Promise((resolve, reject) => {
        connection.query(sql, values, (err, results) => {
            if (err)
                reject(err);
            else
                resolve(results || undefined);
        })
    });
}

function trashConnection(connection) {
    return new Promise((resolve) => {
        if (!connection) {
            resolve();
            return;
        }
        connection.end()["then"](resolve)["error"](() => {});
    });
}

function getDatabaseConnection() {
    return new Promise((resolve, reject) => {
        mysql.createConnection(config.database)["then"](con => {
            resolve(con);
        }).catch(reject);
    })
}

(async function() {
    let configExists = fs.existsSync("config.toml");
    config = configExists  ? toml.parse(fs.readFileSync("config.toml")) : {};

    if (configExists)
        await configureMenu();
    else
        await configureWizard();
})();
