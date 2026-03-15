import { useEffect, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { api } from "../../services/api";
import "./inserirPontoManual.css";

export default function InserirPontoManual() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcId, setFuncId] = useState("");
  const [tipo, setTipo] = useState("");
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalTexto, setModalTexto] = useState("");
  const [modalErro, setModalErro] = useState(false);

  useEffect(() => {
    api.get("/funcionarios").then((r) => {
      setFuncionarios(r.data);
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

  const enviar = async () => {
    if (!funcId || !tipo || !data || !hora) {
      abrirModal("Atenção", "Preencha todos os campos!", true);
      return;
    }

    const dataFormatada = data.split("-").reverse().join("/");

    const payload = {
      funcionario_id: Number(funcId),
      tipo,
      data: dataFormatada,
      hora,
    };

    try {
      await api.post("/ponto/manual", payload);

      abrirModal("Registrado com sucesso!", "Ponto inserido com sucesso!");

      setTipo("");
      setData("");
      setHora("");
    } catch (err) {
      abrirModal("Erro", "Erro ao inserir ponto.", true);
    }
  };

  return (
    <div className="manual-container">
      <h2>Inserir Ponto Manual</h2>

      <select value={funcId} onChange={(e) => setFuncId(e.target.value)}>
        <option value="">Selecione o funcionário</option>
        {funcionarios.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome} — {f.cpf}
          </option>
        ))}
      </select>

      <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="">Tipo de Batida</option>
        <option value="entrada">Entrada</option>
        <option value="intervalo_inicio">Início do Intervalo</option>
        <option value="intervalo_fim">Retorno do Intervalo</option>
        <option value="saida">Saída</option>
      </select>

      <input
        type="date"
        value={data}
        onChange={(e) => setData(e.target.value)}
      />

      <input
        type="time"
        value={hora}
        onChange={(e) => setHora(e.target.value)}
      />

      <button onClick={enviar}>Salvar Ponto</button>

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
