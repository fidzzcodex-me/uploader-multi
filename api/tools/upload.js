const axios = require("axios");
const FormData = require("form-data");
const crypto = require("crypto");
const { parseSingleFile } = require("../_lib/parseMultipart");

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  try {
    const file = await parseSingleFile(req, res, "file");
    const expired = req.body?.expired || "60menit";

    let buffer;
    let filename = "file";

    if (file) {
      buffer = file.buffer;
      filename = file.originalname || "file";
    } else if (req.body?.file_url) {
      const response = await axios.get(req.body.file_url, {
        responseType: "arraybuffer"
      });
      buffer = Buffer.from(response.data);
      filename = req.body.file_url.split("/").pop().split("?")[0] || "file";
    } else {
      return res.status(400).json({
        status: false,
        message: "Upload file atau isi parameter file_url."
      });
    }

    const form = new FormData();
    form.append("file", buffer, { filename });
    form.append("expired", expired);

    const sessionId = "sess_" + crypto.randomBytes(16).toString("hex") + "_" + Date.now();
    const fingerprint = crypto.randomBytes(16).toString("hex");
    const csrfToken = crypto.randomBytes(32).toString("base64").replace(/[+/=]/g, "");

    const { data } = await axios.post(
      "https://unggah.web.id/api/unggah",
      form,
      {
        headers: {
          ...form.getHeaders(),
          Cookie: `sessionId=${sessionId}; fingerprint=${fingerprint}; csrfToken=${csrfToken}`,
          "X-Csrf-Token": csrfToken,
          Origin: "https://unggah.web.id",
          Referer: "https://unggah.web.id/pengunggah",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36"
        }
      }
    );

    return res.json({
      status: true,
      creator: "multiput",
      result: {
        fileName: data.fileName,
        fileId: data.fileId,
        url: data.url,
        size: data.size,
        sizeKB: (data.size / 1024).toFixed(2),
        expired: expired,
        expiredAt: data.expiredAt
      }
    });

  } catch (err) {
    return res.status(err.response?.status || 500).json({
      status: false,
      message: err.message,
      detail: err.response?.data || null
    });
  }
}

handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;
