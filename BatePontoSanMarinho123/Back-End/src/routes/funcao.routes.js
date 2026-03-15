const { Router } = require("express");
const { auth } = require("../middlewares/auth");
const ctrl = require("../controllers/funcao.controller");

const router = Router();
router.get("/", auth, ctrl.listar);
module.exports = router;
