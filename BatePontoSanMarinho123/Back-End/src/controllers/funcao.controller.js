const pool = require("../database/pool");

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
   LISTAR FUNÇÕES
========================================= */
exports.listar = async (_req, res) => {
  try {
    await garantirTabelaFuncoes();

    const { rows } = await pool.query(
      "SELECT id, nome FROM funcoes ORDER BY nome"
    );

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar funções:", err);
    return res.status(500).json({ error: "Erro ao listar funções" });
  }
};