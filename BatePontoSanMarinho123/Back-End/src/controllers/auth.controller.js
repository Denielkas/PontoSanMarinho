const pool = require("../database/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const { rows } = await pool.query(
      "SELECT * FROM admins WHERE username = $1 LIMIT 1",
      [username]
    );

    const admin = rows[0];
    if (!admin) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const ok = bcrypt.compareSync(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const token = jwt.sign(
      {
        sub: admin.id,
        username: admin.username,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "5h" }
    );

    res.json({
      token,
      username: admin.username,
    });

  } catch (err) {
    res.status(500).json({ error: "Erro interno no login" });
  }
};
