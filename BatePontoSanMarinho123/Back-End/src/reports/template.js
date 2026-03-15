const PDFDocument = require("pdfkit");
const fs = require("fs-extra");
const path = require("path");

async function gerarPDF(dados, funcionario) {
  const file = path.join(__dirname, "relatorio.pdf");
  const doc = new PDFDocument({ margin: 40 });

  doc.pipe(fs.createWriteStream(file));

  doc.fontSize(20).text("Relatório de Ponto", { align: "center" });
  doc.moveDown();
  doc.fontSize(14).text(`Funcionário: ${funcionario.nome}`);
  doc.text(`CPF: ${funcionario.cpf}`);
  doc.text(`Mês/Ano: ${dados[0].data}`);

  doc.moveDown();

  dados.forEach((d) => {
    doc.moveDown(0.5);
    doc.fontSize(12).text(`${d.data} — Entrada: ${d.entrada} | Intervalo: ${d.intervalo_inicio} | Retorno: ${d.intervalo_fim} | Saída: ${d.saida}`);
  });

  doc.end();

  return file;
}

module.exports = { gerarPDF };
