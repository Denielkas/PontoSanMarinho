const pool = require("../database/pool");
const fs = require("fs");
const path = require("path");

const PASTA_UPLOADS =
  process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads");

async function garantirTabelaAtestados() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS atestados (
      id BIGSERIAL PRIMARY KEY,
      funcionario_id BIGINT NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
      data_inicio DATE NOT NULL,
      data_fim DATE NOT NULL,
      arquivo TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
}

async function salvarAtestado(req, res) {
  try {
    await garantirTabelaAtestados();

    const { funcionario_id, data_inicio, data_fim } = req.body;

    if (!funcionario_id || !data_inicio || !data_fim) {
      return res.status(400).json({
        error: "Preencha funcionário, data de início e data de fim.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Arquivo PDF é obrigatório.",
      });
    }

    const arquivo = req.file.filename;

    await pool.query(
      `
      INSERT INTO atestados (
        funcionario_id,
        data_inicio,
        data_fim,
        arquivo
      )
      VALUES ($1, $2, $3, $4)
      `,
      [funcionario_id, data_inicio, data_fim, arquivo]
    );

    return res.json({
      ok: true,
      message: "Atestado salvo com sucesso.",
      arquivo,
    });
  } catch (error) {
    console.error("🔥 ERRO AO SALVAR ATESTADO:", error);
    return res.status(500).json({
      error: "Erro ao salvar atestado.",
    });
  }
}

function converterDataBRparaISO(dataBR) {
  if (!dataBR) return null;
  const [dia, mes, ano] = String(dataBR).split("/");
  if (!dia || !mes || !ano) return null;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

async function removerAtestado(req, res) {
  try {
    await garantirTabelaAtestados();

    const { funcionario_id, data } = req.body;

    if (!funcionario_id || !data) {
      return res.status(400).json({
        error: "Funcionário e data são obrigatórios.",
      });
    }

    const dataISO = converterDataBRparaISO(data);

    if (!dataISO) {
      return res.status(400).json({
        error: "Data inválida.",
      });
    }

    const { rows } = await pool.query(
      `
      SELECT id, arquivo
      FROM atestados
      WHERE funcionario_id = $1
        AND $2::date BETWEEN data_inicio AND data_fim
      ORDER BY id DESC
      LIMIT 1
      `,
      [funcionario_id, dataISO]
    );

    if (!rows.length) {
      return res.status(404).json({
        error: "Atestado não encontrado para esta data.",
      });
    }

    const atestado = rows[0];

    await pool.query(
      `
      DELETE FROM atestados
      WHERE id = $1
      `,
      [atestado.id]
    );

    if (atestado.arquivo) {
      const caminhoArquivo = path.join(PASTA_UPLOADS, atestado.arquivo);

      if (fs.existsSync(caminhoArquivo)) {
        try {
          fs.unlinkSync(caminhoArquivo);
        } catch (erroArquivo) {
          console.error("Erro ao remover arquivo físico do atestado:", erroArquivo);
        }
      }
    }

    return res.json({
      ok: true,
      message: "Atestado removido com sucesso.",
    });
  } catch (error) {
    console.error("🔥 ERRO AO REMOVER ATESTADO:", error);
    return res.status(500).json({
      error: "Erro ao remover atestado.",
    });
  }
}

module.exports = {
  salvarAtestado,
  removerAtestado,
};