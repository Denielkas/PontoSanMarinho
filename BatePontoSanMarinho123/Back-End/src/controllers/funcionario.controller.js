const pool = require("../database/pool");
const { onlyDigits } = require("../utils/cpf");

/* =========================================
   GARANTIR TABELA FUNÇÕES
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
   GARANTIR TABELA FUNCIONÁRIOS
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
}

/* =========================================
   GARANTIR FACE EMBEDDINGS
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
}

/* =========================================
   GARANTIR TUDO
========================================= */
async function garantirTabelas() {
  await garantirTabelaFuncoes();
  await garantirTabelaFuncionarios();
  await garantirTabelaFaceEmbeddings();
}

/* =========================================
   BUSCAR OU CRIAR FUNÇÃO
========================================= */
async function findOrCreateFuncao(nomeFuncao) {
  if (!nomeFuncao) return null;

  const nome = nomeFuncao.trim().toUpperCase();

  const existing = await pool.query(
    "SELECT id FROM funcoes WHERE nome = $1 LIMIT 1",
    [nome]
  );

  if (existing.rows[0]) return existing.rows[0].id;

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
          WHEN fe.embedding IS NOT NULL THEN true
          ELSE false
        END AS rosto_cadastrado,
        CASE
          WHEN fe.foto_path IS NOT NULL AND fe.foto_path <> ''
          THEN true
          ELSE false
        END AS possui_imagem_rosto,
        fe.foto_path
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      LEFT JOIN face_embeddings fe ON fe.funcionario_id = f.id
      ORDER BY f.id ASC
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

    if (!id) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const { rows } = await pool.query(
      `
      SELECT 
        f.*,
        fc.nome AS funcao_nome,
        CASE
          WHEN fe.embedding IS NOT NULL THEN true
          ELSE false
        END AS rosto_cadastrado,
        CASE
          WHEN fe.foto_path IS NOT NULL AND fe.foto_path <> ''
          THEN true
          ELSE false
        END AS possui_imagem_rosto,
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
    return res.status(500).json({ error: "Erro interno" });
  }
};

/* =========================================
   VER IMAGEM ROSTO
========================================= */
exports.verImagemRosto = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const { rows } = await pool.query(
      `
      SELECT foto_path
      FROM face_embeddings
      WHERE funcionario_id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Rosto não encontrado." });
    }

    if (!rows[0].foto_path) {
      return res.status(404).json({ error: "Sem imagem salva." });
    }

    let imagemUrl = rows[0].foto_path;

    if (
      !imagemUrl.startsWith("http://") &&
      !imagemUrl.startsWith("https://") &&
      !imagemUrl.startsWith("/")
    ) {
      imagemUrl = `/${imagemUrl}`;
    }

    return res.json({
      ok: true,
      imagem_url: imagemUrl,
    });
  } catch (err) {
    console.error("Erro ao buscar imagem:", err);
    return res.status(500).json({ error: "Erro ao buscar imagem." });
  }
};

/* =========================================
   EXCLUIR ROSTO
========================================= */
exports.excluirImagemRosto = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido." });
    }

    const existe = await pool.query(
      `
      SELECT funcionario_id, foto_path, embedding
      FROM face_embeddings
      WHERE funcionario_id = $1
      LIMIT 1
      `,
      [id]
    );

    if (existe.rowCount === 0) {
      return res.status(404).json({
        error: "Nenhum cadastro facial encontrado para este funcionário.",
      });
    }

    const result = await pool.query(
      `
      UPDATE face_embeddings
      SET foto_path = NULL,
          embedding = NULL,
          updated_at = NOW()
      WHERE funcionario_id = $1
      RETURNING funcionario_id
      `,
      [id]
    );

    return res.json({
      ok: true,
      message: "Cadastro facial excluído com sucesso.",
      funcionario_id: result.rows[0].funcionario_id,
    });
  } catch (err) {
    console.error("Erro ao excluir cadastro facial:", err);
    return res.status(500).json({ error: "Erro ao excluir cadastro facial." });
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

    cpf = onlyDigits(cpf);

    if (funcao_nome) {
      funcao_id = await findOrCreateFuncao(funcao_nome);
    }

    const insert = await pool.query(
      `
      INSERT INTO funcionarios
      (nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id]
    );

    return res.status(201).json(insert.rows[0]);
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
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({ error: "ID inválido." });
    }

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

    cpf = onlyDigits(cpf);

    if (funcao_nome) {
      funcao_id = await findOrCreateFuncao(funcao_nome);
    }

    await pool.query(
      `
      UPDATE funcionarios
      SET nome=$1,
          cpf=$2,
          chegada=$3,
          intervalo_inicio=$4,
          intervalo_fim=$5,
          saida=$6,
          funcao_id=$7,
          updated_at=NOW()
      WHERE id=$8
      `,
      [nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id, id]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao atualizar:", err);
    return res.status(500).json({ error: "Erro ao atualizar" });
  }
};