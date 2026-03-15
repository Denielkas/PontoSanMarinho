const { Router } = require("express");
const authCtrl = require("../controllers/auth.controller");

const router = Router();

router.post("/login", authCtrl.login);

module.exports = router;
