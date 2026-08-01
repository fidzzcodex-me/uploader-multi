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

    fd.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });

    const upload = await axios.post(
      "https://njy.my.id/api/upload",
      fd,
      {
        headers: fd.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      }
    );

    if (!upload.data || upload.data.status === false || !upload.data.result) {
      return res.status(502).json({
        status: false,
        message: "njy.my.id menolak file ini.",
        detail: upload.data
      });
    }

    return res.json({
      status: true,
      creator: "multiput",
      result: upload.data.result
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

