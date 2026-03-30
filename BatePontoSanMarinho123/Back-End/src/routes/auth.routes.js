const express = require("express");
const router = express.Router();

const {
  login,
  register,
  listarAdmins,
  alterarSenhaAdmin,
} = require("../controllers/auth.controller");

// login e cadastro
router.post("/login", login);
router.post("/register", register);

// admins
router.get("/admins", listarAdmins);
router.put("/admins/:id/password", alterarSenhaAdmin);

module.exports = router;