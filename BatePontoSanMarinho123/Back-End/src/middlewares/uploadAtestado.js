const multer = require("multer");
const path = require("path");
const fs = require("fs");

const pastaUploads =
  process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads");

if (!fs.existsSync(pastaUploads)) {
  fs.mkdirSync(pastaUploads, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, pastaUploads);
  },
  filename: (_req, file, cb) => {
    const nomeOriginal = path.basename(
      file.originalname,
      path.extname(file.originalname)
    );

    const nomeLimpo = nomeOriginal
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^\w-]/g, "");

    const extensao = path.extname(file.originalname).toLowerCase() || ".pdf";

    cb(null, `${Date.now()}-${nomeLimpo}${extensao}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Somente arquivos PDF são permitidos."));
  }

  cb(null, true);
}

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});