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
    if (
      item.folga ||
      item.atestado ||
      item.ferias ||
      item.falta_justificada
    ) {
      return acc;
    }

    const saldo = Number(item.saldo_bruto) || 0;

    if (saldo > 0 && saldo <= 15) return acc;

    return acc + saldo;
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

function limparTexto(valor, fallback = "-") {
  if (valor === null || valor === undefined || valor === "") return fallback;

  const texto = String(valor).trim();

  if (texto === "--:--" || texto === "--") return fallback;

  return texto;
}

function textoStatus(item) {
  if (item.falta) return "FALTA";
  if (item.falta_justificada) return "FALTA JUSTIFICADA";
  if (item.feriado) return "FERIADO";
  if (item.folga) return "FOLGA";
  if (item.atestado) return "ATESTADO";
  if (item.ferias) return "FÉRIAS";
  return "-";
}

function corStatus(item) {
  if (item.falta) return "FF0000";
  if (item.falta_justificada) return "C00000";
  if (item.feriado) return "FF0000";
  if (item.folga) return "0070C0";
  if (item.atestado) return "C65911";
  if (item.ferias) return "7030A0";
  return "0070C0";
}

function corFundoStatus(item) {
  if (item.falta) return "FFFFFF";
  if (item.falta_justificada) return "F4CCCC";
  if (item.feriado) return "B4C7E7";
  if (item.folga) return "D9EAF7";
  if (item.atestado) return "FCE4D6";
  if (item.ferias) return "E4DFEC";
  return "EDEDED";
}

function getNomeDiaSemanaPorDataBR(dataBR) {
  if (!dataBR) return "-";

  const partes = String(dataBR).split("/");
  if (partes.length !== 3) return "-";

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (!dia || !mes || !ano) return "-";

  const data = new Date(ano, mes - 1, dia);

  const dias = [
    "Domingo",
    "Segunda",
    "Terça",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sábado",
  ];

  return dias[data.getDay()] || "-";
}

function dataBRParaDate(dataBR) {
  if (!dataBR) return null;

  const partes = String(dataBR).split("/");
  if (partes.length !== 3) return null;

  const dia = Number(partes[0]);
  const mes = Number(partes[1]);
  const ano = Number(partes[2]);

  if (!dia || !mes || !ano) return null;

  return new Date(ano, mes - 1, dia);
}

function horaParaNumeroExcel(valor) {
  const texto = limparTexto(valor, "");

  if (!texto) return "";

  const partes = texto.split(":");
  if (partes.length < 2) return "";

  const h = Number(partes[0]);
  const m = Number(partes[1]);

  if (Number.isNaN(h) || Number.isNaN(m)) return "";

  return (h * 60 + m) / 1440;
}

function horaParaTextoPDF(valor) {
  const texto = limparTexto(valor, "");

  if (!texto) return "-";

  return texto.replace(/:/g, "");
}

function temHorario(item) {
  return !!(
    limparTexto(item.entrada, "") ||
    limparTexto(item.intervalo_inicio, "") ||
    limparTexto(item.intervalo_fim, "") ||
    limparTexto(item.saida, "")
  );
}

function formulaDiaSemanaExcel(rowNumber) {
  return `IF(A${rowNumber}="","",CHOOSE(WEEKDAY(A${rowNumber},1),"Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"))`;
}

function formulaHDia(rowNumber) {
  return `IFERROR(IF(OR(D${rowNumber}="",D${rowNumber}=0),0,IF(TEXT(D${rowNumber},"[hh]:mm:ss")<TEXT(C${rowNumber},"[hh]:mm:ss"),(1-C${rowNumber}+D${rowNumber}),D${rowNumber}-C${rowNumber}))+IF(OR(F${rowNumber}="",F${rowNumber}=0),0,IF(TEXT(F${rowNumber},"[hh]:mm:ss")<TEXT(E${rowNumber},"[hh]:mm:ss"),(1-E${rowNumber}+F${rowNumber}),F${rowNumber}-E${rowNumber})),0)`;
}

function formulaAtraso(rowNumber) {
  return `IF(A${rowNumber}="",0,IF(OR((VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE)-G${rowNumber})<0,C${rowNumber}=""),0,(VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE)-G${rowNumber})))`;
}

function formulaHoraExtra(rowNumber) {
  return `IF(A${rowNumber}="",0,IF((G${rowNumber}-VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE))<0,0,(G${rowNumber}-VLOOKUP(B${rowNumber},$L$6:$M$13,2,FALSE))))`;
}

/* =========================================================
   PDF
========================================================= */

function pdfHeader(doc, funcionario, mes, ano, saldoTexto) {
  doc.font("Helvetica-Bold").fontSize(20).fillColor("black");

  doc.text("SM MARINHO LTDA", 20, 25, {
    width: 800,
    align: "center",
  });

  doc.font("Helvetica-Bold").fontSize(10).fillColor("black");

  doc.text(`PERÍODO: ${formatarPeriodoBonito(mes, ano)}`, 20, 52, {
    width: 800,
    align: "center",
  });

  doc.moveTo(20, 75).lineTo(820, 75).stroke();

  doc.font("Helvetica-Bold").fontSize(9);

  doc.rect(20, 80, 140, 20).stroke();
  doc.text("Funcionário", 25, 84, {
    width: 130,
    align: "center",
  });

  doc.rect(160, 80, 320, 20).stroke();
  doc.text(funcionario.nome || "", 165, 84, {
    width: 310,
    align: "left",
  });

  doc.rect(485, 80, 335, 20).stroke();
  doc.text(`H.E. / Atrasos / A.N.     ${saldoTexto}`, 490, 84, {
    width: 320,
    align: "center",
  });
}

function pdfTableHeader(doc, y) {
  const cols = {
    data: 20,
    dia: 85,
    entrada1: 160,
    saida1: 235,
    entrada2: 310,
    saida2: 385,
    diaria: 470,
    atrasos: 550,
    extras: 635,
    an: 730,
  };

  doc.save();
  doc.rect(20, y, 800, 22).fill("#D9D9D9");
  doc.restore();

  doc.font("Helvetica-Bold").fontSize(8).fillColor("black");

  doc.text("Data", cols.data, y + 6, { width: 60, align: "center" });
  doc.text("Dia Semana", cols.dia, y + 6, { width: 70, align: "center" });
  doc.text("Entrada", cols.entrada1, y + 6, { width: 70, align: "center" });
  doc.text("Saída", cols.saida1, y + 6, { width: 70, align: "center" });
  doc.text("Entrada", cols.entrada2, y + 6, { width: 70, align: "center" });
  doc.text("Saída", cols.saida2, y + 6, { width: 70, align: "center" });
  doc.text("H. Diária", cols.diaria, y + 6, { width: 70, align: "center" });
  doc.text("Atrasos", cols.atrasos, y + 6, { width: 75, align: "center" });
  doc.text("Horas Extras", cols.extras, y + 6, {
    width: 85,
    align: "center",
  });
  doc.text("A.N.", cols.an, y + 6, { width: 85, align: "center" });

  doc.rect(20, y, 800, 22).stroke();

  return y + 22;
}

function pdfLinha(doc, item, y, indice) {
  const cols = {
    data: 20,
    dia: 85,
    entrada1: 160,
    saida1: 235,
    entrada2: 310,
    saida2: 385,
    diaria: 470,
    atrasos: 550,
    extras: 635,
    an: 730,
  };

  const altura = 19;
  const fundo = indice % 2 === 0 ? "#F2F2F2" : "#FFFFFF";

  doc.save();
  doc.rect(20, y, 800, altura).fill(fundo);
  doc.restore();

  doc.font("Helvetica").fontSize(8).fillColor("black");

  const diaSemana = getNomeDiaSemanaPorDataBR(item.data);

  const entrada1 = horaParaTextoPDF(item.entrada);
  const saida1 = horaParaTextoPDF(item.intervalo_inicio);
  const entrada2 = horaParaTextoPDF(item.intervalo_fim);
  const saida2 = horaParaTextoPDF(item.saida);
  const total = horaParaTextoPDF(item.total_horas);

  let atraso = "-";
  let extra = "-";

  const saldo = Number(item.saldo_bruto) || 0;

  if (
    !item.folga &&
    !item.atestado &&
    !item.ferias &&
    !item.falta_justificada &&
    temHorario(item)
  ) {
    if (saldo < 0) atraso = formatarSaldoMinutos(saldo).replace("-", "");
    if (saldo > 15) extra = formatarSaldoMinutos(saldo).replace("+", "");
  }

  const status = textoStatus(item);

  doc.text(limparTexto(item.data, "-"), cols.data, y + 5, {
    width: 60,
    align: "center",
  });

  doc.font(
    diaSemana === "Sábado" || diaSemana === "Domingo"
      ? "Helvetica-Bold"
      : "Helvetica"
  );

  doc.text(diaSemana, cols.dia, y + 5, {
    width: 70,
    align: "center",
  });

  doc.font("Helvetica").fillColor("black");

  doc.text(entrada1, cols.entrada1, y + 5, { width: 70, align: "center" });
  doc.text(saida1, cols.saida1, y + 5, { width: 70, align: "center" });
  doc.text(entrada2, cols.entrada2, y + 5, { width: 70, align: "center" });
  doc.text(saida2, cols.saida2, y + 5, { width: 70, align: "center" });
  doc.text(total, cols.diaria, y + 5, { width: 70, align: "center" });

  doc.fillColor("#FF0000");
  doc.text(atraso, cols.atrasos, y + 5, { width: 75, align: "center" });

  doc.fillColor("#0070C0");
  doc.text(extra, cols.extras, y + 5, { width: 85, align: "center" });

  doc.fillColor(`#${corStatus(item)}`).font("Helvetica-Bold");
  doc.text(status, cols.an, y + 5, { width: 85, align: "center" });

  doc.fillColor("black").font("Helvetica");

  doc.rect(20, y, 800, altura).stroke();

  return y + altura;
}

function desenharTabelaFuncionario(doc, funcionario, dados, mes, ano) {
  const saldoTextoFuncionario = formatarSaldoMinutos(somarSaldo(dados));

  pdfHeader(doc, funcionario, mes, ano, saldoTextoFuncionario);

  let y = 112;
  y = pdfTableHeader(doc, y);

  for (let i = 0; i < dados.length; i++) {
    if (y > 535) {
      doc.addPage({
        size: "A4",
        layout: "landscape",
        margin: 20,
      });

      pdfHeader(doc, funcionario, mes, ano, saldoTextoFuncionario);
      y = 112;
      y = pdfTableHeader(doc, y);
    }

    y = pdfLinha(doc, dados[i], y, i);
  }

  y += 14;

  if (y > 520) {
    doc.addPage({
      size: "A4",
      layout: "landscape",
      margin: 20,
    });

    y = 80;
  }

  doc.font("Helvetica").fontSize(9).fillColor("black");

  doc.rect(20, y, 800, 50).stroke();

  doc.text(
    `OBSERVAÇÕES: Horas Extras mês ${Number(
      mes
    )} = ${saldoTextoFuncionario}, ajustada ao banco de horas.`,
    28,
    y + 8,
    { width: 780 }
  );

  doc.text(
    "As horas positivas/negativas serão pagas ou descontadas no prazo de 60 dias.",
    28,
    y + 25,
    { width: 780 }
  );

  y += 80;

  doc.moveTo(295, y).lineTo(545, y).stroke();

  doc.font("Helvetica").fontSize(9);

  doc.text(funcionario.nome || "", 295, y + 5, {
    width: 250,
    align: "center",
  });

  doc.text("Assinatura do funcionário", 295, y + 20, {
    width: 250,
    align: "center",
  });
}

/* =========================================================
   EXCEL
========================================================= */

function aplicarBorda(cell, color = "BFBFBF") {
  cell.border = {
    top: { style: "thin", color: { argb: color } },
    left: { style: "thin", color: { argb: color } },
    bottom: { style: "thin", color: { argb: color } },
    right: { style: "thin", color: { argb: color } },
  };
}

function criarCargaHoraria(ws) {
  ws.mergeCells("L3:M3");

  ws.getCell("L3").value = "CARGA HORÁRIA";
  ws.getCell("L3").font = { bold: true };
  ws.getCell("L3").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ws.getCell("L3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9D9D9" },
  };

  aplicarBorda(ws.getCell("L3"));
  aplicarBorda(ws.getCell("M3"));

  const cargaHoraria = [
    ["Segunda", "08:30"],
    ["Terça", "08:30"],
    ["Quarta", "08:30"],
    ["Quinta", "08:30"],
    ["Sexta", "08:30"],
    ["Sábado", "08:30"],
    ["Domingo", "08:30"],
    ["FERIADOS", "08:30"],
  ];

  cargaHoraria.forEach((linha, index) => {
    const r = 6 + index;

    ws.getCell(`L${r}`).value = linha[0];
    ws.getCell(`M${r}`).value = horaParaNumeroExcel(linha[1]);
    ws.getCell(`M${r}`).numFmt = "[h]:mm";

    ws.getCell(`L${r}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "EDEDED" },
    };

    ws.getCell(`M${r}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF2CC" },
    };

    ws.getCell(`L${r}`).alignment = {
      horizontal: "left",
      vertical: "middle",
    };

    ws.getCell(`M${r}`).alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    aplicarBorda(ws.getCell(`L${r}`));
    aplicarBorda(ws.getCell(`M${r}`));
  });

  ws.getColumn("L").width = 14;
  ws.getColumn("M").width = 12;
}

function criarTabelaExcelFuncionario(ws, funcionario, dados, mes, ano) {
  const saldoTextoFuncionario = formatarSaldoMinutos(somarSaldo(dados));

  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.25,
      bottom: 0.25,
      header: 0.1,
      footer: 0.1,
    },
  };

  ws.views = [{ state: "frozen", ySplit: 4 }];

  ws.mergeCells("A1:J1");
  ws.getCell("A1").value = "SM MARINHO LTDA";
  ws.getCell("A1").font = {
    bold: true,
    size: 18,
    color: { argb: "000000" },
  };
  ws.getCell("A1").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ws.getRow(1).height = 30;

  ws.getCell("A3").value = "Funcionário";
  ws.getCell("A3").font = { bold: true };
  ws.getCell("A3").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ws.getCell("A3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9D9D9" },
  };

  ws.mergeCells("B3:F3");
  ws.getCell("B3").value = funcionario.nome || "";
  ws.getCell("B3").font = { bold: true };
  ws.getCell("B3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF2CC" },
  };

  ws.mergeCells("G3:J3");
  ws.getCell("G3").value = `H.E. / Atrasos / A.N.    ${formatarPeriodoBonito(
    mes,
    ano
  )}`;
  ws.getCell("G3").font = { bold: true };
  ws.getCell("G3").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ws.getCell("G3").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "D9D9D9" },
  };

  for (let c = 1; c <= 10; c++) {
    aplicarBorda(ws.getRow(3).getCell(c));
  }

  criarCargaHoraria(ws);

  const headerIndex = 4;
  const header = ws.getRow(headerIndex);

  header.values = [
    "Data",
    "Dia Semana",
    "Entrada",
    "Saída",
    "Entrada",
    "Saída",
    "H. Diária",
    "Atrasos",
    "Horas Extras",
    "A.N.",
  ];

  header.height = 22;

  for (let c = 1; c <= 10; c++) {
    const cell = header.getCell(c);

    cell.font = { bold: true, color: { argb: "000000" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9D9D9" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    aplicarBorda(cell);
  }

  ws.getColumn("A").width = 12;
  ws.getColumn("B").width = 14;
  ws.getColumn("C").width = 12;
  ws.getColumn("D").width = 12;
  ws.getColumn("E").width = 12;
  ws.getColumn("F").width = 12;
  ws.getColumn("G").width = 12;
  ws.getColumn("H").width = 12;
  ws.getColumn("I").width = 14;
  ws.getColumn("J").width = 14;

  let rowIndex = 5;

  dados.forEach((item, indice) => {
    const row = ws.getRow(rowIndex);
    const dataExcel = dataBRParaDate(item.data);

    row.getCell(1).value = dataExcel || limparTexto(item.data, "-");

    if (dataExcel) {
      row.getCell(1).numFmt = "dd/mm/yy";
    }

    row.getCell(2).value = {
      formula: formulaDiaSemanaExcel(rowIndex),
      result: getNomeDiaSemanaPorDataBR(item.data),
    };

    row.getCell(3).value = horaParaNumeroExcel(item.entrada);
    row.getCell(4).value = horaParaNumeroExcel(item.intervalo_inicio);
    row.getCell(5).value = horaParaNumeroExcel(item.intervalo_fim);
    row.getCell(6).value = horaParaNumeroExcel(item.saida);

    row.getCell(7).value = {
      formula: formulaHDia(rowIndex),
    };

    row.getCell(8).value = {
      formula: formulaAtraso(rowIndex),
    };

    row.getCell(9).value = {
      formula: formulaHoraExtra(rowIndex),
    };

    row.getCell(10).value = textoStatus(item);

    row.height = 20;

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);

      cell.font = { size: 10 };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };

      aplicarBorda(cell);

      if (c >= 3 && c <= 6) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF2CC" },
        };
      } else if (c >= 7 && c <= 10) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "EDEDED" },
        };
      } else if (indice % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "F2F2F2" },
        };
      }
    }

    for (let c = 3; c <= 9; c++) {
      row.getCell(c).numFmt = "[h]:mm";
    }

    const diaSemana = getNomeDiaSemanaPorDataBR(item.data);

    if (diaSemana === "Sábado" || diaSemana === "Domingo") {
      row.getCell(2).font = {
        bold: true,
        color: { argb: "000000" },
      };
    }

    row.getCell(8).font = {
      bold: true,
      color: { argb: "FF0000" },
    };

    row.getCell(9).font = {
      bold: true,
      color: { argb: "0070C0" },
    };

    row.getCell(10).font = {
      bold: true,
      color: { argb: corStatus(item) },
    };

    row.getCell(10).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: corFundoStatus(item) },
    };

    rowIndex++;
  });

  rowIndex += 2;

  ws.mergeCells(`A${rowIndex}:J${rowIndex}`);
  ws.getCell(`A${rowIndex}`).value = `OBSERVAÇÕES: Horas Extras mês ${Number(
    mes
  )} = ${saldoTextoFuncionario}, ajustada ao banco de horas.`;
  ws.getCell(`A${rowIndex}`).font = { bold: true };
  ws.getCell(`A${rowIndex}`).alignment = { horizontal: "left" };

  rowIndex++;

  ws.mergeCells(`A${rowIndex}:J${rowIndex}`);
  ws.getCell(`A${rowIndex}`).value =
    "As horas positivas/negativas serão pagas ou descontadas no prazo de 60 dias.";

  rowIndex += 3;

  ws.mergeCells(`D${rowIndex}:G${rowIndex}`);
  ws.getCell(`D${rowIndex}`).value = "________________________________________";
  ws.getCell(`D${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;

  ws.mergeCells(`D${rowIndex}:G${rowIndex}`);
  ws.getCell(`D${rowIndex}`).value = funcionario.nome || "";
  ws.getCell(`D${rowIndex}`).alignment = { horizontal: "center" };

  rowIndex++;

  ws.mergeCells(`D${rowIndex}:G${rowIndex}`);
  ws.getCell(`D${rowIndex}`).value = "Assinatura do funcionário";
  ws.getCell(`D${rowIndex}`).alignment = { horizontal: "center" };
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
   ROTAS PDF
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
    let primeiro = true;

    for (const funcionarioBase of funcionariosQuery.rows) {
      const funcionario = await buscarFuncionarioPorId(funcionarioBase.id);
      if (!funcionario) continue;

      const dadosFuncionario = await buscarDadosRelatorioFuncionario(
        funcionario.id,
        mes,
        ano
      );

      if (!dadosFuncionario.length) continue;

      if (!primeiro) {
        doc.addPage({
          size: "A4",
          layout: "landscape",
          margin: 20,
        });
      }

      desenharTabelaFuncionario(doc, funcionario, dadosFuncionario, mes, ano);

      primeiro = false;
      gerouAlgumFuncionario = true;
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
   ROTAS EXCEL
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
      nomeAba = nomeAba.replace(/[\\/*?:[\]]/g, "").substring(0, 31);

      const ws = workbook.addWorksheet(nomeAba);
      criarTabelaExcelFuncionario(ws, funcionario, dadosFuncionario, mes, ano);

      gerouAlgumFuncionario = true;
    }

    if (!gerouAlgumFuncionario) {
      const ws = workbook.addWorksheet("Relatório");
      ws.getCell("A1").value =
        "Nenhum registro encontrado para o período informado.";
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