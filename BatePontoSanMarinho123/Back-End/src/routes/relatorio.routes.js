const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const pool = require("../database/pool");
const {
  relatorioFuncionario,
  relatorioTodosFuncionarios,
} = require("../controllers/relatorio.controller");

/* =========================================================
   FUNÇÕES AUXILIARES
========================================================= */

function somarSaldo(registros = []) {
  return registros.reduce((acc, item) => {
    if (item.folga) return acc;
    return acc + (Number(item.saldo_bruto) || 0);
  }, 0);
}

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

function formatarPeriodoBonito(mes, ano) {
  return `${nomeMes(mes)}/${ano}`;
}

function formatarTexto(valor, fallback = "-") {
  if (valor === null || valor === undefined || valor === "") {
    return fallback;
  }
  return String(valor);
}

function textoStatus(item) {
  if (item.falta) return "Falta";
  if (item.folga) return "Folga";
  if (item.atestado) return "Atestado";
  return "Normal";
}

function textoSaldo(item) {
  if (item.folga) return "+0h 0m";
  return formatarSaldoMinutos(Number(item.saldo_bruto) || 0);
}

function corLinhaHex(item, indice) {
  if (item.folga) return "EAF3FF";
  if (item.falta) return "FDECEC";
  if (item.atestado) return "FFF4E5";
  if (indice % 2 === 0) return "F3F3F3";
  return null;
}

/* =========================================================
   PDF
========================================================= */

function criarCabecalhoFuncionario(doc, funcionario, mes, ano, saldoTexto) {
  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .text("SM MARINHO LTDA    CNPJ 52.830.136/0001-22", 20, 20, {
      align: "center",
      width: 790,
    });

  doc.moveDown(1.2);

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("Relatório de Frequência", 20, doc.y, {
      align: "left",
    });

  doc.moveDown(0.8);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(`Nome: ${formatarTexto(funcionario.nome)}`);
  doc
    .font("Helvetica")
    .fontSize(10)
    .text(`CPF: ${formatarTexto(funcionario.cpf)}`);
  doc.text(`Período: ${formatarPeriodoBonito(mes, ano)}`);
  doc.text(`Saldo acumulado: ${saldoTexto}`);

  doc.moveDown(0.6);
  doc.moveTo(20, doc.y).lineTo(810, doc.y).stroke();
  doc.moveDown(0.8);
}

function desenharHeaderTabela(doc, y) {
  const colunas = {
    data: 20,
    entrada: 105,
    intervalo: 180,
    retorno: 265,
    saida: 350,
    total: 435,
    saldo: 520,
    status: 640,
  };

  doc.save();
  doc.rect(20, y - 3, 790, 22).fill("#2F80C0");
  doc.restore();

  doc.fillColor("white").font("Helvetica-Bold").fontSize(9);
  doc.text("Data", colunas.data, y);
  doc.text("Entrada", colunas.entrada, y);
  doc.text("Intervalo", colunas.intervalo, y);
  doc.text("Retorno", colunas.retorno, y);
  doc.text("Saída", colunas.saida, y);
  doc.text("Total", colunas.total, y);
  doc.text("Saldo", colunas.saldo, y);
  doc.text("Status", colunas.status, y);

  doc.fillColor("black");
  return y + 24;
}

function desenharLinhaTabela(doc, item, y, indice) {
  const colunas = {
    data: 20,
    entrada: 105,
    intervalo: 180,
    retorno: 265,
    saida: 350,
    total: 435,
    saldo: 520,
    status: 640,
  };

  let corFundo = null;
  let corTextoData = "black";

  if (item.folga) {
    corFundo = "#EAF3FF";
    corTextoData = "#2563EB";
  } else if (item.falta) {
    corFundo = "#FDECEC";
    corTextoData = "#DC2626";
  } else if (item.atestado) {
    corFundo = "#FFF4E5";
    corTextoData = "#D97706";
  } else if (indice % 2 === 0) {
    corFundo = "#F3F3F3";
  }

  if (corFundo) {
    doc.save();
    doc.rect(20, y - 2, 790, 20).fill(corFundo);
    doc.restore();
  }

  const saldoLinha = item.folga
    ? "+0h 0m"
    : formatarSaldoMinutos(Number(item.saldo_bruto) || 0);

  let statusTexto = "Normal";
  let corStatus = "#16A34A";

  if (item.falta) {
    statusTexto = "Falta";
    corStatus = "#DC2626";
  } else if (item.folga) {
    statusTexto = "Folga";
    corStatus = "#2563EB";
  } else if (item.atestado) {
    statusTexto = "Atestado";
    corStatus = "#D97706";
  }

  let corSaldo = "#16A34A";
  if (item.atestado) {
    corSaldo = "#D97706";
  } else if (item.folga) {
    corSaldo = "#2563EB";
  } else if (Number(item.saldo_bruto) < 0) {
    corSaldo = "#DC2626";
  }

  doc.font("Helvetica").fontSize(9);

  doc.fillColor(corTextoData);
  doc.text(formatarTexto(item.data, "--"), colunas.data, y, { width: 75 });

  doc.fillColor("black");
  doc.text(formatarTexto(item.entrada, "--:--"), colunas.entrada, y, { width: 60 });
  doc.text(formatarTexto(item.intervalo_inicio, "--:--"), colunas.intervalo, y, {
    width: 65,
  });
  doc.text(formatarTexto(item.intervalo_fim, "--:--"), colunas.retorno, y, {
    width: 65,
  });
  doc.text(formatarTexto(item.saida, "--:--"), colunas.saida, y, { width: 60 });
  doc.text(formatarTexto(item.total_horas, "--"), colunas.total, y, { width: 70 });

  doc.fillColor(corSaldo).font("Helvetica-Bold");
  doc.text(saldoLinha, colunas.saldo, y, { width: 90 });

  doc.fillColor(corStatus).font("Helvetica-Bold");
  doc.text(statusTexto, colunas.status, y, { width: 100 });

  doc.fillColor("black").font("Helvetica");

  return y + 20;
}

function desenharLegenda(doc) {
  let y = doc.y + 6;

  if (y > 500) {
    doc.addPage({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });
    y = 50;
  }

  doc.font("Helvetica-Bold").fontSize(10).fillColor("black");
  doc.text("Legenda:", 20, y);

  y += 16;

  doc.save();
  doc.rect(20, y, 14, 10).fill("#FDECEC");
  doc.restore();
  doc.font("Helvetica").fontSize(9).fillColor("black");
  doc.text("Falta", 40, y - 1);

  doc.save();
  doc.rect(100, y, 14, 10).fill("#EAF3FF");
  doc.restore();
  doc.text("Folga", 120, y - 1);

  doc.save();
  doc.rect(180, y, 14, 10).fill("#FFF4E5");
  doc.restore();
  doc.text("Atestado", 200, y - 1);

  doc.y = y + 16;
}

function desenharObservacoes(doc, mes, saldoTexto) {
  let y = doc.y + 8;

  if (y > 500) {
    doc.addPage({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });
    y = 60;
  }

  const x = 20;
  const largura = 790;
  const altura = 58;

  doc.save();
  doc.rect(x, y, largura, altura).stroke();
  doc.restore();

  doc.font("Helvetica").fontSize(11).fillColor("black");

  doc.text(
    `OBSERVAÇÕES: Horas Extras mês ${Number(mes)} = ${saldoTexto}, ajustada ao banco de horas.`,
    x + 8,
    y + 6,
    {
      width: largura - 16,
      align: "left",
    }
  );

  doc.text(
    "As horas positivas/negativas serão pagas ou descontadas no prazo de 60 dias.",
    x + 8,
    y + 24,
    {
      width: largura - 16,
      align: "left",
    }
  );

  doc.text(
    "Dias com falta, folga e atestado aparecem na coluna Status do relatório.",
    x + 8,
    y + 40,
    {
      width: largura - 16,
      align: "left",
    }
  );

  doc.y = y + altura + 4;
}

function desenharCampoAssinatura(doc, funcionario) {
  let y = doc.y + 12;

  if (y > 520) {
    doc.addPage({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });
    y = 80;
  }

  const largura = 260;
  const x = 280;

  doc.moveTo(x, y).lineTo(x + largura, y).stroke();

  doc
    .font("Helvetica")
    .fontSize(10)
    .text(formatarTexto(funcionario.nome, ""), x, y + 4, {
      width: largura,
      align: "center",
    });

  doc.text("Assinatura do funcionário", x, y + 18, {
    width: largura,
    align: "center",
  });

  doc.y = y + 35;
}

function desenharTabelaFuncionario(doc, funcionario, dados, mes, ano) {
  const saldoTextoFuncionario = formatarSaldoMinutos(somarSaldo(dados));

  criarCabecalhoFuncionario(doc, funcionario, mes, ano, saldoTextoFuncionario);

  let y = doc.y;
  y = desenharHeaderTabela(doc, y);

  for (let i = 0; i < dados.length; i++) {
    if (y > 520) {
      doc.addPage({
        size: "A4",
        layout: "landscape",
        margin: 20,
      });

      y = 30;
      y = desenharHeaderTabela(doc, y);
    }

    y = desenharLinhaTabela(doc, dados[i], y, i);
  }

  doc.y = y + 8;
  desenharLegenda(doc);
  desenharObservacoes(doc, mes, saldoTextoFuncionario);
  desenharCampoAssinatura(doc, funcionario);
}

/* =========================================================
   EXCEL
========================================================= */

function aplicarBordaLinha(row) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "D9D9D9" } },
      left: { style: "thin", color: { argb: "D9D9D9" } },
      bottom: { style: "thin", color: { argb: "D9D9D9" } },
      right: { style: "thin", color: { argb: "D9D9D9" } },
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
}

function estilizarCabecalhoPlanilha(ws, funcionario, mes, ano, saldoTexto) {
  ws.mergeCells("A1:H1");
  ws.getCell("A1").value = "SM MARINHO LTDA    CNPJ 52.830.136/0001-22";
  ws.getCell("A1").font = { bold: true, size: 16 };
  ws.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  ws.mergeCells("A3:H3");
  ws.getCell("A3").value = "Relatório de Frequência";
  ws.getCell("A3").font = { bold: true, size: 14 };

  ws.getCell("A5").value = `Nome: ${formatarTexto(funcionario.nome)}`;
  ws.getCell("A6").value = `CPF: ${formatarTexto(funcionario.cpf)}`;
  ws.getCell("A7").value = `Período: ${formatarPeriodoBonito(mes, ano)}`;
  ws.getCell("A8").value = `Saldo acumulado: ${saldoTexto}`;

  ws.getColumn("A").width = 15;
  ws.getColumn("B").width = 14;
  ws.getColumn("C").width = 14;
  ws.getColumn("D").width = 14;
  ws.getColumn("E").width = 14;
  ws.getColumn("F").width = 14;
  ws.getColumn("G").width = 14;
  ws.getColumn("H").width = 16;
}

function criarTabelaExcelFuncionario(ws, funcionario, dados, mes, ano) {
  const saldoTextoFuncionario = formatarSaldoMinutos(somarSaldo(dados));

  estilizarCabecalhoPlanilha(ws, funcionario, mes, ano, saldoTextoFuncionario);

  const headerRowIndex = 10;
  const headerRow = ws.getRow(headerRowIndex);

  headerRow.values = [
    "Data",
    "Entrada",
    "Intervalo",
    "Retorno",
    "Saída",
    "Total",
    "Saldo",
    "Status",
  ];

  headerRow.height = 22;

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2F80C0" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFF" } },
    };
  });

  let rowIndex = headerRowIndex + 1;

  dados.forEach((item, indice) => {
    const status = textoStatus(item);
    const saldo = textoSaldo(item);
    const fundo = corLinhaHex(item, indice);

    const row = ws.getRow(rowIndex);
    row.values = [
      formatarTexto(item.data, "--"),
      formatarTexto(item.entrada, "--:--"),
      formatarTexto(item.intervalo_inicio, "--:--"),
      formatarTexto(item.intervalo_fim, "--:--"),
      formatarTexto(item.saida, "--:--"),
      formatarTexto(item.total_horas, "--"),
      saldo,
      status,
    ];

    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.font = { size: 10 };

      if (fundo) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fundo },
        };
      }

      if (colNumber === 7) {
        if (item.atestado) {
          cell.font = { bold: true, color: { argb: "D97706" } };
        } else if (item.folga) {
          cell.font = { bold: true, color: { argb: "2563EB" } };
        } else if (Number(item.saldo_bruto) < 0) {
          cell.font = { bold: true, color: { argb: "DC2626" } };
        } else {
          cell.font = { bold: true, color: { argb: "16A34A" } };
        }
      }

      if (colNumber === 8) {
        let cor = "16A34A";
        if (item.falta) cor = "DC2626";
        if (item.folga) cor = "2563EB";
        if (item.atestado) cor = "D97706";

        cell.font = { bold: true, color: { argb: cor } };
      }

      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    aplicarBordaLinha(row);
    rowIndex++;
  });

  rowIndex += 1;
  ws.getCell(`A${rowIndex}`).value = "Legenda:";
  ws.getCell(`A${rowIndex}`).font = { bold: true };

  rowIndex++;
  ws.getCell(`A${rowIndex}`).value = "Falta";
  ws.getCell(`A${rowIndex}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FDECEC" },
  };

  ws.getCell(`B${rowIndex}`).value = "Folga";
  ws.getCell(`B${rowIndex}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "EAF3FF" },
  };

  ws.getCell(`C${rowIndex}`).value = "Atestado";
  ws.getCell(`C${rowIndex}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4E5" },
  };

  rowIndex += 2;
  ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
  ws.getCell(`A${rowIndex}`).value =
    `OBSERVAÇÕES: Horas Extras mês ${Number(mes)} = ${saldoTextoFuncionario}, ajustada ao banco de horas.`;

  rowIndex++;
  ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
  ws.getCell(`A${rowIndex}`).value =
    "As horas positivas/negativas serão pagas ou descontadas no prazo de 60 dias.";

  rowIndex++;
  ws.mergeCells(`A${rowIndex}:H${rowIndex}`);
  ws.getCell(`A${rowIndex}`).value =
    "Dias com falta, folga e atestado aparecem na coluna Status do relatório.";

  rowIndex += 3;
  ws.mergeCells(`C${rowIndex}:F${rowIndex}`);
  ws.getCell(`C${rowIndex}`).value = "________________________________________";
  ws.getCell(`C${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  ws.mergeCells(`C${rowIndex}:F${rowIndex}`);
  ws.getCell(`C${rowIndex}`).value = formatarTexto(funcionario.nome, "");
  ws.getCell(`C${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;
  ws.mergeCells(`C${rowIndex}:F${rowIndex}`);
  ws.getCell(`C${rowIndex}`).value = "Assinatura do funcionário";
  ws.getCell(`C${rowIndex}`).alignment = { horizontal: "center" };

  ws.views = [{ state: "frozen", ySplit: 10 }];
}

/* =========================================================
   BUSCAS AUXILIARES
========================================================= */

async function buscarFuncionarioPorId(funcionarioId) {
  const result = await pool.query(
    `
    SELECT id, nome, cpf
    FROM funcionarios
    WHERE id = $1
    `,
    [funcionarioId]
  );

  return result.rows[0] || null;
}

async function buscarDadosRelatorioFuncionario(funcionarioId, mes, ano) {
  const fakeReq = {
    params: { id: funcionarioId },
    query: { mes, ano },
  };

  let dados = null;
  let statusCode = 200;

  const fakeRes = {
    json(data) {
      dados = data;
      return data;
    },
    status(code) {
      statusCode = code;
      return this;
    },
  };

  await relatorioFuncionario(fakeReq, fakeRes);

  if (statusCode >= 400) {
    return [];
  }

  return Array.isArray(dados) ? dados : [];
}

/* =========================================================
   ROTAS PDF — SEM SALVAR NO DISCO
========================================================= */

router.get("/pdf/todos", async (req, res) => {
  const { mes, ano } = req.query;

  try {
    if (!mes || !ano) {
      return res.status(400).json({ error: "Informe mês e ano." });
    }

    const funcionariosQuery = await pool.query(`
      SELECT id, nome, cpf
      FROM funcionarios
      ORDER BY nome ASC
    `);

    if (!funcionariosQuery.rows.length) {
      return res.status(404).json({ error: "Nenhum funcionário encontrado." });
    }

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="relatorio_todos_${mes}_${ano}.pdf"`
    );

    doc.pipe(res);

    let gerouAlgumFuncionario = false;
    let primeiroFuncionarioComDados = true;

    for (const funcionarioBase of funcionariosQuery.rows) {
      const funcionario = await buscarFuncionarioPorId(funcionarioBase.id);
      if (!funcionario) continue;

      const dadosFuncionario = await buscarDadosRelatorioFuncionario(
        funcionario.id,
        mes,
        ano
      );

      if (!dadosFuncionario.length) continue;

      if (!primeiroFuncionarioComDados) {
        doc.addPage({
          size: "A4",
          layout: "landscape",
          margin: 20,
        });
      }

      desenharTabelaFuncionario(doc, funcionario, dadosFuncionario, mes, ano);

      gerouAlgumFuncionario = true;
      primeiroFuncionarioComDados = false;
    }

    if (!gerouAlgumFuncionario) {
      doc
        .font("Helvetica")
        .fontSize(12)
        .text("Nenhum registro encontrado para o período informado.", 20, 30);
    }

    doc.end();
  } catch (err) {
    console.error("Erro ao gerar PDF de todos:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro ao gerar PDF de todos." });
    }
  }
});

router.get("/pdf/:funcId", async (req, res) => {
  const { funcId } = req.params;
  const { mes, ano } = req.query;

  try {
    if (!funcId || !mes || !ano) {
      return res.status(400).json({ error: "Informe funcionário, mês e ano." });
    }

    const funcionario = await buscarFuncionarioPorId(funcId);
    if (!funcionario) {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const dadosFuncionario = await buscarDadosRelatorioFuncionario(
      funcId,
      mes,
      ano
    );

    if (!dadosFuncionario.length) {
      return res.status(404).json({ error: "Nenhum registro encontrado." });
    }

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="relatorio_${funcId}_${mes}_${ano}.pdf"`
    );

    doc.pipe(res);

    desenharTabelaFuncionario(doc, funcionario, dadosFuncionario, mes, ano);

    doc.end();
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro ao gerar PDF." });
    }
  }
});

/* =========================================================
   ROTAS EXCEL — SEM SALVAR NO DISCO
========================================================= */

router.get("/excel/todos", async (req, res) => {
  const { mes, ano } = req.query;

  try {
    if (!mes || !ano) {
      return res.status(400).json({ error: "Informe mês e ano." });
    }

    const funcionariosQuery = await pool.query(`
      SELECT id, nome, cpf
      FROM funcionarios
      ORDER BY nome ASC
    `);

    if (!funcionariosQuery.rows.length) {
      return res.status(404).json({ error: "Nenhum funcionário encontrado." });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema BatePonto";
    workbook.created = new Date();

    let gerouAlgumFuncionario = false;

    for (const funcionarioBase of funcionariosQuery.rows) {
      const funcionario = await buscarFuncionarioPorId(funcionarioBase.id);
      if (!funcionario) continue;

      const dadosFuncionario = await buscarDadosRelatorioFuncionario(
        funcionario.id,
        mes,
        ano
      );

      if (!dadosFuncionario.length) continue;

      let nomeAba = String(funcionario.nome || `Func_${funcionario.id}`).trim();
      if (!nomeAba) nomeAba = `Func_${funcionario.id}`;
      nomeAba = nomeAba.substring(0, 31);

      const ws = workbook.addWorksheet(nomeAba);
      criarTabelaExcelFuncionario(ws, funcionario, dadosFuncionario, mes, ano);

      gerouAlgumFuncionario = true;
    }

    if (!gerouAlgumFuncionario) {
      const ws = workbook.addWorksheet("Relatório");
      ws.getCell("A1").value = "Nenhum registro encontrado para o período informado.";
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="relatorio_todos_${mes}_${ano}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erro ao gerar Excel de todos:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro ao gerar Excel de todos." });
    }
  }
});

router.get("/excel/:funcId", async (req, res) => {
  const { funcId } = req.params;
  const { mes, ano } = req.query;

  try {
    if (!funcId || !mes || !ano) {
      return res.status(400).json({ error: "Informe funcionário, mês e ano." });
    }

    const funcionario = await buscarFuncionarioPorId(funcId);
    if (!funcionario) {
      return res.status(404).json({ error: "Funcionário não encontrado." });
    }

    const dadosFuncionario = await buscarDadosRelatorioFuncionario(
      funcId,
      mes,
      ano
    );

    if (!dadosFuncionario.length) {
      return res.status(404).json({ error: "Nenhum registro encontrado." });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Sistema BatePonto";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Relatório");
    criarTabelaExcelFuncionario(ws, funcionario, dadosFuncionario, mes, ano);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="relatorio_${funcId}_${mes}_${ano}.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Erro ao gerar Excel:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Erro ao gerar Excel." });
    }
  }
});

/* =========================================================
   ROTAS JSON
========================================================= */

router.get("/todos", relatorioTodosFuncionarios);
router.get("/:id", relatorioFuncionario);

module.exports = router;