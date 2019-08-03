if (!process.env.DEBUG)
    process.env.DEBUG="cpsu:*";
require("../lib/app.js")();