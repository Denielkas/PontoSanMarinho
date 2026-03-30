const express = require("express");
const router = express.Router();
const pontoController = require("../controllers/ponto.controller");

router.get("/status-batidas/:funcionario_id", pontoController.statusBatidas);
router.post("/auto", pontoController.auto);
router.post("/bater", pontoController.bater);
router.post("/manual", pontoController.inserirManual);
router.put("/ajustar", pontoController.ajustar);
router.delete("/limpar-dia", pontoController.limparBatidasDoDia);
router.get("/cpf/:cpf", pontoController.buscarPorCPF);
router.post("/lancar-padrao-mes", pontoController.lancarHorarioPadraoMes);

module.exports = router;