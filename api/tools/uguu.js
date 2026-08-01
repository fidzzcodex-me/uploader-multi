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
    fd.append("files[]", file.buffer, { filename: file.originalname });

    const upload = await axios.post(
      "https://uguu.se/upload",
      fd,
      {
        headers: {
          ...fd.getHeaders(),
          "User-Agent": "multiput/1.0 (+https://uguu.se)"
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 60000
      }
    );

    let data = upload.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (_) { /* keep as string, handled below */ }
    }
    const uploaded = data && data.success && Array.isArray(data.files) && data.files[0];

    if (!uploaded || !uploaded.url) {
      return res.status(502).json({
        status: false,
        message: "uguu.se menolak file ini atau format respons berubah.",
        detail: typeof data === "string" ? data.slice(0, 300) : data
      });
    }

    return res.json({
      status: true,
      creator: "multiput",
      result: {
        url: uploaded.url,
        hash: uploaded.hash,
        filename: uploaded.filename,
        size: uploaded.size,
        dupe: uploaded.dupe || false
      }
    });

  } catch (e) {
    const status = e.response?.status;
    let message = e.response?.data;
    message = typeof message === "string" ? message.slice(0, 300) : (e.message || "Terjadi kesalahan saat menghubungi uguu.se");

    return res.status(status || 500).json({
      status: false,
      message,
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
