const express = require("express");
const router = express.Router();

const upload = require("../middlewares/uploadAtestado");
const {
  salvarAtestado,
  removerAtestado,
} = require("../controllers/atestado.controller");

router.post("/", upload.single("arquivo"), salvarAtestado);
router.delete("/", removerAtestado);

module.exports = router;