const pool = require("../database/pool");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const { gerarRelatorioFuncionario } = require("./relatorio.controller");

function formatarSaldoMinutos(totalMinutos = 0) {
  const total = Number(totalMinutos) || 0;
  const sinal = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  const horas = Math.floor(abs / 60);
  const minutos = abs % 60;
  return `${sinal}${horas}h ${minutos}m`;
}

function nomeMes(mes) {
  const meses = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return meses[Number(mes)] || String(mes);
}

async function ensureBancoHorasTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS banco_horas_ajustes (
      id bigserial PRIMARY KEY,
      funcionario_id bigint NOT NULL,
      mes integer NOT NULL,
      ano integer NOT NULL,
      ajuste_minutos integer NOT NULL DEFAULT 0,
      observacao text,
      criado_em timestamp DEFAULT now(),
      atualizado_em timestamp DEFAULT now(),
      UNIQUE (funcionario_id, mes, ano)
    );
  `);
}

async function buscarBancoHorasInterno(mes, ano, funcionario_id) {
  let funcionariosQuery;

  if (funcionario_id && funcionario_id !== "todos") {
    funcionariosQuery = await pool.query(
      `
      SELECT id, nome, cpf
      FROM funcionarios
      WHERE id = $1
      ORDER BY nome ASC
      `,
      [funcionario_id]
    );
  } else {
    funcionariosQuery = await pool.query(`
      SELECT id, nome, cpf
      FROM funcionarios
      ORDER BY nome ASC
    `);
  }

  const funcionarios = funcionariosQuery.rows;
  const resultado = [];

  for (const funcionario of funcionarios) {
    const relatorio = await gerarRelatorioFuncionario(funcionario.id, mes, ano);

    const saldoSistema = relatorio.reduce(
      (acc, item) => acc + (Number(item.saldo_bruto) || 0),
      0
    );

    const ajusteQuery = await pool.query(
      `
      SELECT ajuste_minutos, observacao
      FROM banco_horas_ajustes
      WHERE funcionario_id = $1
        AND mes = $2
        AND ano = $3
      `,
      [funcionario.id, Number(mes), Number(ano)]
    );

    const ajuste = ajusteQuery.rows[0] || {
      ajuste_minutos: 0,
      observacao: "",
    };

    const ajusteMinutos = Number(ajuste.ajuste_minutos) || 0;
    const observacao = String(ajuste.observacao || "").trim();

    const saldoFinal =
      observacao.toLowerCase() === "pago"
        ? 0
        : saldoSistema + ajusteMinutos;

    resultado.push({
      funcionario_id: funcionario.id,
      nome: funcionario.nome,
      cpf: funcionario.cpf,
      saldo_sistema_minutos: saldoSistema,
      saldo_sistema_formatado: formatarSaldoMinutos(saldoSistema),
      ajuste_minutos: ajusteMinutos,
      ajuste_formatado: formatarSaldoMinutos(ajusteMinutos),
      observacao,
      saldo_final_minutos: saldoFinal,
      saldo_final_formatado: formatarSaldoMinutos(saldoFinal),
    });
  }

  return resultado;
}

exports.listarBancoHoras = async (req, res) => {
  try {
    await ensureBancoHorasTable();

    const { mes, ano, funcionario_id } = req.query;

    if (!mes || !ano) {
      return res.status(400).json({ error: "Informe mês e ano." });
    }

    const resultado = await buscarBancoHorasInterno(mes, ano, funcionario_id);
    return res.json(resultado);
  } catch (err) {
    console.error("Erro ao listar banco de horas:", err);
    return res.status(500).json({ error: "Erro ao listar banco de horas." });
  }
};

exports.salvarAjusteBancoHoras = async (req, res) => {
  try {
    await ensureBancoHorasTable();

    const {
      funcionario_id,
      mes,
      ano,
      ajuste_minutos,
      observacao,
    } = req.body;

    if (!funcionario_id || !mes || !ano) {
      return res.status(400).json({
        error: "Funcionário, mês e ano são obrigatórios.",
      });
    }

    await pool.query(
      `
      INSERT INTO banco_horas_ajustes (
        funcionario_id,
        mes,
        ano,
        ajuste_minutos,
        observacao,
        atualizado_em
      )
      VALUES ($1, $2, $3, $4, $5, now())
      ON CONFLICT (funcionario_id, mes, ano)
      DO UPDATE SET
        ajuste_minutos = EXCLUDED.ajuste_minutos,
        observacao = EXCLUDED.observacao,
        atualizado_em = now()
      `,
      [
        funcionario_id,
        Number(mes),
        Number(ano),
        Number(ajuste_minutos) || 0,
        observacao || "",
      ]
    );

    return res.json({
      ok: true,
      message: "Ajuste de banco de horas salvo com sucesso.",
    });
  } catch (err) {
    console.error("Erro ao salvar ajuste do banco de horas:", err);
    return res.status(500).json({ error: "Erro ao salvar ajuste." });
  }
};

exports.gerarPdfBancoHoras = async (req, res) => {
  try {
    await ensureBancoHorasTable();

    const { mes, ano, funcionario_id } = req.query;

    if (!mes || !ano) {
      return res.status(400).json({ error: "Informe mês e ano." });
    }

    const dados = await buscarBancoHorasInterno(mes, ano, funcionario_id);

    if (!dados.length) {
      return res.status(404).json({ error: "Nenhum dado encontrado." });
    }

    const doc = new PDFDocument({
      margin: 30,
      size: "A4",
      layout: "landscape",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="banco_horas_${mes}_${ano}.pdf"`
    );

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(20).text("Banco de Horas", 30, 25);
    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(11)
      .text(`Período: ${nomeMes(mes)}/${ano}`, 30, 55);

    const colunas = {
      nome: 30,
      horas: 310,
      ajuste: 430,
      observacao: 540,
      saldo: 720,
    };

    let y = 95;

    function desenharHeader() {
      doc.save();
      doc.rect(30, y - 4, 760, 24).fill("#1E293B");
      doc.restore();

      doc.fillColor("#0D6EFD").font("Helvetica-Bold").fontSize(10);
      doc.text("Funcionário", colunas.nome, y);
      doc.text("Horas", colunas.horas, y);
      doc.text("Ajuste", colunas.ajuste, y);
      doc.text("Observação", colunas.observacao, y);
      doc.text("Saldo", colunas.saldo, y);

      doc.fillColor("black");
      y += 26;
    }

    desenharHeader();

    dados.forEach((item, index) => {
      if (y > 520) {
        doc.addPage({
          margin: 30,
          size: "A4",
          layout: "landscape",
        });
        y = 40;
        desenharHeader();
      }

      if (index % 2 === 0) {
        doc.save();
        doc.rect(30, y - 3, 760, 22).fill("#F8FAFC");
        doc.restore();
      }

      doc.fillColor("#111827").font("Helvetica").fontSize(10);
      doc.text(item.nome || "-", colunas.nome, y, { width: 250 });
      doc.text(item.saldo_sistema_formatado || "-", colunas.horas, y, { width: 100 });
      doc.text(item.ajuste_formatado || "-", colunas.ajuste, y, { width: 90 });
      doc.text(item.observacao || "-", colunas.observacao, y, { width: 160 });
      doc.text(item.saldo_final_formatado || "-", colunas.saldo, y, { width: 80 });

      y += 24;
    });

    doc.end();
  } catch (err) {
    console.error("Erro ao gerar PDF do banco de horas:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro ao gerar PDF do banco de horas." });
    }
  }
};

exports.gerarExcelBancoHoras = async (req, res) => {
  try {
    await ensureBancoHorasTable();

    const { mes, ano, funcionario_id } = req.query;

    if (!mes || !ano) {
      return res.status(400).json({ error: "Informe mês e ano." });
    }

    const dados = await buscarBancoHorasInterno(mes, ano, funcionario_id);

    if (!dados.length) {
      return res.status(404).json({ error: "Nenhum dado encontrado." });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema BatePonto";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Banco de Horas");

    ws.columns = [
      { header: "Funcionário", key: "nome", width: 35 },
      { header: "Horas", key: "saldo_sistema_formatado", width: 18 },
      { header: "Ajuste", key: "ajuste_formatado", width: 18 },
      { header: "Observação", key: "observacao", width: 25 },
      { header: "Saldo", key: "saldo_final_formatado", width: 18 },
    ];

    ws.mergeCells("A1:E1");
    ws.getCell("A1").value = "Banco de Horas";
    ws.getCell("A1").font = { bold: true, size: 16 };
    ws.getCell("A1").alignment = { horizontal: "center" };

    ws.mergeCells("A2:E2");
    ws.getCell("A2").value = `Período: ${nomeMes(mes)}/${ano}`;
    ws.getCell("A2").alignment = { horizontal: "center" };

    const headerRow = ws.getRow(4);
    headerRow.values = ["Funcionário", "Horas", "Ajuste", "Observação", "Saldo"];
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "1E293B" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "D9D9D9" } },
        left: { style: "thin", color: { argb: "D9D9D9" } },
        bottom: { style: "thin", color: { argb: "D9D9D9" } },
        right: { style: "thin", color: { argb: "D9D9D9" } },
      };
    });

    let rowIndex = 5;

    dados.forEach((item, index) => {
      const row = ws.getRow(rowIndex);
      row.values = [
        item.nome || "-",
        item.saldo_sistema_formatado || "-",
        item.ajuste_formatado || "-",
        item.observacao || "-",
        item.saldo_final_formatado || "-",
      ];

      row.eachCell((cell) => {
        if (index % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "F8FAFC" },
          };
        }

        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "D9D9D9" } },
          left: { style: "thin", color: { argb: "D9D9D9" } },
          bottom: { style: "thin", color: { argb: "D9D9D9" } },
          right: { style: "thin", color: { argb: "D9D9D9" } },
        };
      });

      rowIndex++;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="banco_horas_${mes}_${ano}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erro ao gerar Excel do banco de horas:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro ao gerar Excel do banco de horas." });
    }
  }
};