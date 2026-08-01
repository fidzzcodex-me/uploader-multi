const FormData = require("form-data");
const axios = require("axios");
const { parseSingleFile } = require("../_lib/parseMultipart");

async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  try {
    const file = await parseSingleFile(req, res, "file");

    if (!file) {
      return res.status(400).json({
        status: false,
        message: "File wajib diisi. Pastikan field bernama 'file' terlampir di form-data."
      });
    }

    const fd = new FormData();
    fd.append("userhash", "");
    fd.append("reqtype", "fileupload");
    fd.append("fileToUpload", file.buffer, { filename: file.originalname });

    const upload = await axios.post(
      "https://catbox.moe/user/api.php",
      fd,
      {
        headers: {
          ...fd.getHeaders(),
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36",
          "Accept": "application/json",
          "Origin": "https://catbox.moe",
          "Referer": "https://catbox.moe/"
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000
      }
    );

    const resultUrl = typeof upload.data === "string" ? upload.data.trim() : "";

    if (!resultUrl || !resultUrl.startsWith("http")) {
      return res.status(502).json({
        status: false,
        message: "catbox.moe menolak file ini.",
        detail: upload.data
      });
    }

    return res.json({
      status: true,
      creator: "multiput",
      result: { url: resultUrl }
    });

  } catch (e) {
    return res.status(e.response?.status || 500).json({
      status: false,
      message: e.response?.data?.message || e.message,
      detail: e.response?.data || null
    });
  }
}

handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;
