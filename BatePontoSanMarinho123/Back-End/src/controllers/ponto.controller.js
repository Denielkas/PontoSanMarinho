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
   GARANTE TABELA PONTOS
========================================= */
async function garantirTabelaPontos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pontos (
      id BIGSERIAL PRIMARY KEY,
      funcionario_id BIGINT NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL,
      marcado_em TIMESTAMP DEFAULT NOW(),
      CHECK (tipo IN ('entrada','intervalo_inicio','intervalo_fim','saida','auto'))
    );
  `);
}

/* =========================================
   GARANTE TABELA FALTAS_AJUSTES
========================================= */
async function garantirTabelaFaltas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS faltas_ajustes (
      id BIGSERIAL PRIMARY KEY,
      funcionario_id BIGINT NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
      data DATE NOT NULL,
      falta BOOLEAN NOT NULL DEFAULT false,
      folga BOOLEAN NOT NULL DEFAULT false,
      ferias BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE (funcionario_id, data)
    );
  `);

  try {
    await pool.query(`
      ALTER TABLE faltas_ajustes
      ADD COLUMN IF NOT EXISTS folga BOOLEAN NOT NULL DEFAULT false
    `);

    await pool.query(`
      ALTER TABLE faltas_ajustes
      ADD COLUMN IF NOT EXISTS ferias BOOLEAN NOT NULL DEFAULT false
    `);

    await pool.query(`
      ALTER TABLE faltas_ajustes
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()
    `);

    await pool.query(`
      ALTER TABLE faltas_ajustes
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()
    `);
  } catch (err) {
    console.log("Colunas da tabela faltas_ajustes já existem ou não foi necessário alterar.");
  }
}

/* =========================================
   GARANTE TABELA ATESTADOS
========================================= */
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

async function garantirTabelas() {
  await garantirTabelaFuncoes();
  await garantirTabelaFuncionarios();
  await garantirTabelaPontos();
  await garantirTabelaFaltas();
  await garantirTabelaAtestados();
}

/* =========================================
   HELPERS TIMEZONE
========================================= */
function agoraSP() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
}

function dataHojeISO() {
  const agora = agoraSP();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function dataHoraAgoraSQL() {
  const agora = agoraSP();
  const data = dataHojeISO();
  const hora = String(agora.getHours()).padStart(2, "0");
  const minuto = String(agora.getMinutes()).padStart(2, "0");
  const segundo = String(agora.getSeconds()).padStart(2, "0");
  return `${data} ${hora}:${minuto}:${segundo}`;
}

function montarDataHora(dataBR, hora) {
  if (!dataBR || !hora) return null;

  const [d, m, a] = String(dataBR).split("/");
  if (!d || !m || !a) return null;

  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} ${hora}:00`;
}

function dataBRparaISO(dataBR) {
  if (!dataBR) return null;

  const [d, m, a] = String(dataBR).split("/");
  if (!d || !m || !a) return null;

  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizarHora(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (texto.length >= 5) return texto.slice(0, 5);
  return null;
}

/* =========================================
   BUSCAS DE PONTO
========================================= */
async function buscarPontosHoje(funcionario_id) {
  const hoje = dataHojeISO();

  const { rows } = await pool.query(
    `
    SELECT id, tipo, marcado_em
    FROM pontos
    WHERE funcionario_id = $1
      AND marcado_em::date = $2::date
    ORDER BY marcado_em ASC, id ASC
    `,
    [funcionario_id, hoje]
  );

  return rows;
}

/* 
   CORREÇÃO PRINCIPAL:
   Busca o turno aberto nas últimas 36 horas.
   Assim, se o funcionário entrou 17:30 e saiu 05:30 no outro dia,
   o sistema ainda entende que o turno está aberto.
*/
async function buscarBatidasTurnoAberto(funcionario_id) {
  const { rows } = await pool.query(
    `
    SELECT id, tipo, marcado_em
    FROM pontos
    WHERE funcionario_id = $1
      AND marcado_em >= (NOW() - INTERVAL '36 hours')
    ORDER BY marcado_em ASC, id ASC
    `,
    [funcionario_id]
  );

  if (!rows.length) return [];

  let indiceUltimaSaida = -1;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].tipo === "saida") {
      indiceUltimaSaida = i;
      break;
    }
  }

  const abertas = rows.slice(indiceUltimaSaida + 1);

  const temEntradaAberta = abertas.some((p) => p.tipo === "entrada");

  if (!temEntradaAberta) return [];

  return abertas;
}

async function buscarUltimaBatidaAberta(funcionario_id) {
  const abertas = await buscarBatidasTurnoAberto(funcionario_id);

  if (!abertas.length) return null;

  return abertas[abertas.length - 1];
}

/* =========================================
   PERMISSÕES DOS BOTÕES
========================================= */
function getPermissoesPorUltimaBatida(ultimaBatida) {
  const permissoes = {
    entrada: false,
    intervalo_inicio: false,
    intervalo_fim: false,
    saida: false,
  };

  if (!ultimaBatida) {
    permissoes.entrada = true;
    return permissoes;
  }

  if (ultimaBatida === "entrada") {
    permissoes.intervalo_inicio = true;
    permissoes.saida = true;
    return permissoes;
  }

  if (ultimaBatida === "intervalo_inicio") {
    permissoes.intervalo_fim = true;
    return permissoes;
  }

  if (ultimaBatida === "intervalo_fim") {
    permissoes.intervalo_inicio = true;
    permissoes.saida = true;
    return permissoes;
  }

  if (ultimaBatida === "saida") {
    permissoes.entrada = true;
    return permissoes;
  }

  permissoes.entrada = true;
  return permissoes;
}

/* =========================================
   STATUS DOS BOTÕES
========================================= */
exports.statusBatidas = async (req, res) => {
  try {
    await garantirTabelas();

    const { funcionario_id } = req.params;

    if (!funcionario_id) {
      return res.status(400).json({ error: "Funcionário inválido" });
    }

    const pontosHoje = await buscarPontosHoje(funcionario_id);
    const ultimaBatidaAberta = await buscarUltimaBatidaAberta(funcionario_id);

    const ultimaBatida = ultimaBatidaAberta ? ultimaBatidaAberta.tipo : null;
    const permissoes = getPermissoesPorUltimaBatida(ultimaBatida);

    return res.json({
      ok: true,
      ultima_batida: ultimaBatida,
      quantidade_hoje: pontosHoje.length,
      permissoes,
    });
  } catch (err) {
    console.error("Erro ao consultar status das batidas:", err);
    return res.status(500).json({ error: "Erro ao consultar status das batidas" });
  }
};

/* =========================================
   AUTO — RECONHECIMENTO FACIAL
========================================= */
exports.auto = async (req, res) => {
  try {
    await garantirTabelas();

    const { funcionario_id } = req.body;

    if (!funcionario_id) {
      return res.status(400).json({ error: "Funcionário inválido" });
    }

    const ultimaBatidaAberta = await buscarUltimaBatidaAberta(funcionario_id);
    const ultimaBatida = ultimaBatidaAberta ? ultimaBatidaAberta.tipo : null;

    const permissoes = getPermissoesPorUltimaBatida(ultimaBatida);

    let tipo = null;

    if (!ultimaBatidaAberta) {
      tipo = "entrada";
    } else if (ultimaBatida === "entrada") {
      tipo = "saida";
    } else if (ultimaBatida === "intervalo_inicio") {
      tipo = "intervalo_fim";
    } else if (ultimaBatida === "intervalo_fim") {
      tipo = "saida";
    } else if (ultimaBatida === "saida") {
      tipo = "entrada";
    }

    if (!tipo || !permissoes[tipo]) {
      return res.status(403).json({
        error: "Não foi possível determinar a próxima batida automaticamente.",
        ultima_batida: ultimaBatida,
        permissoes,
      });
    }

    const marcado_em = dataHoraAgoraSQL();

    const { rows } = await pool.query(
      `
      INSERT INTO pontos (funcionario_id, tipo, marcado_em)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [funcionario_id, tipo, marcado_em]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao registrar ponto automático:", err);
    return res.status(500).json({ error: "Erro ao registrar ponto" });
  }
};

/* =========================================
   BATER
========================================= */
exports.bater = async (req, res) => {
  try {
    await garantirTabelas();

    const { funcionario_id, tipo } = req.body;

    if (!funcionario_id || !tipo) {
      return res.status(400).json({ error: "Campos obrigatórios faltando" });
    }

    if (!["entrada", "intervalo_inicio", "intervalo_fim", "saida"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de ponto inválido!" });
    }

    const ultimaBatidaAberta = await buscarUltimaBatidaAberta(funcionario_id);
    const ultimaBatida = ultimaBatidaAberta ? ultimaBatidaAberta.tipo : null;

    const permissoes = getPermissoesPorUltimaBatida(ultimaBatida);

    if (!permissoes[tipo]) {
      return res.status(403).json({
        error: "Esta batida não está liberada agora.",
        ultima_batida: ultimaBatida,
        permissoes,
      });
    }

    const marcado_em = dataHoraAgoraSQL();

    const { rows } = await pool.query(
      `
      INSERT INTO pontos (funcionario_id, tipo, marcado_em)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [funcionario_id, tipo, marcado_em]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao lançar ponto:", err);
    return res.status(500).json({ error: "Erro ao lançar ponto" });
  }
};

/* =========================================
   INSERIR MANUAL
========================================= */
exports.inserirManual = async (req, res) => {
  try {
    await garantirTabelas();

    const { funcionario_id, tipo, data, hora } = req.body;

    if (!funcionario_id || !tipo || !data || !hora) {
      return res.status(400).json({ error: "Preencha todos os campos!" });
    }

    if (!["entrada", "intervalo_inicio", "intervalo_fim", "saida"].includes(tipo)) {
      return res.status(400).json({ error: "Tipo de ponto inválido!" });
    }

    const dataISO = montarDataHora(data, hora);

    if (!dataISO) {
      return res.status(400).json({ error: "Data ou hora inválida!" });
    }

    const { rows } = await pool.query(
      `
      INSERT INTO pontos (funcionario_id, tipo, marcado_em)
      VALUES ($1, $2, $3)
      RETURNING *
      `,
      [funcionario_id, tipo, dataISO]
    );

    return res.json(rows[0]);
  } catch (err) {
    console.error("Erro ao inserir ponto manual:", err);
    return res.status(500).json({ error: "Erro ao inserir ponto manual" });
  }
};

/* =========================================
   AJUSTAR
========================================= */
exports.ajustar = async (req, res) => {
  const client = await pool.connect();

  try {
    await garantirTabelas();
    await client.query("BEGIN");

    const {
      funcionario_id,
      data,
      ids_originais = {},
      entrada,
      intervalo,
      retorno,
      saida,
      falta = false,
      folga = false,
      ferias = false,
    } = req.body;

    if (!funcionario_id || !data) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Dados incompletos" });
    }

    const dataISO = dataBRparaISO(data);

    if (!dataISO) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Data inválida" });
    }

    const {
      entrada_id,
      intervalo_inicio_id,
      intervalo_fim_id,
      saida_id,
    } = ids_originais;

    await client.query(
      `
      INSERT INTO faltas_ajustes (funcionario_id, data, falta, folga, ferias, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (funcionario_id, data)
      DO UPDATE SET
        falta = EXCLUDED.falta,
        folga = EXCLUDED.folga,
        ferias = EXCLUDED.ferias,
        updated_at = NOW()
      `,
      [funcionario_id, dataISO, !!falta, !!folga, !!ferias]
    );

    if (falta === true || folga === true || ferias === true) {
      await client.query(
        `
        DELETE FROM pontos
        WHERE funcionario_id = $1
          AND marcado_em::date = $2::date
        `,
        [funcionario_id, dataISO]
      );

      await client.query("COMMIT");

      return res.json({
        ok: true,
        falta: !!falta,
        folga: !!folga,
        ferias: !!ferias,
        ids_originais: {},
        message: falta
          ? "Falta registrada com sucesso."
          : folga
          ? "Folga registrada com sucesso."
          : "Férias registrada com sucesso.",
      });
    }

    async function atualizarOuCriar(idExistente, tipoPonto, horaPonto) {
      if (!horaPonto) {
        if (idExistente) {
          await client.query(
            `
            DELETE FROM pontos
            WHERE id = $1 AND funcionario_id = $2
            `,
            [idExistente, funcionario_id]
          );
        }
        return null;
      }

      const dataHora = montarDataHora(data, horaPonto);

      if (!dataHora) {
        throw new Error("Data/hora inválida para ajuste");
      }

      if (idExistente) {
        await client.query(
          `
          UPDATE pontos
          SET marcado_em = $1, tipo = $2
          WHERE id = $3 AND funcionario_id = $4
          `,
          [dataHora, tipoPonto, idExistente, funcionario_id]
        );
        return idExistente;
      }

      const { rows } = await client.query(
        `
        INSERT INTO pontos (funcionario_id, tipo, marcado_em)
        VALUES ($1, $2, $3)
        RETURNING id
        `,
        [funcionario_id, tipoPonto, dataHora]
      );

      return rows[0].id;
    }

    const novosIds = {
      entrada_id: await atualizarOuCriar(entrada_id, "entrada", entrada),
      intervalo_inicio_id: await atualizarOuCriar(
        intervalo_inicio_id,
        "intervalo_inicio",
        intervalo
      ),
      intervalo_fim_id: await atualizarOuCriar(
        intervalo_fim_id,
        "intervalo_fim",
        retorno
      ),
      saida_id: await atualizarOuCriar(saida_id, "saida", saida),
    };

    await client.query(
      `
      UPDATE faltas_ajustes
      SET falta = false,
          folga = false,
          ferias = false,
          updated_at = NOW()
      WHERE funcionario_id = $1
        AND data = $2
      `,
      [funcionario_id, dataISO]
    );

    await client.query("COMMIT");

    return res.json({
      ok: true,
      falta: false,
      folga: false,
      ferias: false,
      ids_originais: novosIds,
      message: "Horários ajustados com sucesso.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao ajustar horários:", err);
    return res.status(500).json({ error: "Erro ao ajustar horários" });
  } finally {
    client.release();
  }
};

/* =========================================
   LIMPAR BATIDAS DO DIA
========================================= */
exports.limparBatidasDoDia = async (req, res) => {
  try {
    await garantirTabelas();

    const { funcionario_id, data } = req.body;

    if (!funcionario_id || !data) {
      return res.status(400).json({
        error: "Funcionário e data são obrigatórios.",
      });
    }

    const dataISO = dataBRparaISO(data);

    if (!dataISO) {
      return res.status(400).json({
        error: "Data inválida.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM pontos
      WHERE funcionario_id = $1
        AND marcado_em::date = $2::date
      `,
      [funcionario_id, dataISO]
    );

    return res.json({
      ok: true,
      removidas: result.rowCount || 0,
      message: "Batidas do dia removidas com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao limpar batidas do dia:", err);
    return res.status(500).json({
      error: "Erro ao limpar batidas do dia.",
    });
  }
};

/* =========================================
   LANÇAR HORÁRIO PADRÃO NO MÊS
========================================= */
exports.lancarHorarioPadraoMes = async (req, res) => {
  const client = await pool.connect();

  try {
    await garantirTabelas();
    await client.query("BEGIN");

    const { funcionario_id, mes, ano } = req.body;

    const mesNum = Number(mes);
    const anoNum = Number(ano);

    if (!funcionario_id || !mesNum || !anoNum) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Funcionário, mês e ano são obrigatórios.",
      });
    }

    if (mesNum < 1 || mesNum > 12) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Mês inválido." });
    }

    const { rows: funcionarios } = await client.query(
      `
      SELECT id, nome, chegada, intervalo_inicio, intervalo_fim, saida
      FROM funcionarios
      WHERE id = $1
      `,
      [funcionario_id]
    );

    if (funcionarios.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const funcionario = funcionarios[0];

    const horaEntrada = normalizarHora(funcionario.chegada);
    const horaIntervaloInicio = normalizarHora(funcionario.intervalo_inicio);
    const horaIntervaloFim = normalizarHora(funcionario.intervalo_fim);
    const horaSaida = normalizarHora(funcionario.saida);

    if (!horaEntrada || !horaIntervaloInicio || !horaIntervaloFim || !horaSaida) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "O funcionário não possui horário padrão completo cadastrado.",
      });
    }

    const diasNoMes = new Date(anoNum, mesNum, 0).getDate();

    let diasInseridos = 0;
    let diasIgnorados = 0;
    const detalhes = [];

    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataISO = `${anoNum}-${String(mesNum).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

      const { rows: pontosExistentes } = await client.query(
        `
        SELECT id
        FROM pontos
        WHERE funcionario_id = $1
          AND marcado_em::date = $2::date
        LIMIT 1
        `,
        [funcionario_id, dataISO]
      );

      if (pontosExistentes.length > 0) {
        diasIgnorados++;
        detalhes.push({
          data: dataISO,
          status: "ignorado",
          motivo: "Já possui ponto lançado",
        });
        continue;
      }

      const { rows: ajusteExistente } = await client.query(
        `
        SELECT id, falta, folga, ferias
        FROM faltas_ajustes
        WHERE funcionario_id = $1
          AND data = $2::date
        LIMIT 1
        `,
        [funcionario_id, dataISO]
      );

      if (
        ajusteExistente.length > 0 &&
        (ajusteExistente[0].falta ||
          ajusteExistente[0].folga ||
          ajusteExistente[0].ferias)
      ) {
        diasIgnorados++;
        detalhes.push({
          data: dataISO,
          status: "ignorado",
          motivo: ajusteExistente[0].falta
            ? "Dia marcado como falta"
            : ajusteExistente[0].folga
            ? "Dia marcado como folga"
            : "Dia marcado como férias",
        });
        continue;
      }

      const { rows: atestadoExistente } = await client.query(
        `
        SELECT id
        FROM atestados
        WHERE funcionario_id = $1
          AND $2::date BETWEEN data_inicio::date AND data_fim::date
        LIMIT 1
        `,
        [funcionario_id, dataISO]
      );

      if (atestadoExistente.length > 0) {
        diasIgnorados++;
        detalhes.push({
          data: dataISO,
          status: "ignorado",
          motivo: "Dia com atestado",
        });
        continue;
      }

      await client.query(
        `
        INSERT INTO pontos (funcionario_id, tipo, marcado_em)
        VALUES
          ($1, 'entrada', $2),
          ($1, 'intervalo_inicio', $3),
          ($1, 'intervalo_fim', $4),
          ($1, 'saida', $5)
        `,
        [
          funcionario_id,
          `${dataISO} ${horaEntrada}:00`,
          `${dataISO} ${horaIntervaloInicio}:00`,
          `${dataISO} ${horaIntervaloFim}:00`,
          `${dataISO} ${horaSaida}:00`,
        ]
      );

      await client.query(
        `
        INSERT INTO faltas_ajustes (funcionario_id, data, falta, folga, ferias, updated_at)
        VALUES ($1, $2::date, false, false, false, NOW())
        ON CONFLICT (funcionario_id, data)
        DO UPDATE SET
          falta = false,
          folga = false,
          ferias = false,
          updated_at = NOW()
        `,
        [funcionario_id, dataISO]
      );

      diasInseridos++;
      detalhes.push({
        data: dataISO,
        status: "inserido",
      });
    }

    await client.query("COMMIT");

    return res.json({
      ok: true,
      message: "Horário padrão lançado com sucesso.",
      funcionario: funcionario.nome,
      dias_inseridos: diasInseridos,
      dias_ignorados: diasIgnorados,
      detalhes,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro ao lançar horário padrão do mês:", err);
    return res.status(500).json({
      error: "Erro ao lançar horário padrão do mês.",
    });
  } finally {
    client.release();
  }
};

/* =========================================
   BUSCAR PONTOS POR CPF
========================================= */
exports.buscarPorCPF = async (req, res) => {
  try {
    await garantirTabelas();

    const { cpf } = req.params;

    const { rows: funcs } = await pool.query(
      `
      SELECT 
        id,
        nome,
        cpf,
        chegada,
        intervalo_inicio,
        intervalo_fim,
        saida
      FROM funcionarios
      WHERE cpf = $1
      `,
      [cpf]
    );

    if (funcs.length === 0) {
      return res.status(404).json({ error: "CPF não encontrado" });
    }

    const funcionario = funcs[0];

    const { rows: pontos } = await pool.query(
      `
      SELECT 
        id,
        marcado_em::date AS dia,
        tipo,
        to_char(marcado_em, 'HH24:MI') AS hora,
        marcado_em
      FROM pontos
      WHERE funcionario_id = $1
        AND marcado_em >= (NOW() - INTERVAL '36 hours')
      ORDER BY marcado_em ASC, id ASC
      `,
      [funcionario.id]
    );

    return res.json({ funcionario, pontos });
  } catch (err) {
    console.error("Erro ao buscar pontos:", err);
    return res.status(500).json({ error: "Erro ao buscar pontos" });
  }
};