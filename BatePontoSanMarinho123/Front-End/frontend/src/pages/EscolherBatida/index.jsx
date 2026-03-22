import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../../services/api";
import {
  FaSignInAlt,
  FaCoffee,
  FaUndoAlt,
  FaSignOutAlt,
  FaCheckCircle,
} from "react-icons/fa";
import "./EscolherBatida.css";
import { useEffect, useState } from "react";

export default function EscolherBatida() {
  const navigate = useNavigate();
  const location = useLocation();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTexto, setModalTexto] = useState("");
  const [modalTitulo, setModalTitulo] = useState("Registrado com sucesso!");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [permissoes, setPermissoes] = useState({
    entrada: false,
    intervalo_inicio: false,
    intervalo_fim: false,
    saida: false,
  });

  const { funcionario } = location.state || {};

  useEffect(() => {
    async function carregarStatus() {
      try {
        if (!funcionario?.id) {
          setLoadingStatus(false);
          return;
        }

        const { data } = await api.get(
          `/ponto/status-batidas/${funcionario.id}`
        );

        setPermissoes(
          data?.permissoes || {
            entrada: false,
            intervalo_inicio: false,
            intervalo_fim: false,
            saida: false,
          }
        );
      } catch (err) {
        console.error("Erro ao carregar status das batidas:", err);
        setPermissoes({
          entrada: false,
          intervalo_inicio: false,
          intervalo_fim: false,
          saida: false,
        });
      } finally {
        setLoadingStatus(false);
      }
    }

    carregarStatus();
  }, [funcionario]);

  if (!funcionario) {
    return <h2>Erro: Funcionário não encontrado.</h2>;
  }

  const baterPonto = async (tipo) => {
    if (!permissoes[tipo]) return;

    const nomes = {
      entrada: "Entrada",
      intervalo_inicio: "Intervalo",
      intervalo_fim: "Retorno",
      saida: "Saída",
    };

    try {
      await api.post("/ponto/bater", {
        funcionario_id: funcionario.id,
        tipo,
      });

      setModalTitulo("Registrado com sucesso!");
      setModalTexto(nomes[tipo]);
      setModalOpen(true);

      setTimeout(() => {
        setModalOpen(false);
        navigate("/");
      }, 1000);
    } catch (err) {
      console.error("Erro ao bater ponto:", err);

      setModalTitulo("Atenção");
      setModalTexto(err.response?.data?.error || "Erro ao bater ponto");
      setModalOpen(true);

      setTimeout(() => {
        setModalOpen(false);
      }, 1500);
    }
  };

  return (
    <div className="batida">
      <div className="batida-container">
        <h2>Olá, {funcionario.nome}!</h2>
        <p>Escolha o tipo da batida:</p>

        <div className="botoes">
          <button
            onClick={() => baterPonto("entrada")}
            className={`btn entrada ${!permissoes.entrada ? "disabled" : ""}`}
            disabled={!permissoes.entrada || loadingStatus}
          >
            <FaSignInAlt className="icon" />
            Entrada
          </button>

          <button
            onClick={() => baterPonto("intervalo_inicio")}
            className={`btn intervalo ${
              !permissoes.intervalo_inicio ? "disabled" : ""
            }`}
            disabled={!permissoes.intervalo_inicio || loadingStatus}
          >
            <FaCoffee className="icon" />
            Intervalo
          </button>

          <button
            onClick={() => baterPonto("intervalo_fim")}
            className={`btn retorno ${
              !permissoes.intervalo_fim ? "disabled" : ""
            }`}
            disabled={!permissoes.intervalo_fim || loadingStatus}
          >
            <FaUndoAlt className="icon" />
            Retorno
          </button>

          <button
            onClick={() => baterPonto("saida")}
            className={`btn saida ${!permissoes.saida ? "disabled" : ""}`}
            disabled={!permissoes.saida || loadingStatus}
          >
            <FaSignOutAlt className="icon" />
            Saída
          </button>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-ponto">
          <div className="modal-box">
            <FaCheckCircle className="modal-icon" />
            <h3>{modalTitulo}</h3>
            <p>{modalTexto}</p>
          </div>
        </div>
      )}
    </div>
  );
}