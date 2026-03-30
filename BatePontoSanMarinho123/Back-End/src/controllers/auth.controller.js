const pool = require("../database/pool");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function garantirTabelaAdmins() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function listarAdmins(req, res) {
  try {
    await garantirTabelaAdmins();

    const { rows } = await pool.query(`
      SELECT id, username, created_at
      FROM admins
      ORDER BY id ASC
    `);

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar administradores:", err);
    return res.status(500).json({
      error: "Erro ao listar administradores",
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
        error: "ID do administrador é obrigatório",
      });
    }

    if (!password) {
      return res.status(400).json({
        error: "A nova senha é obrigatória",
      });
    }

    if (String(password).length < 4) {
      return res.status(400).json({
        error: "A senha deve ter no mínimo 4 caracteres",
      });
    }

    const adminExiste = await pool.query(
      "SELECT id, username FROM admins WHERE id = $1 LIMIT 1",
      [id]
    );

    if (adminExiste.rows.length === 0) {
      return res.status(404).json({
        error: "Administrador não encontrado",
      });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    await pool.query(
      `
      UPDATE admins
      SET password_hash = $1
      WHERE id = $2
      `,
      [password_hash, id]
    );

    return res.json({
      message: "Senha alterada com sucesso",
    });
  } catch (err) {
    console.error("Erro ao alterar senha do admin:", err);
    return res.status(500).json({
      error: "Erro ao alterar senha do administrador",
    });
  }
}

async function login(req, res) {
  try {
    await garantirTabelaAdmins();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Usuário e senha são obrigatórios",
      });
    }

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

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: "JWT_SECRET não configurado no .env",
      });
    }

    const token = jwt.sign(
      {
        sub: admin.id,
        username: admin.username,
        role: "admin",
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "5h",
      }
    );

    return res.json({
      token,
      username: admin.username,
    });
  } catch (err) {
    console.error("Erro no login:", err);
    return res.status(500).json({
      error: "Erro interno no login",
    });
  }
}

async function register(req, res) {
  try {
    await garantirTabelaAdmins();

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Usuário e senha são obrigatórios",
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        error: "A senha deve ter no mínimo 4 caracteres",
      });
    }

    const userExists = await pool.query(
      "SELECT id FROM admins WHERE username = $1 LIMIT 1",
      [username]
    );

    if (userExists.rows.length > 0) {
      return res.status(409).json({
        error: "Este usuário já existe",
      });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    const { rows } = await pool.query(
      `
      INSERT INTO admins (username, password_hash)
      VALUES ($1, $2)
      RETURNING id, username, created_at
      `,
      [username, password_hash]
    );

    return res.status(201).json({
      message: "Administrador cadastrado com sucesso",
      admin: rows[0],
    });
  } catch (err) {
    console.error("Erro no cadastro:", err);
    return res.status(500).json({
      error: "Erro interno no cadastro",
    });
  }
}

module.exports = {
  login,
  register,
  listarAdmins,
  alterarSenhaAdmin,
};