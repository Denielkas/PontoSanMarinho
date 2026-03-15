const pool = require("../database/pool");

exports.listar = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, nome FROM funcoes ORDER BY nome"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao listar funções" });
  }
};
