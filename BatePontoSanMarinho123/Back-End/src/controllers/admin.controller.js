const bcrypt = require("bcrypt");
const pool = require("../database/pool");

async function garantirTabelaAdmins() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function listarAdmins(req, res) {
  try {
    await garantirTabelaAdmins();

    const result = await pool.query(`
      SELECT id, username, created_at
      FROM admins
      ORDER BY id ASC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar admins:", err);
    return res.status(500).json({ error: "Erro ao listar administradores." });
  }
}

async function alterarSenhaAdmin(req, res) {
  try {
    await garantirTabelaAdmins();

    const { id } = req.params;
    const { password } = req.body;

    if (!id) {
      return res.status(400).json({ error: "ID do administrador é obrigatório." });
    }

    if (!password || String(password).trim().length < 4) {
      return res.status(400).json({
        error: "A nova senha deve ter pelo menos 4 caracteres.",
      });
    }

    const existe = await pool.query(
      `
      SELECT id, username
      FROM admins
      WHERE id = $1
      `,
      [id]
    );

    if (existe.rows.length === 0) {
      return res.status(404).json({ error: "Administrador não encontrado." });
    }

    const hash = await bcrypt.hash(String(password), 10);

    await pool.query(
      `
      UPDATE admins
      SET password_hash = $1
      WHERE id = $2
      `,
      [hash, id]
    );

    return res.json({ message: "Senha alterada com sucesso." });
  } catch (err) {
    console.error("Erro ao alterar senha do admin:", err);
    return res.status(500).json({ error: "Erro ao alterar senha." });
  }
}

module.exports = {
  listarAdmins,
  alterarSenhaAdmin,
};