const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      resolve(result);
    });
  });
}

async function parseSingleFile(req, res, fieldName = "file") {
  await runMiddleware(req, res, upload.single(fieldName));
  return req.file;
}

module.exports = { parseSingleFile };
