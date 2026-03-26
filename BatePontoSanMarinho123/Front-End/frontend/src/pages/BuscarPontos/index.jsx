import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./buscarPontos.css";

export default function BuscarPontos() {
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState("");
  const navigate = useNavigate();

  function formatarCPF(valor) {
    return valor
      .replace(/\D/g, "")
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function handleCPFChange(e) {
    setCpf(formatarCPF(e.target.value));
  }

  function buscar() {
    setErro("");

    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      setErro("CPF inválido.");
      return;
    }

    navigate("/resultado-pontos", {
      state: { cpf: cpfLimpo },
    });
  }

  return (
    <div className="buscarContainer">
      <div className="buscarCard">
        <h2>Consultar pontos</h2>

        <input
          placeholder="Digite o CPF"
          value={cpf}
          onChange={handleCPFChange}
          inputMode="numeric"
        />

        <button onClick={buscar}>Buscar</button>

        <button
          style={{
            marginTop: "10px",
            background: "#6c757d",
          }}
          onClick={() => navigate("/")}
        >
          Voltar
        </button>

        {erro && <p className="buscarErro">{erro}</p>}
      </div>
    </div>
  );
}