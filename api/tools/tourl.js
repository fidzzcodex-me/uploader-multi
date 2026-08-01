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
          "User-Agent": "multiput/1.0 (+https://catbox.moe/tools.php)"
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
        message: "catbox.moe menolak file ini (kemungkinan tipe file tidak diizinkan atau server sedang membatasi permintaan).",
        detail: typeof upload.data === "string" ? upload.data.slice(0, 300) : upload.data
      });
    }

    return res.json({
      status: true,
      creator: "multiput",
      result: { url: resultUrl }
    });

  } catch (e) {
    const status = e.response?.status;
    let message = e.response?.data;
    message = typeof message === "string" ? message.slice(0, 300) : (e.message || "Terjadi kesalahan saat menghubungi catbox.moe");

    if (status === 412) {
      message = "catbox.moe menolak permintaan (412). Biasanya karena file tidak didukung atau server sedang memblokir permintaan otomatis — coba lagi beberapa saat.";
    }

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
