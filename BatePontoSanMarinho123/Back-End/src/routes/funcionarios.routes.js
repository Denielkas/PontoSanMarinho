const { Router } = require("express");
const { auth } = require("../middlewares/auth");
const ctrl = require("../controllers/funcionario.controller");

const router = Router();

/* ===============================
   PÚBLICO
=============================== */
router.get("/public/:id", (req, res) => {
  ctrl.buscarPorId(req, res);
});

/* ===============================
   PRIVADO
=============================== */
router.get("/", auth, ctrl.listar);

router.get("/:id/imagem", auth, ctrl.verImagemRosto);

router.delete("/:id/imagem", auth, ctrl.excluirImagemRosto);

router.get("/:id", auth, ctrl.buscarPorId);

router.post("/", auth, ctrl.criar);

router.put("/:id", auth, ctrl.atualizar);

module.exports = router;