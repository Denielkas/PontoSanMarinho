const multer = require("multer");
const path = require("path");
const fs = require("fs");

const pastaUploads = "C:/sistema-arquivos/uploads";

if (!fs.existsSync(pastaUploads)) {
  fs.mkdirSync(pastaUploads, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, pastaUploads);
  },
  filename: (req, file, cb) => {
    const nome = `${Date.now()}${path.extname(file.originalname)}`;
    cb(null, nome);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== "application/pdf") {
    return cb(new Error("Somente arquivos PDF são permitidos."));
  }

  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
});