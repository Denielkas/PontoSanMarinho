import { useEffect, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { api } from "../../services/api";
import "./CadastrarAtestado.css";

export default function CadastrarAtestado() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionario, setFuncionario] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [arquivo, setArquivo] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalTexto, setModalTexto] = useState("");
  const [modalErro, setModalErro] = useState(false);

  useEffect(() => {
    api
      .get("/funcionarios")
      .then((r) => setFuncionarios(r.data))
      .catch((err) => {
        console.error("Erro ao buscar funcionários", err);
        abrirModal("Erro", "Erro ao buscar funcionários.", true);
      });
  }, []);

  const abrirModal = (titulo, texto, erro = false) => {
    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    setTimeout(() => {
      setModalOpen(false);
    }, 1500);
  };

  const salvar = async () => {
    if (!funcionario || !inicio || !fim || !arquivo) {
      abrirModal("Atenção", "Preencha todos os campos.", true);
      return;
    }

    try {
      const form = new FormData();

      form.append("funcionario_id", funcionario);
      form.append("data_inicio", inicio);
      form.append("data_fim", fim);
      form.append("arquivo", arquivo);

      await api.post("/atestado", form, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      abrirModal("Registrado com sucesso!", "Atestado salvo com sucesso!");

      setFuncionario("");
      setInicio("");
      setFim("");
      setArquivo(null);

      const inputFile = document.getElementById("arquivo-atestado");
      if (inputFile) inputFile.value = "";
    } catch (err) {
      console.error(err);
      abrirModal(
        "Erro",
        err.response?.data?.error || "Erro ao salvar atestado.",
        true
      );
    }
  };

  return (
    <div className="atestado-container">
      <h2 className="atestado-title">Anexar Atestado Médico</h2>

      <div className="atestado-form">
        <label className="atestado-label">Funcionário</label>

        <select
          className="atestado-select"
          value={funcionario}
          onChange={(e) => setFuncionario(e.target.value)}
        >
          <option value="">Selecionar Funcionário</option>

          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>

        <label className="atestado-label">Data Início</label>

        <input
          className="atestado-input"
          type="date"
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />

        <label className="atestado-label">Data Fim</label>

        <input
          className="atestado-input"
          type="date"
          value={fim}
          onChange={(e) => setFim(e.target.value)}
        />

        <label className="atestado-label">Arquivo PDF</label>

        <input
          id="arquivo-atestado"
          className="atestado-file"
          type="file"
          accept="application/pdf"
          onChange={(e) => setArquivo(e.target.files[0] || null)}
        />

        <button className="atestado-btn" onClick={salvar}>
          Salvar Atestado
        </button>
      </div>

      {modalOpen && (
        <div className="modal-ponto">
          <div className={`modal-box ${modalErro ? "modal-box-erro" : ""}`}>
            <FaCheckCircle
              className={`modal-icon ${modalErro ? "modal-icon-erro" : ""}`}
            />
            <h3>{modalTitulo}</h3>
            <p>{modalTexto}</p>
          </div>
        </div>
      )}
    </div>
  );
}
