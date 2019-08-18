const mysql = require('promise-mysql'), moment = require('moment');
const instance = {};

instance.date = (jsDate) => {
    return moment(jsDate).format('YYYY-MM-DD HH:mm:ss');
};

instance.query = (sql, values) => {
    if (values === undefined)
        values = [];

    return new Promise((resolve, reject) => {
        instance.pool.query(sql, values, (err, results) => {
            if (err) {
                console.log(err.code);
                console.log(err.message);

                reject(err);
            } else if (results)
                resolve(results);
            else
                resolve();
        })
    });
};

instance.getUserByKey = async (key) => {
    return (await instance.query('select * from user where `key`=?', [key]))[0];
};

instance.getUserByName = async (name) => {
    return (await instance.query('select * from user where `name`=?', [name]))[0];
};

instance.getUserById = async (id) => {
    return (await instance.query('select * from user where `userId`=?', [id]))[0];
};

instance.getFileByName = async (name) => {
    return (await instance.query('select * from file where name=? or fileName=?', [name, name]))[0];
};

instance.getFileByAccessKey = async (key) => {
    return (await instance.query('select * from file where accessKey=?', [key]))[0];
};

instance.deleteFileByFileName = async (fileName) => {
    await instance.query('update file set deletionDate=? where fileName=?', [instance.date(Date.now()), fileName]);
};

instance.deleteFileByFileId = async (fileId) => {
    await instance.query('update file set deletionDate=? where fileId=?', [instance.date(Date.now()), fileId]);
};


instance.getAllFileNames = async () => {
    return (await instance.query('select fileName from file where deletionDate is null')).map((r) => r.fileName).filter(n => n !== null);
};

instance.nameExists = async (name) => {
    return (await instance.query('select name from file where name=?', [name])).length > 0;
};

instance.insertFile = async (file) => {
    await instance.query(
        'insert into file (name, fileName, mimeType, userId, accessKey, creationDate, size, processor, link) VALUES (?,?,?,?,?,?,?,?,?)',
        [file.name, file.fileName, file.mimeType, file.userId, file.accessKey, file.creationDate, file.size, file.processor, file.link || null])
};

module.exports = (cpsu) => {
    return new Promise((resolve) => {
        let config = cpsu.config, databaseConfig = {
            connectionLimit : config.database["connections"],
            host: config.database["host"],
            port: config.database["port"],
            user: config.database["user"],
            password: config.database["password"],
            database: config.database["database"],
            reconnect: true
        };

        function handleError(err) {
            cpsu.log.app("Database connected failed", err);
            process.exit(1);
        }

        mysql.createConnection(databaseConfig)["then"](con => {
            con.end().catch(handleError); // End test connection

            mysql.createPool(databaseConfig)["then"](pool => {
                cpsu.log.app("Database connection initialized");
                instance.pool = pool;
                resolve(instance);
            }).catch(handleError);
        }).catch(handleError);
    });
};


