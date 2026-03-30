const pool = require("../database/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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

async function login(req, res) {
  try {
    await garantirTabelaAdmins();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Usuário e senha são obrigatórios.",
      });
    }

    const result = await pool.query(
      `
      SELECT id, username, password_hash
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Credenciais inválidas.",
      });
    }

    const admin = result.rows[0];

    const senhaCorreta = await bcrypt.compare(password, admin.password_hash);

    if (!senhaCorreta) {
      return res.status(401).json({
        error: "Credenciais inválidas.",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "JWT_SECRET não configurado no .env.",
      });
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

    return res.json({
      token,
      username: admin.username,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({
      error: "Erro interno no login.",
    });
  }
}

async function register(req, res) {
  try {
    await garantirTabelaAdmins();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Usuário e senha são obrigatórios.",
      });
    }

    if (String(password).trim().length < 4) {
      return res.status(400).json({
        error: "A senha deve ter no mínimo 4 caracteres.",
      });
    }

    const existe = await pool.query(
      `
      SELECT id
      FROM admins
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );

    if (existe.rows.length > 0) {
      return res.status(409).json({
        error: "Este usuário já existe.",
      });
    }

    const hash = await bcrypt.hash(String(password), 10);

    const result = await pool.query(
      `
      INSERT INTO admins (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at
      `,
      [username, hash]
    );

    return res.status(201).json({
      message: "Administrador cadastrado com sucesso.",
      admin: result.rows[0],
    });
  } catch (err) {
    console.error("Erro no cadastro:", err);
    return res.status(500).json({
      error: "Erro interno no cadastro.",
    });
  }
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
    return res.status(500).json({
      error: "Erro ao listar administradores.",
    });
  }
}

async function alterarSenhaAdmin(req, res) {
  try {
    await garantirTabelaAdmins();

    const { id } = req.params;
    const { password } = req.body;

    if (!id) {
      return res.status(400).json({
        error: "ID do administrador é obrigatório.",
      });
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
      return res.status(404).json({
        error: "Administrador não encontrado.",
      });
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

    return res.json({
      message: "Senha alterada com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao alterar senha do admin:", err);
    return res.status(500).json({
      error: "Erro ao alterar senha.",
    });
  }
}

async function excluirAdmin(req, res) {
  try {
    await garantirTabelaAdmins();

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "ID do administrador é obrigatório.",
      });
    }

    const existe = await pool.query(
      `
      SELECT id
      FROM admins
      WHERE id = $1
      `,
      [id]
    );

    if (existe.rows.length === 0) {
      return res.status(404).json({
        error: "Administrador não encontrado.",
      });
    }

    await pool.query(
      `
      DELETE FROM admins
      WHERE id = $1
      `,
      [id]
    );

    return res.json({
      message: "Administrador excluído com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao excluir administrador:", err);
    return res.status(500).json({
      error: "Erro ao excluir administrador.",
    });
  }
}

module.exports = {
  login,
  register,
  listarAdmins,
  alterarSenhaAdmin,
  excluirAdmin,
};