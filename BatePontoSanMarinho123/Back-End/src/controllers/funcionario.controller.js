const pool = require("../database/pool");
const { onlyDigits } = require("../utils/cpf");

/* =========================================
   GARANTE TABELA FUNCOES
========================================= */
async function garantirTabelaFuncoes() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcoes (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(150) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

/* =========================================
   GARANTE TABELA FUNCIONARIOS
========================================= */
async function garantirTabelaFuncionarios() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS funcionarios (
      id BIGSERIAL PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      cpf VARCHAR(20) NOT NULL UNIQUE,
      chegada TIME,
      intervalo_inicio TIME,
      intervalo_fim TIME,
      saida TIME,
      funcao_id BIGINT REFERENCES funcoes(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  try {
    await pool.query(`
      ALTER TABLE funcionarios
      ADD COLUMN IF NOT EXISTS funcao_id BIGINT REFERENCES funcoes(id) ON DELETE SET NULL
    `);

    await pool.query(`
      ALTER TABLE funcionarios
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

    await pool.query(`
      ALTER TABLE funcionarios
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);
  } catch (err) {
    console.log("Colunas da tabela funcionarios já existem ou não foi necessário alterar.");
  }
}

/* =========================================
   GARANTE TABELA FACE_EMBEDDINGS
========================================= */
async function garantirTabelaFaceEmbeddings() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS face_embeddings (
      funcionario_id BIGINT PRIMARY KEY REFERENCES funcionarios(id) ON DELETE CASCADE,
      embedding FLOAT8[],
      foto_path TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  try {
    await pool.query(`
      ALTER TABLE face_embeddings
      ADD COLUMN IF NOT EXISTS foto_path TEXT
    `);

    await pool.query(`
      ALTER TABLE face_embeddings
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

    await pool.query(`
      ALTER TABLE face_embeddings
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);
  } catch (err) {
    console.log("Colunas da tabela face_embeddings já existem ou não foi necessário alterar.");
  }
}

/* =========================================
   GARANTE TUDO NECESSÁRIO
========================================= */
async function garantirTabelas() {
  await garantirTabelaFuncoes();
  await garantirTabelaFuncionarios();
  await garantirTabelaFaceEmbeddings();
}

/* =========================================
   BUSCAR OU CRIAR FUNÇÃO AUTOMATICAMENTE
========================================= */
async function findOrCreateFuncao(nomeFuncao) {
  if (!nomeFuncao) return null;

  await garantirTabelas();

  const nome = nomeFuncao.trim().toUpperCase();

  const existing = await pool.query(
    "SELECT id FROM funcoes WHERE nome = $1 LIMIT 1",
    [nome]
  );

  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const insert = await pool.query(
    "INSERT INTO funcoes (nome) VALUES ($1) RETURNING id",
    [nome]
  );

  return insert.rows[0].id;
}

/* =========================================
   LISTAR FUNCIONÁRIOS
========================================= */
exports.listar = async (_req, res) => {
  try {
    await garantirTabelas();

    const { rows } = await pool.query(`
      SELECT 
        f.*,
        fc.nome AS funcao_nome,
        CASE
          WHEN fe.funcionario_id IS NOT NULL THEN true
          ELSE false
        END AS rosto_cadastrado,
        fe.foto_path
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      LEFT JOIN face_embeddings fe ON fe.funcionario_id = f.id
      ORDER BY f.id DESC
    `);

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar funcionários:", err);
    return res.status(500).json({ error: "Erro ao listar funcionários" });
  }
};

/* =========================================
   BUSCAR FUNCIONÁRIO POR ID
========================================= */
exports.buscarPorId = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    const { rows } = await pool.query(
      `
      SELECT 
        f.id,
        f.nome,
        f.cpf,
        f.chegada,
        f.intervalo_inicio,
        f.intervalo_fim,
        f.saida,
        f.funcao_id,
        fc.nome AS funcao_nome,
        CASE
          WHEN fe.funcionario_id IS NOT NULL THEN true
          ELSE false
        END AS rosto_cadastrado,
        fe.foto_path
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      LEFT JOIN face_embeddings fe ON fe.funcionario_id = f.id
      WHERE f.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao buscar funcionário:", err);
    return res.status(500).json({ error: "Erro interno ao buscar funcionário" });
  }
};

/* =========================================
   VER IMAGEM DO ROSTO
========================================= */
exports.verImagemRosto = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    const { rows } = await pool.query(
      `
      SELECT fe.foto_path, f.nome
      FROM face_embeddings fe
      INNER JOIN funcionarios f ON f.id = fe.funcionario_id
      WHERE fe.funcionario_id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Imagem do rosto não encontrada." });
    }

    if (!rows[0].foto_path) {
      return res.status(404).json({ error: "Este funcionário não possui imagem salva." });
    }

    return res.json({
      ok: true,
      nome: rows[0].nome,
      imagem_url: rows[0].foto_path,
    });
  } catch (err) {
    console.error("Erro ao buscar imagem do rosto:", err);
    return res.status(500).json({ error: "Erro ao buscar imagem do rosto." });
  }
};

/* =========================================
   CRIAR FUNCIONÁRIO
========================================= */
exports.criar = async (req, res) => {
  try {
    await garantirTabelas();

    let {
      nome,
      cpf,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      funcao_id,
      funcao_nome,
    } = req.body;

    if (!nome || !cpf) {
      return res.status(400).json({
        error: "Nome e CPF são obrigatórios",
      });
    }

    cpf = onlyDigits(cpf);

    if (funcao_nome) {
      funcao_id = await findOrCreateFuncao(funcao_nome);
    }

    if (funcao_id) {
      funcao_id = Number(funcao_id);
    }

    const existeCpf = await pool.query(
      "SELECT id FROM funcionarios WHERE cpf = $1 LIMIT 1",
      [cpf]
    );

    if (existeCpf.rows.length > 0) {
      return res.status(409).json({ error: "Já existe funcionário com este CPF" });
    }

    const insert = await pool.query(
      `
      INSERT INTO funcionarios
      (nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
      `,
      [nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id]
    );

    const { rows } = await pool.query(
      `
      SELECT 
        f.*,
        fc.nome AS funcao_nome,
        false AS rosto_cadastrado,
        NULL::TEXT AS foto_path
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      WHERE f.id = $1
      `,
      [insert.rows[0].id]
    );

    return res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Erro ao criar funcionário:", err);
    return res.status(500).json({ error: "Erro ao criar funcionário" });
  }
};

/* =========================================
   ATUALIZAR FUNCIONÁRIO
========================================= */
exports.atualizar = async (req, res) => {
  try {
    await garantirTabelas();

    const id = Number(req.params.id);

    let {
      nome,
      cpf,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      funcao_id,
      funcao_nome,
    } = req.body;

    if (!nome || !cpf) {
      return res.status(400).json({
        error: "Nome e CPF são obrigatórios",
      });
    }

    cpf = onlyDigits(cpf);

    if (funcao_nome) {
      funcao_id = await findOrCreateFuncao(funcao_nome);
    }

    if (funcao_id) {
      funcao_id = Number(funcao_id);
    }

    const existeFuncionario = await pool.query(
      "SELECT id FROM funcionarios WHERE id = $1 LIMIT 1",
      [id]
    );

    if (existeFuncionario.rows.length === 0) {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }

    const cpfDuplicado = await pool.query(
      "SELECT id FROM funcionarios WHERE cpf = $1 AND id <> $2 LIMIT 1",
      [cpf, id]
    );

    if (cpfDuplicado.rows.length > 0) {
      return res.status(409).json({ error: "Já existe outro funcionário com este CPF" });
    }

    await pool.query(
      `
      UPDATE funcionarios
      SET nome = $1,
          cpf = $2,
          chegada = $3,
          intervalo_inicio = $4,
          intervalo_fim = $5,
          saida = $6,
          funcao_id = $7,
          updated_at = NOW()
      WHERE id = $8
      `,
      [nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id, id]
    );

    const { rows } = await pool.query(
      `
      SELECT 
        f.*,
        fc.nome AS funcao_nome,
        CASE
          WHEN fe.funcionario_id IS NOT NULL THEN true
          ELSE false
        END AS rosto_cadastrado,
        fe.foto_path
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      LEFT JOIN face_embeddings fe ON fe.funcionario_id = f.id
      WHERE f.id = $1
      `,
      [id]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao atualizar funcionário:", err);
    return res.status(500).json({ error: "Erro ao atualizar funcionário" });
  }
};