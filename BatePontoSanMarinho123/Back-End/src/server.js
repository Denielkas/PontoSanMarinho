const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const funcionariosRoutes = require("./routes/funcionarios.routes");
const pontoRoutes = require("./routes/ponto.routes");
const relatorioRoutes = require("./routes/relatorio.routes");
const funcaoRoutes = require("./routes/funcao.routes");
const atestadoRoutes = require("./routes/atestado.routes");
const bancoHorasRoutes = require("./routes/bancoHoras.routes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsPath = process.env.UPLOADS_DIR || path.join(__dirname, "../uploads");
const relatoriosPath = path.join(__dirname, "relatorios");

if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

if (!fs.existsSync(relatoriosPath)) {
  fs.mkdirSync(relatoriosPath, { recursive: true });
}

app.use("/uploads", express.static(uploadsPath));
app.use("/relatorios", express.static(relatoriosPath));

app.use("/api/auth", authRoutes);
app.use("/api/funcionarios", funcionariosRoutes);
app.use("/api/ponto", pontoRoutes);
app.use("/api/relatorio", relatorioRoutes);
app.use("/api/funcoes", funcaoRoutes);
app.use("/api/atestado", atestadoRoutes);
app.use("/api/banco-horas", bancoHorasRoutes);

app.get("/", (_req, res) => {
  res.send("API rodando com sucesso 🚀");
});

app.use((req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  console.error("Erro global:", err);

  if (err.message === "Somente arquivos PDF são permitidos.") {
    return res.status(400).json({
      error: err.message,
    });
  }

  return res.status(500).json({
    error: "Erro interno do servidor",
  });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 API rodando em http://127.0.0.1:${PORT}`);
  console.log(`📂 Uploads: ${uploadsPath}`);
  console.log(`📄 Relatórios: ${relatoriosPath}`);
});