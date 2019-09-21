module.exports = {
  "GET /": (req, res) => res.redirect("/s/index"),
  "GET /favicon.ico": (req, res) => res.status(404).end(),
  "GET /robots.txt": (req, res) => res.type("text/plain").render("robots.ejs"),

  "GET /s/index": (req, res) => {
    res.renderJson({
      title: "CPSU",
      locals: {
        metaTitle: true
      },
      location: {
        base: req.getBaseURL(),
        path: req.path
      },
      body: {
        name: "CPSU",
        fullName: "Communist Processor to Share to U",
        author: "Florian (florian.ws)",
        message: "Welcome! You can view images at /(name) and upload images using the config from /s/sharex",
        disclaimer: "Every user is responsible for their own uploads"
      }
    });
  },
  "GET /s/sharex": (req, res) => {
    let baseUrl = req.getBaseURL();

    res.renderJson({
      title: "ShareX Config - CPSU",
      location: {
        base: baseUrl,
        path: req.path
      },
      locals: {
        metaTitle: true
      },
      body: {
        Version: "12.4.1",
        Name: "CPSU",
        DestinationType: "ImageUploader, TextUploader, FileUploader, URLShortener",
        RequestMethod: "POST",
        RequestURL: baseUrl + "/feed",
        Headers: {
          "CPSU-Key": req.query.key || "(Your key)",
          "CPSU-Processor": "sharex"
        },
        Body: "MultipartFormData",
        Arguments: {
          url: "$input:url$"
        },
        FileFormName: "files",
        URL: baseUrl + "/$json:name$",
        ThumbnailURL: baseUrl + "/$json:name$/thumbnail",
        DeletionURL: baseUrl + "/x/delete/$json:accessKey$"
      }
    });
  },
};
