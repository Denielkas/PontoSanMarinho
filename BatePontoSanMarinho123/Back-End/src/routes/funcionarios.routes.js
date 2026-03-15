const { Router } = require("express");
const { auth } = require("../middlewares/auth");
const ctrl = require("../controllers/funcionario.controller");

const router = Router();

/* 🔓 ROTA PÚBLICA */
router.get("/public/:id", (req, res) => {
  console.log("🔥 [BACK] Rota PUBLIC chamada com ID:", req.params.id);
  ctrl.buscarPorId(req, res);
});

/* 🔐 ROTAS PROTEGIDAS */
router.get("/", auth, ctrl.listar);
router.post("/", auth, ctrl.criar);
router.put("/:id", auth, ctrl.atualizar);

module.exports = router;
