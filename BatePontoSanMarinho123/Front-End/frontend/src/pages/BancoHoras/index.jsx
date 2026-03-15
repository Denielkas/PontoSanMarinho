import { useEffect, useState } from "react";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { api } from "../../services/api";
import "./BancoHoras.css";

export default function BancoHoras() {
  const anoAtual = new Date().getFullYear();
  const anoInicial = 2025;

  const anos = Array.from(
    { length: anoAtual - anoInicial + 1 },
    (_, i) => String(anoAtual - i)
  );

  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioId, setFuncionarioId] = useState("todos");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(anoAtual));
  const [dados, setDados] = useState([]);
  const [editando, setEditando] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalTexto, setModalTexto] = useState("");
  const [modalErro, setModalErro] = useState(false);

  const abrirModal = (titulo, texto, erro = false) => {
    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    setTimeout(() => {
      setModalOpen(false);
    }, 1500);
  };

  useEffect(() => {
    api
      .get("/funcionarios")
      .then((r) => setFuncionarios(r.data))
      .catch((err) => {
        console.error("Erro ao buscar funcionários:", err);
        abrirModal("Erro", "Erro ao buscar funcionários.", true);
      });
  }, []);

  const buscar = async () => {
    if (!mes || !ano) {
      abrirModal("Atenção", "Selecione mês e ano.", true);
      return;
    }

    try {
      const response = await api.get(
        `/banco-horas?mes=${mes}&ano=${ano}&funcionario_id=${funcionarioId}`
      );

      setDados(response.data);

      const inicial = {};
      response.data.forEach((item) => {
        inicial[item.funcionario_id] = {
          ajuste_minutos: item.ajuste_minutos || 0,
          observacao: item.observacao || "",
        };
      });

      setEditando(inicial);
    } catch (err) {
      console.error("Erro ao buscar banco de horas:", err);
      abrirModal("Erro", "Erro ao buscar banco de horas.", true);
    }
  };

  const salvar = async (funcionario_id) => {
    try {
      const item = editando[funcionario_id];

      await api.post("/banco-horas/ajuste", {
        funcionario_id,
        mes,
        ano,
        ajuste_minutos: Number(item?.ajuste_minutos) || 0,
        observacao: item?.observacao || "",
      });

      abrirModal("Registrado com sucesso!", "Ajuste salvo com sucesso.");
      buscar();
    } catch (err) {
      console.error("Erro ao salvar ajuste:", err);
      abrirModal("Erro", "Erro ao salvar ajuste.", true);
    }
  };

  const gerarPdf = async () => {
    if (!mes || !ano) {
      abrirModal("Atenção", "Selecione mês e ano.", true);
      return;
    }

    try {
      const response = await api.get(
        `/banco-horas/pdf?mes=${mes}&ano=${ano}&funcionario_id=${funcionarioId}`
      );

      if (!response.data?.arquivo) {
        abrirModal("Erro", "Não foi possível gerar o PDF.", true);
        return;
      }

      const arquivoUrl = `http://localhost:4000${response.data.arquivo}`;
      window.open(arquivoUrl, "_blank");
    } catch (err) {
      console.error("Erro ao gerar PDF do banco de horas:", err);
      abrirModal("Erro", "Erro ao gerar PDF.", true);
    }
  };

  const alterarCampo = (funcionario_id, campo, valor) => {
    setEditando((prev) => ({
      ...prev,
      [funcionario_id]: {
        ...prev[funcionario_id],
        [campo]: valor,
      },
    }));
  };

  return (
    <div className="bhoras-container">
      <h2 className="bhoras-title">Banco de Horas</h2>

      <div className="bhoras-filtros">
        <select
          className="bhoras-select"
          value={funcionarioId}
          onChange={(e) => setFuncionarioId(e.target.value)}
        >
          <option value="todos">Todos os Funcionários</option>
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
            </option>
          ))}
        </select>

        <select
          className="bhoras-select"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
        >
          <option value="">Mês</option>
          <option value="1">Janeiro</option>
          <option value="2">Fevereiro</option>
          <option value="3">Março</option>
          <option value="4">Abril</option>
          <option value="5">Maio</option>
          <option value="6">Junho</option>
          <option value="7">Julho</option>
          <option value="8">Agosto</option>
          <option value="9">Setembro</option>
          <option value="10">Outubro</option>
          <option value="11">Novembro</option>
          <option value="12">Dezembro</option>
        </select>

        <select
          className="bhoras-select"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
        >
          {anos.map((anoItem) => (
            <option key={anoItem} value={anoItem}>
              {anoItem}
            </option>
          ))}
        </select>

        <button className="bhoras-btn" onClick={buscar}>
          Buscar
        </button>

        <button className="bhoras-btn" onClick={gerarPdf}>
          Gerar PDF
        </button>
      </div>

      <div className="bhoras-table-wrapper">
        <table className="bhoras-table">
          <thead>
            <tr>
              <th>Funcionário</th>
              <th>Horas</th>
              <th>Ajuste (min)</th>
              <th>Observação</th>
              <th>Saldo</th>
              <th>Ação</th>
            </tr>
          </thead>

          <tbody>
            {dados.length > 0 ? (
              dados.map((d) => (
                <tr key={d.funcionario_id}>
                  <td>{d.nome}</td>

                  <td>{d.saldo_sistema_formatado}</td>

                  <td>
                    <input
                      className="bhoras-input"
                      type="number"
                      value={editando[d.funcionario_id]?.ajuste_minutos ?? 0}
                      onChange={(e) =>
                        alterarCampo(
                          d.funcionario_id,
                          "ajuste_minutos",
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      className="bhoras-input"
                      type="text"
                      value={editando[d.funcionario_id]?.observacao ?? ""}
                      onChange={(e) =>
                        alterarCampo(
                          d.funcionario_id,
                          "observacao",
                          e.target.value
                        )
                      }
                      placeholder="Ex: pago / desconto / ajuste"
                    />
                  </td>

                  <td
                    className={
                      d.saldo_final_minutos < 0
                        ? "bhoras-saldo-negativo"
                        : "bhoras-saldo-positivo"
                    }
                  >
                    {d.saldo_final_formatado}
                  </td>

                  <td>
                    <button
                      className="bhoras-btn bhoras-btn-salvar"
                      onClick={() => salvar(d.funcionario_id)}
                    >
                      Salvar
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="bhoras-sem-dados">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       {modalOpen && (
      <div className="modal-ponto">
        <div className={`modal-box ${modalErro ? "modal-box-erro" : ""}`}>
          {modalErro ? (
            <FaTimesCircle className="modal-icon-erro" />
          ) : (
            <FaCheckCircle className="modal-icon" />
          )}
    
          <h3>{modalTitulo}</h3>
          <p>{modalTexto}</p>
        </div>
      </div>
    )}
    </div>
  );
}