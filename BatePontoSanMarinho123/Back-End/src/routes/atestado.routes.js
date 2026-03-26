const express = require("express");
const router = express.Router();

const upload = require("../middlewares/uploadAtestado");
const {
  salvarAtestado,
  removerAtestado,
  visualizarAtestado,
} = require("../controllers/atestado.controller");

router.post("/", upload.single("arquivo"), salvarAtestado);
router.delete("/", removerAtestado);
router.get("/arquivo/:arquivo", visualizarAtestado);

module.exports = router;