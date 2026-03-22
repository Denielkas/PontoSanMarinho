const pool = require("../database/pool");
const { calcularDia, formatarSaldo } = require("../utils/calculos");

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
  } catch (err) {
    console.log("Colunas já existem ou não foi necessário alterar.");
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

/* =========================================
   GARANTE TUDO NECESSÁRIO
========================================= */
async function garantirTabelas() {
  await garantirTabelaFuncoes();
  await garantirTabelaFuncionarios();
  await garantirTabelaPontos();
  await garantirTabelaFaltas();
  await garantirTabelaAtestados();
}

async function gerarRelatorioFuncionario(id, mes, ano) {
  await garantirTabelas();

  const mesNum = Number(mes);
  const anoNum = Number(ano);

  if (!id || !mesNum || !anoNum) {
    throw new Error("Parâmetros inválidos.");
  }

  const funcionarioQuery = await pool.query(
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
    WHERE id = $1
    `,
    [id]
  );

  if (funcionarioQuery.rows.length === 0) {
    throw new Error("Funcionário não encontrado.");
  }

  const funcionario = funcionarioQuery.rows[0];

  const pontosQuery = `
    SELECT 
      p.id,
      p.tipo,
      p.marcado_em,
      f.nome,
      f.cpf,
      f.chegada,
      f.intervalo_inicio AS regra_int_in,
      f.intervalo_fim AS regra_int_fi,
      f.saida AS regra_saida
    FROM pontos p
    JOIN funcionarios f ON f.id = p.funcionario_id
    WHERE p.funcionario_id = $1
      AND EXTRACT(MONTH FROM p.marcado_em) = $2
      AND EXTRACT(YEAR FROM p.marcado_em) = $3
    ORDER BY p.marcado_em ASC, p.id ASC
  `;

  const { rows } = await pool.query(pontosQuery, [id, mesNum, anoNum]);

  const atestadosQuery = await pool.query(
    `
    SELECT data_inicio, data_fim, arquivo
    FROM atestados
    WHERE funcionario_id = $1
    `,
    [id]
  );

  const faltasQuery = await pool.query(
    `
    SELECT data, falta, folga, ferias
    FROM faltas_ajustes
    WHERE funcionario_id = $1
      AND EXTRACT(MONTH FROM data) = $2
      AND EXTRACT(YEAR FROM data) = $3
    `,
    [id, mesNum, anoNum]
  );

  const mapaAjustes = {};
  for (const item of faltasQuery.rows) {
    const d = new Date(item.data);
    d.setHours(0, 0, 0, 0);

    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    mapaAjustes[chave] = {
      falta: !!item.falta,
      folga: !!item.folga,
      ferias: !!item.ferias,
    };
  }

  const listaAtestados = atestadosQuery.rows;

  function diaTemAtestado(data) {
    if (!data) return null;

    const diaRef = new Date(data);
    diaRef.setHours(0, 0, 0, 0);

    for (const a of listaAtestados) {
      const inicio = new Date(a.data_inicio);
      const fim = new Date(a.data_fim);

      inicio.setHours(0, 0, 0, 0);
      fim.setHours(23, 59, 59, 999);

      if (diaRef >= inicio && diaRef <= fim) {
        return a.arquivo;
      }
    }

    return null;
  }

  function zerarHora(data) {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatarChaveDia(data) {
    const d = zerarHora(data);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatarHora(data) {
    if (!data) return "--:--";
    return new Date(data).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function criarLinhaBase(row) {
    return {
      ids_originais: {
        entrada_id: null,
        intervalo_inicio_id: null,
        intervalo_fim_id: null,
        saida_id: null,
      },
      entrada: null,
      intervalo_inicio: null,
      intervalo_fim: null,
      saida: null,
      nome: row?.nome || funcionario.nome,
      cpf: row?.cpf || funcionario.cpf,
      regras: {
        entrada: row?.chegada || funcionario.chegada,
        intervalo_in: row?.regra_int_in || funcionario.intervalo_inicio,
        intervalo_fi: row?.regra_int_fi || funcionario.intervalo_fim,
        saida: row?.regra_saida || funcionario.saida,
      },
    };
  }

  function linhaTemAlgumaBatida(linha) {
    return !!(
      linha.entrada ||
      linha.intervalo_inicio ||
      linha.intervalo_fim ||
      linha.saida
    );
  }

  function adicionarCampo(linha, tipo, row) {
    const dataHora = new Date(row.marcado_em);

    if (tipo === "entrada") {
      linha.entrada = dataHora;
      linha.ids_originais.entrada_id = row.id;
      return;
    }

    if (tipo === "intervalo_inicio") {
      linha.intervalo_inicio = dataHora;
      linha.ids_originais.intervalo_inicio_id = row.id;
      return;
    }

    if (tipo === "intervalo_fim") {
      linha.intervalo_fim = dataHora;
      linha.ids_originais.intervalo_fim_id = row.id;
      return;
    }

    if (tipo === "saida") {
      linha.saida = dataHora;
      linha.ids_originais.saida_id = row.id;
    }
  }

  function toMinutos(valor) {
    if (!valor) return null;

    if (valor instanceof Date) {
      return valor.getHours() * 60 + valor.getMinutes();
    }

    const texto = String(valor).slice(0, 5);
    const [h, m] = texto.split(":").map(Number);

    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function escolherMaisProximo(lista, regraHora) {
    if (!lista.length || !regraHora) return null;

    const regraMin = toMinutos(regraHora);
    if (regraMin == null) return null;

    let melhor = null;
    let menorDiff = Infinity;

    for (const item of lista) {
      const minutos = toMinutos(new Date(item.marcado_em));
      const diff = Math.abs(minutos - regraMin);

      if (diff < menorDiff) {
        menorDiff = diff;
        melhor = item;
      }
    }

    return melhor;
  }

  function removerItemPorId(lista, idRemover) {
    const idx = lista.findIndex((item) => item.id === idRemover);
    if (idx >= 0) {
      lista.splice(idx, 1);
    }
  }

  function montarLinhasDoDia(lista) {
    if (!lista || lista.length === 0) return [];

    const linhas = [];
    const primeiraLinha = criarLinhaBase(lista[0]);
    linhas.push(primeiraLinha);

    const entradas = [];
    const intervalosInicio = [];
    const intervalosFim = [];
    const saidas = [];
    const autos = [];

    for (const row of lista) {
      const tipo = String(row.tipo || "").trim().toLowerCase();

      if (tipo === "entrada") entradas.push(row);
      else if (tipo === "intervalo_inicio") intervalosInicio.push(row);
      else if (tipo === "intervalo_fim") intervalosFim.push(row);
      else if (tipo === "saida") saidas.push(row);
      else if (tipo === "auto") autos.push(row);
    }

    if (entradas.length > 0) {
      adicionarCampo(primeiraLinha, "entrada", entradas.shift());
    } else if (autos.length > 0) {
      adicionarCampo(primeiraLinha, "entrada", autos.shift());
    }

    let principalIntervaloInicio = escolherMaisProximo(
      intervalosInicio,
      primeiraLinha.regras.intervalo_in
    );

    if (!principalIntervaloInicio && autos.length > 0) {
      principalIntervaloInicio = autos.shift();
    }

    if (principalIntervaloInicio) {
      adicionarCampo(primeiraLinha, "intervalo_inicio", principalIntervaloInicio);
      removerItemPorId(intervalosInicio, principalIntervaloInicio.id);
    }

    let principalIntervaloFim = escolherMaisProximo(
      intervalosFim,
      primeiraLinha.regras.intervalo_fi
    );

    if (!principalIntervaloFim && autos.length > 0) {
      principalIntervaloFim = autos.shift();
    }

    if (principalIntervaloFim) {
      adicionarCampo(primeiraLinha, "intervalo_fim", principalIntervaloFim);
      removerItemPorId(intervalosFim, principalIntervaloFim.id);
    }

    if (saidas.length > 0) {
      adicionarCampo(primeiraLinha, "saida", saidas.shift());
    } else if (autos.length > 0) {
      adicionarCampo(primeiraLinha, "saida", autos.shift());
    }

    while (intervalosInicio.length > 0 || intervalosFim.length > 0) {
      const linha = criarLinhaBase(lista[0]);

      if (intervalosInicio.length > 0) {
        adicionarCampo(linha, "intervalo_inicio", intervalosInicio.shift());
      }

      if (intervalosFim.length > 0) {
        adicionarCampo(linha, "intervalo_fim", intervalosFim.shift());
      }

      if (linhaTemAlgumaBatida(linha)) {
        linhas.push(linha);
      }
    }

    while (entradas.length > 0 || saidas.length > 0) {
      const linha = criarLinhaBase(lista[0]);

      if (entradas.length > 0) {
        adicionarCampo(linha, "entrada", entradas.shift());
      }

      if (saidas.length > 0) {
        adicionarCampo(linha, "saida", saidas.shift());
      }

      if (linhaTemAlgumaBatida(linha)) {
        linhas.push(linha);
      }
    }

    while (autos.length > 0) {
      const linha = criarLinhaBase(lista[0]);
      const a1 = autos.shift();
      adicionarCampo(linha, "entrada", a1);

      if (autos.length > 0) {
        const a2 = autos.shift();
        adicionarCampo(linha, "saida", a2);
      }

      if (linhaTemAlgumaBatida(linha)) {
        linhas.push(linha);
      }
    }

    return linhas.filter((linha) => linhaTemAlgumaBatida(linha));
  }

  const pontosPorDia = {};

  for (const row of rows) {
    const chaveDia = formatarChaveDia(row.marcado_em);

    if (!pontosPorDia[chaveDia]) {
      pontosPorDia[chaveDia] = [];
    }

    pontosPorDia[chaveDia].push(row);
  }

  const turnosPorDia = {};

  for (const [chaveDia, lista] of Object.entries(pontosPorDia)) {
    turnosPorDia[chaveDia] = montarLinhasDoDia(lista);
  }

  const final = [];
  const diasNoMes = new Date(anoNum, mesNum, 0).getDate();

  for (let dia = 1; dia <= diasNoMes; dia++) {
    const dataAtual = new Date(anoNum, mesNum - 1, dia);
    dataAtual.setHours(0, 0, 0, 0);

    const chaveDia = formatarChaveDia(dataAtual);
    const turnosDoDia = turnosPorDia[chaveDia] || [];
    const arquivoAtestado = diaTemAtestado(dataAtual);

    const ajusteDia = mapaAjustes[chaveDia] || {
      falta: false,
      folga: false,
      ferias: false,
    };

    const faltaDoDia = !!ajusteDia.falta;
    const folgaDoDia = !!ajusteDia.folga;
    const feriasDoDia = !!ajusteDia.ferias;
    const atestadoDoDia = !!arquivoAtestado;

    if (faltaDoDia) {
      const regrasFalta = {
        entrada: funcionario.chegada,
        intervalo_in: funcionario.intervalo_inicio,
        intervalo_fi: funcionario.intervalo_fim,
        saida: funcionario.saida,
      };

      const calculadoFalta = calcularDia({
        pontos: {},
        regras: regrasFalta,
        ehLinhaExtra: false,
        falta: true,
      });

      final.push({
        funcionario_id: funcionario.id,
        data: dataAtual.toLocaleDateString("pt-BR"),
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        entrada: calculadoFalta.entrada || "--:--",
        intervalo_inicio: calculadoFalta.intervalo_inicio || "--:--",
        intervalo_fim: calculadoFalta.intervalo_fim || "--:--",
        saida: calculadoFalta.saida || "--:--",
        total_horas: "--",
        saldo_bruto: Number(calculadoFalta.saldo_bruto) || 0,
        atraso_total: formatarSaldo(Number(calculadoFalta.saldo_bruto) || 0),
        atestado: false,
        arquivo_atestado: null,
        falta: true,
        folga: false,
        ferias: false,
        ids_originais: {},
      });

      continue;
    }

    if (folgaDoDia) {
      final.push({
        funcionario_id: funcionario.id,
        data: dataAtual.toLocaleDateString("pt-BR"),
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        entrada: "--:--",
        intervalo_inicio: "--:--",
        intervalo_fim: "--:--",
        saida: "--:--",
        total_horas: "--",
        saldo_bruto: 0,
        atraso_total: formatarSaldo(0),
        atestado: false,
        arquivo_atestado: null,
        falta: false,
        folga: true,
        ferias: false,
        ids_originais: {},
      });

      continue;
    }

    if (feriasDoDia) {
      final.push({
        funcionario_id: funcionario.id,
        data: dataAtual.toLocaleDateString("pt-BR"),
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        entrada: "--:--",
        intervalo_inicio: "--:--",
        intervalo_fim: "--:--",
        saida: "--:--",
        total_horas: "--",
        saldo_bruto: 0,
        atraso_total: formatarSaldo(0),
        atestado: false,
        arquivo_atestado: null,
        falta: false,
        folga: false,
        ferias: true,
        ids_originais: {},
      });

      continue;
    }

    if (turnosDoDia.length > 0) {
      const intervalosExtrasPrimeiraLinha = [];

      turnosDoDia.forEach((turno, index) => {
        if (index === 0) return;

        const ehLinhaSoDeIntervalo =
          !turno.entrada &&
          !turno.saida &&
          turno.intervalo_inicio &&
          turno.intervalo_fim;

        if (ehLinhaSoDeIntervalo) {
          intervalosExtrasPrimeiraLinha.push({
            inicio: turno.intervalo_inicio,
            fim: turno.intervalo_fim,
          });
        }
      });

      turnosDoDia.forEach((turno, index) => {
        let result = {
          entrada: formatarHora(turno.entrada),
          intervalo_inicio: formatarHora(turno.intervalo_inicio),
          intervalo_fim: formatarHora(turno.intervalo_fim),
          saida: formatarHora(turno.saida),
          total_horas: "--",
          saldo_bruto: 0,
        };

        const ehLinhaSoDeIntervalo =
          !turno.entrada &&
          !turno.saida &&
          turno.intervalo_inicio &&
          turno.intervalo_fim;

        const pontosCalculo =
          index === 0
            ? {
                ...turno,
                intervalosExtras: intervalosExtrasPrimeiraLinha,
              }
            : turno;

        if (turno.entrada) {
          const calculado = calcularDia({
            pontos: pontosCalculo,
            regras: turno.regras,
            ehLinhaExtra: index > 0,
            falta: false,
          });

          result = {
            entrada: calculado.entrada || formatarHora(turno.entrada),
            intervalo_inicio:
              calculado.intervalo_inicio || formatarHora(turno.intervalo_inicio),
            intervalo_fim:
              calculado.intervalo_fim || formatarHora(turno.intervalo_fim),
            saida: calculado.saida || formatarHora(turno.saida),
            total_horas: calculado.total_horas || "--",
            saldo_bruto: Number(calculado.saldo_bruto) || 0,
          };
        } else if (ehLinhaSoDeIntervalo) {
          result = {
            entrada: "--:--",
            intervalo_inicio: formatarHora(turno.intervalo_inicio),
            intervalo_fim: formatarHora(turno.intervalo_fim),
            saida: "--:--",
            total_horas: "--",
            saldo_bruto: 0,
          };
        }

        final.push({
          funcionario_id: funcionario.id,
          data: dataAtual.toLocaleDateString("pt-BR"),
          nome: turno.nome || funcionario.nome,
          cpf: turno.cpf || funcionario.cpf,
          entrada: result.entrada || "--:--",
          intervalo_inicio: result.intervalo_inicio || "--:--",
          intervalo_fim: result.intervalo_fim || "--:--",
          saida: result.saida || "--:--",
          total_horas: result.total_horas || "--",
          saldo_bruto: Number(result.saldo_bruto) || 0,
          atraso_total: formatarSaldo(Number(result.saldo_bruto) || 0),
          atestado: atestadoDoDia,
          arquivo_atestado: arquivoAtestado || null,
          falta: false,
          folga: false,
          ferias: false,
          ids_originais: turno.ids_originais || {},
        });
      });
    } else {
      final.push({
        funcionario_id: funcionario.id,
        data: dataAtual.toLocaleDateString("pt-BR"),
        nome: funcionario.nome,
        cpf: funcionario.cpf,
        entrada: "--:--",
        intervalo_inicio: "--:--",
        intervalo_fim: "--:--",
        saida: "--:--",
        total_horas: "--",
        saldo_bruto: 0,
        atraso_total: formatarSaldo(0),
        atestado: atestadoDoDia,
        arquivo_atestado: arquivoAtestado || null,
        falta: false,
        folga: false,
        ferias: false,
        ids_originais: {},
      });
    }
  }

  return final;
}

const relatorioFuncionario = async (req, res) => {
  try {
    const { id } = req.params;
    const { mes, ano } = req.query;

    const final = await gerarRelatorioFuncionario(id, mes, ano);
    return res.json(final);
  } catch (err) {
    console.error("Erro no relatório do funcionário:", err);
    return res.status(500).json({ error: err.message });
  }
};

const relatorioTodosFuncionarios = async (req, res) => {
  try {
    await garantirTabelas();

    const { mes, ano } = req.query;

    const funcionariosQuery = await pool.query(`
      SELECT id, nome, cpf
      FROM funcionarios
      ORDER BY nome ASC
    `);

    const funcionarios = funcionariosQuery.rows;
    const resultadoFinal = [];

    for (const funcionario of funcionarios) {
      const relatorio = await gerarRelatorioFuncionario(funcionario.id, mes, ano);
      resultadoFinal.push(...relatorio);
    }

    return res.json(resultadoFinal);
  } catch (err) {
    console.error("Erro no relatório de todos:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  gerarRelatorioFuncionario,
  relatorioFuncionario,
  relatorioTodosFuncionarios,
};