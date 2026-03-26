const { Router } = require("express");
const ctrl = require("../controllers/bancoHoras.controller");

const router = Router();

router.get("/", ctrl.listarBancoHoras);
router.get("/pdf", ctrl.gerarPdfBancoHoras);
router.get("/excel", ctrl.gerarExcelBancoHoras);
router.post("/ajuste", ctrl.salvarAjusteBancoHoras);

module.exports = router;