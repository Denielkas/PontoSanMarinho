import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./buscarPontos.css";

export default function BuscarPontos() {
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState("");
  const navigate = useNavigate();

  // 👉 aplica máscara ###.###.###-##
  function formatarCPF(valor) {
    return valor
      .replace(/\D/g, "")                 // só números
      .slice(0, 11)                       // máximo 11 dígitos
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function handleCPFChange(e) {
    const valor = e.target.value;
    setCpf(formatarCPF(valor));
  }

  async function buscar() {
  try {
    setErro("");

    const cpfLimpo = cpf.replace(/\D/g, "");

    if (cpfLimpo.length !== 11) {
      setErro("CPF inválido.");
      return;
    }

    navigate("/resultado-pontos", {
      state: { cpf: cpfLimpo },
    });
  } catch (e) {
    setErro("CPF não encontrado.");
  }
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

        {erro && <p className="buscarErro">{erro}</p>}

      </div>
    </div>
  );
}
