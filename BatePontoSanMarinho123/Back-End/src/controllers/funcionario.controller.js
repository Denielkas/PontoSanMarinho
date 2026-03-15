const pool = require("../database/pool");
const { onlyDigits } = require("../utils/cpf");

/* ---------------------------------------
   🔵 BUSCAR OU CRIAR FUNÇÃO AUTOMATICAMENTE
------------------------------------------ */
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

/* ---------------------------------------
   🔵 LISTAR FUNCIONÁRIOS
------------------------------------------ */
exports.listar = async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        f.*, 
        fc.nome AS funcao_nome
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      ORDER BY f.id DESC
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar funcionários" });
  }
};

/* ---------------------------------------
   🔵 BUSCAR POR ID
------------------------------------------ */
exports.buscarPorId = async (req, res) => {
  try {
    const id = Number(req.params.id);

    const { rows } = await pool.query(
      "SELECT id, nome, cpf, funcao_id FROM funcionarios WHERE id = $1 LIMIT 1",
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: "Funcionário não encontrado" });
    }

    return res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao buscar funcionário" });
  }
};

/* ---------------------------------------
   🔵 CRIAR FUNCIONÁRIO
------------------------------------------ */
exports.criar = async (req, res) => {
  try {
    let {
      nome,
      cpf,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      funcao_id,
      funcao_nome
    } = req.body;

    cpf = onlyDigits(cpf);

    if (funcao_nome) {
      funcao_id = await findOrCreateFuncao(funcao_nome);
    }

    if (funcao_id) funcao_id = Number(funcao_id);

    const insert = await pool.query(
      `
      INSERT INTO funcionarios
      (nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
      `,
      [nome, cpf, chegada, intervalo_inicio, intervalo_fim, saida, funcao_id]
    );

    const { rows } = await pool.query(
      `
      SELECT f.*, fc.nome AS funcao_nome
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      WHERE f.id = $1
      `,
      [insert.rows[0].id]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao criar funcionário" });
  }
};

/* ---------------------------------------
   🔵 ATUALIZAR FUNCIONÁRIO
------------------------------------------ */
exports.atualizar = async (req, res) => {
  try {
    const id = Number(req.params.id);

    let {
      nome,
      cpf,
      chegada,
      intervalo_inicio,
      intervalo_fim,
      saida,
      funcao_id,
      funcao_nome
    } = req.body;

    cpf = onlyDigits(cpf);

    if (funcao_nome) {
      funcao_id = await findOrCreateFuncao(funcao_nome);
    }

    if (funcao_id) funcao_id = Number(funcao_id);

    await pool.query(
      `
      UPDATE funcionarios 
      SET nome=$1, cpf=$2, chegada=$3, intervalo_inicio=$4,
          intervalo_fim=$5, saida=$6, funcao_id=$7
      WHERE id=$8
      `,
      [
        nome,
        cpf,
        chegada,
        intervalo_inicio,
        intervalo_fim,
        saida,
        funcao_id,
        id
      ]
    );

    const { rows } = await pool.query(
      `
      SELECT f.*, fc.nome AS funcao_nome
      FROM funcionarios f
      LEFT JOIN funcoes fc ON fc.id = f.funcao_id
      WHERE f.id = $1
      `,
      [id]
    );

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Erro ao atualizar funcionário" });
  }
};
