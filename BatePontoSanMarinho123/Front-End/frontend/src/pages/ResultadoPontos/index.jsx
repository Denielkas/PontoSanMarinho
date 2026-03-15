import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "./resultadoPontos.css";

export default function ResultadoPontos() {
  const { state } = useLocation();
  const navigate = useNavigate();

  const [funcionario, setFuncionario] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregar() {
      try {
        if (!state?.cpf) {
          setErro("Nenhum dado encontrado.");
          setLoading(false);
          return;
        }

        const res = await axios.get(
          `http://localhost:4000/api/ponto/pontos/cpf/${state.cpf}`
        );

        setFuncionario(res.data?.funcionario || null);
        setPontos(Array.isArray(res.data?.pontos) ? res.data.pontos : []);
      } catch (e) {
        setErro("Nenhum dado encontrado.");
      } finally {
        setLoading(false);
      }
    }

    carregar();
  }, [state]);

  function novaLinha() {
    return {
      entrada: "--:--",
      intervalo: "--:--",
      retorno: "--:--",
      saida: "--:--",
    };
  }

  function linhaTemDados(linha) {
    return (
      linha.entrada !== "--:--" ||
      linha.intervalo !== "--:--" ||
      linha.retorno !== "--:--" ||
      linha.saida !== "--:--"
    );
  }

  function horaParaMinutos(hora) {
    if (!hora || hora === "--:--") return null;
    const [h, m] = String(hora).slice(0, 5).split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }

  function escolherMaisProximo(lista, regraHora) {
    if (!Array.isArray(lista) || !lista.length || !regraHora) return null;

    const regraMin = horaParaMinutos(regraHora);
    if (regraMin == null) return null;

    let melhor = null;
    let menorDiff = Infinity;

    for (const item of lista) {
      const itemMin = horaParaMinutos(item.hora);
      if (itemMin == null) continue;

      const diff = Math.abs(itemMin - regraMin);
      if (diff < menorDiff) {
        menorDiff = diff;
        melhor = item;
      }
    }

    return melhor;
  }

  function removerPorId(lista, id) {
    const idx = lista.findIndex((item) => item.id === id);
    if (idx >= 0) lista.splice(idx, 1);
  }

  function agruparBatidas(lista, regras) {
    const entradas = [];
    const intervalosInicio = [];
    const intervalosFim = [];
    const saidas = [];
    const autos = [];

    for (const p of lista) {
      const tipo = String(p.tipo || "").toLowerCase();

      if (tipo === "entrada") entradas.push(p);
      else if (tipo === "intervalo_inicio") intervalosInicio.push(p);
      else if (tipo === "intervalo_fim") intervalosFim.push(p);
      else if (tipo === "saida") saidas.push(p);
      else if (tipo === "auto") autos.push(p);
    }

    const linhaPrincipal = novaLinha();

    // Entrada principal
    if (entradas.length > 0) {
      linhaPrincipal.entrada = entradas.shift().hora || "--:--";
    } else if (autos.length > 0) {
      linhaPrincipal.entrada = autos.shift().hora || "--:--";
    }

    // Intervalo principal = mais próximo da regra do banco
    let principalInicio = escolherMaisProximo(intervalosInicio, regras?.intervalo_inicio);
    if (!principalInicio && intervalosInicio.length > 0) {
      principalInicio = intervalosInicio[0];
    }
    if (principalInicio) {
      linhaPrincipal.intervalo = principalInicio.hora || "--:--";
      removerPorId(intervalosInicio, principalInicio.id);
    } else if (autos.length > 0) {
      linhaPrincipal.intervalo = autos.shift().hora || "--:--";
    }

    // Retorno principal = mais próximo da regra do banco
    let principalFim = escolherMaisProximo(intervalosFim, regras?.intervalo_fim);
    if (!principalFim && intervalosFim.length > 0) {
      principalFim = intervalosFim[0];
    }
    if (principalFim) {
      linhaPrincipal.retorno = principalFim.hora || "--:--";
      removerPorId(intervalosFim, principalFim.id);
    } else if (autos.length > 0) {
      linhaPrincipal.retorno = autos.shift().hora || "--:--";
    }

    // Saída principal
    if (saidas.length > 0) {
      linhaPrincipal.saida = saidas.shift().hora || "--:--";
    } else if (autos.length > 0) {
      linhaPrincipal.saida = autos.shift().hora || "--:--";
    }

    const linhasExtras = [];

    // Extras de intervalo
    while (intervalosInicio.length > 0 || intervalosFim.length > 0) {
      const linha = novaLinha();

      if (intervalosInicio.length > 0) {
        linha.intervalo = intervalosInicio.shift().hora || "--:--";
      }

      if (intervalosFim.length > 0) {
        linha.retorno = intervalosFim.shift().hora || "--:--";
      }

      if (linhaTemDados(linha)) {
        linhasExtras.push(linha);
      }
    }

    // Extras de entrada/saída
    while (entradas.length > 0 || saidas.length > 0) {
      const linha = novaLinha();

      if (entradas.length > 0) {
        linha.entrada = entradas.shift().hora || "--:--";
      }

      if (saidas.length > 0) {
        linha.saida = saidas.shift().hora || "--:--";
      }

      if (linhaTemDados(linha)) {
        linhasExtras.push(linha);
      }
    }

    // Extras auto
    while (autos.length > 0) {
      const linha = novaLinha();

      if (autos.length > 0) {
        linha.entrada = autos.shift().hora || "--:--";
      }

      if (autos.length > 0) {
        linha.saida = autos.shift().hora || "--:--";
      }

      if (linhaTemDados(linha)) {
        linhasExtras.push(linha);
      }
    }

    const linhas = [];
    if (linhaTemDados(linhaPrincipal)) {
      linhas.push(linhaPrincipal);
    }
    linhas.push(...linhasExtras);

    return linhas;
  }

  const linhas = agruparBatidas(Array.isArray(pontos) ? pontos : [], funcionario);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  if (loading) {
    return (
      <div className="resultadoContainer">
        <div className="resultadoCard">
          <p className="semDados">Carregando...</p>
        </div>
      </div>
    );
  }

  if (erro || !funcionario) {
    return (
      <div className="resultadoContainer">
        <div className="resultadoCard">
          <p className="semDados">{erro || "Nenhum dado encontrado."}</p>
          <div className="resultadoActions">
            <button className="btnVoltar" onClick={() => navigate(-1)}>
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resultadoContainer">
      <div className="resultadoCard">
        <h2>Resumo de Hoje</h2>

        <div className="resultadoInfo">
          <span>
            <strong>Colaborador:</strong> {funcionario.nome}
          </span>
          <span>
            <strong>CPF:</strong> {funcionario.cpf}
          </span>
          <span>
            <strong>Data:</strong> {dataHoje}
          </span>
        </div>

        <div className="tableResponsive">
          <table className="resultadoTable">
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th>Entrada</th>
                <th>Intervalo</th>
                <th>Retorno</th>
                <th>Saída</th>
              </tr>
            </thead>

            <tbody>
              {linhas.length > 0 ? (
                linhas.map((linha, index) => (
                  <tr key={index}>
                    <td>{dataHoje}</td>
                    <td>{funcionario.nome}</td>
                    <td>{linha.entrada}</td>
                    <td>{linha.intervalo}</td>
                    <td>{linha.retorno}</td>
                    <td>{linha.saida}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="semDados">
                    Nenhuma batida encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="resultadoActions">
          <button className="btnVoltar" onClick={() => navigate(-1)}>
            Nova Consulta
          </button>

          <button className="btnInicio" onClick={() => navigate("/")}>
            Voltar ao Início
          </button>
        </div>
      </div>
    </div>
  );
}
