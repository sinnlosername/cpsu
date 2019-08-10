# CPSU - Communist Processor to Share to U  
A simple but powerful open source sharing server. It allows you to easily share image, files and links to your comrades. Written in Node.js.

## Simple upload
With this method you can upload a file by sending it as a POST  request body to `http://host:port/feed`. The server will return a `name` parameter containing the name of the created file. It also returns an `accessKey` which can be used to delete the file.

## ShareX upload
[ShareX](https://github.com/ShareX/ShareX) is a free software to share various types of files from your computer. The following types of uploads are supported:
- Image upload
- Text upload (including a fancy text viewer)
- File upload
- URL shortening

You can generate a ShareX configuration for your server at `http://host:port/s/sharex`. It can be imported as a custom uploader in ShareX. 

## View files
You can view files in different ways:
`http://host:port/file`: This will show the file with a viewer for the file type, if available. If not it will return the raw file.
`http://host:port/file.ext`: When adding the extension it will always return the file in a raw format.
`http://host:port/file/full` or `http://host:port/file+`: This will redirect you to the file including the extension
`http://host:port/file/info` or `http://host:port/file?`: This will show basic information about the file (size, type, ...)

## Installation  
The following steps get you a fully-functioning server installation.  

### Prepare
1. Make sure you installed [Node.js](https://nodejs.org) on your system.
2. Make sure you have a MySQL compatible database server.
3. Download or clone the repository into a folder (`git clone https://github.com/sinnlosername/cpsu.git`).

### Setup
4. Run `npm install` in the folder to install all dependencies
5. Run `npm run configure` and follow the instructions. It will guide you trough all configuration parameters
6. Once you successfully configured the server, you can just run it using `npm start`

### Run in background
If you want the server to always run, you can use `tmux` or `screen`. You can install both from your package manager.

I suggest to use `tmux`, due to it being more advanced and more simple. When using `tmux` you can start the
server with the follwoing command: `tmux new -s cpsu npm start`. 

You can leave the tmux session by pressing `CTRL + B` and then `D` and access it again using `tmux a -t cpsu`.

## Configuration
To configure the server run the `npm run configure`. It will guide you trough all settings. The server must be 
restarted to apply changed settings. 

However you can also find the configuration in the `config.toml`. The following options are available:
  
#### HTTP
`host`: The hostname which the server should listen to. Example: `localhost`
`port`: The port which the server should listen to. Example: `8080`
`overwriteProtocol`: If your server is behind a proxy you can set this to overwrite the protocol. Example: `https`
`realIPHeader`: If your server is behind a proxy you can set this to fetch the real ip from headers (visible in logs). Example: `x-forward-for`

#### Database
`host`: The hostname of your MySQL server. Example: `localhost`
`port`: The port of your MySQL server. Example: `3306`
`user`: The MySQL username. Example: `cpsu`
`password`: The MySQL password. Example: `cpsu`
`database`: The MySQL database name. Example: `cpsu`
`connections`: The amount of connections the server keeps open in it's connection pool. Example: `5`

#### App
`nameLength`: The length of generated file names. Names can contain characters from A-Z, a-z and 0-9. Example: `4`
`maxSingleFileSizeMB`: The maximum size a single file may have (in MB). Example: `50`
`fileCachingHeader`: The [caching header](https://developer.mozilla.org/de/docs/Web/HTTP/Headers/Cache-Control) sent when files are served. Example: `no-cache, no-store, must-revalidate`

## Database
The `setup.sql` contains all sql statements to create a database for the server. 
On setup: Execute all statements on the correct database for the server (usually done by running `npm run configure`).
On update: Only execute all statements after the version you have already installed. The sql file contains comments for each version.

## Contributing  
Please consider the following things when contributing to this project:
- The code must work on all systems (Windows, macOS, Linux)
- The code must not contain any ESLint errors according to the projects ESLint configuration
- The code must match the projects code formatting (tab size: 4, spaces as tabs)

## Special thanks to
- Steven ([Github](https://github.com/StevenKGER)): Testing & proofreading texts

## License  
This project is licensed under the MIT License.
