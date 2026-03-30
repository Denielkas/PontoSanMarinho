import { useEffect, useState } from "react";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { api } from "../../services/api";
import "./RelatorioFuncionario.css";

export default function RelatorioFuncionario() {
  const anoAtual = new Date().getFullYear();
  const anoInicial = 2025;

  const anos = Array.from(
    { length: anoAtual - anoInicial + 1 },
    (_, i) => String(anoAtual - i)
  );

  const [funcionarios, setFuncionarios] = useState([]);
  const [funcId, setFuncId] = useState("todos");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState(String(anoAtual));

  const [dados, setDados] = useState([]);
  const [somaAtraso, setSomaAtraso] = useState("0h 0m");

  const [editOpen, setEditOpen] = useState(false);
  const [modalAtestado, setModalAtestado] = useState(false);
  const [arquivoAtestado, setArquivoAtestado] = useState("");

  const [editData, setEditData] = useState({
    funcionario_id: "",
    ids_originais: {},
    data: "",
    entrada: "",
    intervalo_inicio: "",
    intervalo_fim: "",
    saida: "",
    falta: false,
    folga: false,
    ferias: false,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalTexto, setModalTexto] = useState("");
  const [modalErro, setModalErro] = useState(false);

  const [salvando, setSalvando] = useState(false);
  const [limpandoBatidas, setLimpandoBatidas] = useState(false);

  const abrirModal = (titulo, texto, erro = false) => {
    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    setTimeout(() => {
      setModalOpen(false);
    }, 1800);
  };

  useEffect(() => {
    carregarFuncionarios();
  }, []);

  async function carregarFuncionarios() {
    try {
      const response = await api.get("/funcionarios");
      setFuncionarios(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Erro ao carregar funcionários:", err);
      abrirModal("Erro", "Erro ao carregar funcionários.", true);
    }
  }

  function calcularSaldoTexto(resultado) {
    const totalMinutos = resultado.reduce((acc, r) => {
      if (r.folga || r.ferias || r.atestado) return acc;

      const saldo = Number(r.saldo_bruto) || 0;

      if (saldo > 0 && saldo <= 15) return acc;

      return acc + saldo;
    }, 0);

    const sinal = totalMinutos < 0 ? "-" : "+";
    const absMin = Math.abs(totalMinutos);

    return `${sinal}${Math.floor(absMin / 60)}h ${absMin % 60}m`;
  }

  async function buscar() {
    if (!funcId || !mes || !ano) {
      abrirModal("Atenção", "Selecione funcionário, mês e ano.", true);
      return;
    }

    try {
      let response;

      if (funcId === "todos") {
        response = await api.get(`/relatorio/todos?mes=${mes}&ano=${ano}`);
      } else {
        response = await api.get(`/relatorio/${funcId}?mes=${mes}&ano=${ano}`);
      }

      let resultado = Array.isArray(response.data) ? response.data : [];

      if (dia !== "") {
        resultado = resultado.filter(
          (r) => r.data && Number(r.data.split("/")[0]) === Number(dia)
        );
      }

      setDados(resultado);
      setSomaAtraso(calcularSaldoTexto(resultado));
    } catch (err) {
      console.error("Erro ao buscar relatório:", err);
      abrirModal("Erro", "Erro ao buscar relatório.", true);
    }
  }

  async function gerarPdf() {
    if (!funcId || !mes || !ano) {
      abrirModal("Atenção", "Selecione funcionário, mês e ano.", true);
      return;
    }

    try {
      let rota = "";

      if (funcId === "todos") {
        rota = `/relatorio/pdf/todos?mes=${mes}&ano=${ano}`;
      } else {
        rota = `/relatorio/pdf/${funcId}?mes=${mes}&ano=${ano}`;
      }

      const response = await api.get(rota, {
        responseType: "blob",
      });

      if (response.data?.type && !response.data.type.includes("pdf")) {
        const texto = await response.data.text();
        console.error("Resposta inválida no PDF:", texto);
        abrirModal("Erro", "A API não retornou um PDF válido.", true);
        return;
      }

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      abrirModal("Erro", "Erro ao gerar PDF.", true);
    }
  }

  async function gerarExcel() {
    if (!funcId || !mes || !ano) {
      abrirModal("Atenção", "Selecione funcionário, mês e ano.", true);
      return;
    }

    try {
      let rota = "";

      if (funcId === "todos") {
        rota = `/relatorio/excel/todos?mes=${mes}&ano=${ano}`;
      } else {
        rota = `/relatorio/excel/${funcId}?mes=${mes}&ano=${ano}`;
      }

      const response = await api.get(rota, {
        responseType: "blob",
      });

      if (
        response.data?.type &&
        !response.data.type.includes(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ) {
        const texto = await response.data.text();
        console.error("Resposta inválida no Excel:", texto);
        abrirModal("Erro", "A API não retornou um Excel válido.", true);
        return;
      }

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        funcId === "todos"
          ? `relatorio_todos_${mes}_${ano}.xlsx`
          : `relatorio_${funcId}_${mes}_${ano}.xlsx`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Erro ao gerar Excel:", err);
      abrirModal("Erro", "Erro ao gerar Excel.", true);
    }
  }

  async function lancarHorarioPadraoMes() {
    if (!funcId || funcId === "todos" || !mes || !ano) {
      abrirModal(
        "Atenção",
        "Selecione 1 funcionário, mês e ano para lançar o horário padrão.",
        true
      );
      return;
    }

    const funcionarioSelecionado = funcionarios.find(
      (f) => String(f.id) === String(funcId)
    );

    const nomeFuncionario = funcionarioSelecionado?.nome || "funcionário";

    const confirmado = window.confirm(
      `Deseja lançar o horário padrão salvo no banco de dados para TODOS os dias de ${mes}/${ano} do funcionário ${nomeFuncionario}?\n\nDias que já possuem pontos, atestado, falta, folga ou férias serão ignorados.`
    );

    if (!confirmado) return;

    try {
      const response = await api.post("/ponto/lancar-padrao-mes", {
        funcionario_id: funcId,
        mes,
        ano,
      });

      abrirModal(
        "Sucesso",
        `Horário padrão lançado. Inseridos: ${
          response.data?.dias_inseridos || 0
        } dia(s). Ignorados: ${response.data?.dias_ignorados || 0} dia(s).`
      );

      buscar();
    } catch (err) {
      console.error("Erro ao lançar horário padrão:", err);
      abrirModal(
        "Erro",
        err?.response?.data?.error || "Erro ao lançar horário padrão.",
        true
      );
    }
  }

  function abrirEdicao(linha) {
    if (funcId === "todos") {
      abrirModal("Atenção", "Para editar, selecione apenas 1 funcionário.", true);
      return;
    }

    setEditData({
      funcionario_id: linha.funcionario_id,
      ids_originais: linha.ids_originais || {},
      data: linha.data,
      entrada: linha.entrada !== "--:--" ? linha.entrada : "",
      intervalo_inicio:
        linha.intervalo_inicio !== "--:--" ? linha.intervalo_inicio : "",
      intervalo_fim: linha.intervalo_fim !== "--:--" ? linha.intervalo_fim : "",
      saida: linha.saida !== "--:--" ? linha.saida : "",
      falta: !!linha.falta,
      folga: !!linha.folga,
      ferias: !!linha.ferias,
    });

    setEditOpen(true);
  }

  async function salvarAlteracao() {
    try {
      setSalvando(true);

      const bloqueado = editData.falta || editData.folga || editData.ferias;

      await api.put("/ponto/ajustar", {
        funcionario_id: funcId,
        data: editData.data,
        ids_originais: editData.ids_originais,
        entrada: bloqueado ? "" : editData.entrada,
        intervalo: bloqueado ? "" : editData.intervalo_inicio,
        retorno: bloqueado ? "" : editData.intervalo_fim,
        saida: bloqueado ? "" : editData.saida,
        falta: editData.falta,
        folga: editData.folga,
        ferias: editData.ferias,
      });

      setEditOpen(false);
      abrirModal("Registrado com sucesso!", "Horários atualizados com sucesso!");
      buscar();
    } catch (err) {
      console.error("Erro ao salvar alteração:", err);
      abrirModal("Erro", "Erro ao salvar alteração.", true);
    } finally {
      setSalvando(false);
    }
  }

  async function limparBatidasDoDia() {
    if (!editData.funcionario_id || !editData.data) {
      abrirModal("Erro", "Funcionário ou data inválidos.", true);
      return;
    }

    const confirmar = window.confirm(
      `Deseja realmente apagar TODAS as batidas do dia ${editData.data}?\n\nEssa ação não pode ser desfeita.`
    );

    if (!confirmar) return;

    try {
      setLimpandoBatidas(true);

      await api.delete("/ponto/limpar-dia", {
        data: {
          funcionario_id: editData.funcionario_id,
          data: editData.data,
        },
      });

      setEditOpen(false);
      abrirModal("Sucesso", "Batidas do dia removidas com sucesso!");
      buscar();
    } catch (err) {
      console.error("Erro ao limpar batidas do dia:", err);
      abrirModal(
        "Erro",
        err?.response?.data?.error || "Erro ao limpar batidas do dia.",
        true
      );
    } finally {
      setLimpandoBatidas(false);
    }
  }

  async function removerAtestado(linha) {
    if (funcId === "todos") {
      abrirModal("Atenção", "Para remover, selecione apenas 1 funcionário.", true);
      return;
    }

    const confirmar = window.confirm(
      `Deseja remover o atestado do dia ${linha.data}?`
    );

    if (!confirmar) return;

    try {
      await api.delete("/atestado", {
        data: {
          funcionario_id: linha.funcionario_id,
          data: linha.data,
        },
      });

      abrirModal("Sucesso", "Atestado removido com sucesso!");
      buscar();
    } catch (err) {
      console.error("Erro ao remover atestado:", err);
      abrirModal("Erro", "Erro ao remover atestado.", true);
    }
  }

  async function abrirAtestado(arquivo) {
    if (!arquivo) {
      abrirModal("Erro", "Arquivo do atestado não encontrado.", true);
      return;
    }

    try {
      const response = await api.get(
        `/atestado/arquivo/${encodeURIComponent(arquivo)}`,
        {
          responseType: "blob",
        }
      );

      if (!response.data || response.data.size === 0) {
        abrirModal("Erro", "PDF do atestado vazio ou inválido.", true);
        return;
      }

      if (response.data.type && !response.data.type.includes("pdf")) {
        const texto = await response.data.text();
        console.error("Resposta inválida ao abrir atestado:", texto);
        abrirModal("Erro", "A API não retornou um PDF válido.", true);
        return;
      }

      if (arquivoAtestado && arquivoAtestado.startsWith("blob:")) {
        window.URL.revokeObjectURL(arquivoAtestado);
      }

      const blobUrl = window.URL.createObjectURL(
        new Blob([response.data], { type: "application/pdf" })
      );

      setArquivoAtestado(blobUrl);
      setModalAtestado(true);
    } catch (err) {
      console.error("Erro ao abrir atestado:", err);
      abrirModal(
        "Erro",
        err?.response?.data?.error || "Erro ao abrir atestado.",
        true
      );
    }
  }

  function fecharModalAtestado() {
    if (arquivoAtestado && arquivoAtestado.startsWith("blob:")) {
      window.URL.revokeObjectURL(arquivoAtestado);
    }

    setArquivoAtestado("");
    setModalAtestado(false);
  }

  return (
    <div className="relatorio-container">
      <h2 className="relatorio-titulo">Relatório de Frequência</h2>

      <div className="relatorio-filtros">
        <select
          className="relatorio-select"
          value={funcId}
          onChange={(e) => setFuncId(e.target.value)}
        >
          <option value="todos">Todos os Funcionários</option>
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome} — {f.cpf}
            </option>
          ))}
        </select>

        <select
          className="relatorio-select"
          value={dia}
          onChange={(e) => setDia(e.target.value)}
        >
          <option value="">Dia (Opcional)</option>
          {Array.from({ length: 31 }).map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>

        <select
          className="relatorio-select"
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
          className="relatorio-select"
          value={ano}
          onChange={(e) => setAno(e.target.value)}
        >
          {anos.map((anoItem) => (
            <option key={anoItem} value={anoItem}>
              {anoItem}
            </option>
          ))}
        </select>

        <button className="relatorio-btn btn-buscar" onClick={buscar}>
          Buscar Dados
        </button>

        <button className="relatorio-btn btn-pdf" onClick={gerarPdf}>
          Gerar PDF
        </button>

        <button className="relatorio-btn btn-excel" onClick={gerarExcel}>
          Gerar Excel
        </button>

        <button
          className="relatorio-btn btn-padrao"
          onClick={lancarHorarioPadraoMes}
        >
          Lançar Horário Padrão no Mês
        </button>
      </div>

      {dados.length > 0 && (
        <div
          className="resumo-total"
          style={{
            borderLeft: `10px solid ${
              somaAtraso.startsWith("-") ? "#e74c3c" : "#2ecc71"
            }`,
          }}
        >
          <span>Saldo Acumulado no Período:</span>
          <strong
            style={{
              color: somaAtraso.startsWith("-") ? "#e74c3c" : "#27ae60",
            }}
          >
            {somaAtraso}
          </strong>
        </div>
      )}

      <div className="table-responsive">
        <table className="relatorio-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Nome</th>
              <th>Entrada</th>
              <th>Intervalo</th>
              <th>Retorno</th>
              <th>Saída</th>
              <th>Total</th>
              <th>Saldo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {dados.map((d, i) => (
              <tr
                key={`${d.funcionario_id}-${d.data}-${i}`}
                className={`${d.atestado ? "linha-atestado" : ""} ${
                  d.falta ? "linha-falta" : ""
                } ${d.folga ? "linha-folga" : ""} ${
                  d.ferias ? "linha-ferias" : ""
                }`}
              >
                <td>
                  <strong>{d.data}</strong>
                </td>
                <td>{d.nome}</td>
                <td>{d.entrada}</td>
                <td>{d.intervalo_inicio}</td>
                <td>{d.intervalo_fim}</td>
                <td>{d.saida}</td>
                <td>{d.total_horas}</td>

                <td
                  style={{
                    fontWeight: "bold",
                    color: d.atestado
                      ? "#f59e0b"
                      : d.folga
                      ? "#3b82f6"
                      : d.ferias
                      ? "#8b5cf6"
                      : d.saldo_bruto < 0
                      ? "#e74c3c"
                      : "#27ae60",
                  }}
                >
                  {d.folga || d.ferias || d.atestado
                    ? "+0h 0m"
                    : `${d.saldo_bruto < 0 ? "-" : "+"}${Math.floor(
                        Math.abs(d.saldo_bruto) / 60
                      )}h ${Math.abs(d.saldo_bruto) % 60}m`}
                </td>

                <td>
                  {d.falta ? (
                    <span className="badge-falta-sim">Falta</span>
                  ) : d.folga ? (
                    <span className="badge-folga">Folga</span>
                  ) : d.ferias ? (
                    <span className="badge-ferias">Férias</span>
                  ) : d.atestado ? (
                    <span className="badge-atestado">Atestado</span>
                  ) : (
                    <span className="badge-falta-nao">Normal</span>
                  )}
                </td>

                <td className="acoes-cell">
                  {funcId !== "todos" && (
                    <button
                      className="btn-edit"
                      onClick={() => abrirEdicao(d)}
                      title="Editar"
                    >
                      ⚙️
                    </button>
                  )}

                  {d.atestado && (
                    <>
                      <button
                        className="btn-atestado"
                        onClick={() => abrirAtestado(d.arquivo_atestado)}
                        title="Ver atestado"
                      >
                        📎
                      </button>

                      <button
                        className="btn-remover-atestado"
                        onClick={() => removerAtestado(d)}
                        title="Remover atestado"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAtestado && (
        <div className="modalOverlay">
          <div className="modalPdf">
            <button className="btnFecharPdf" onClick={fecharModalAtestado}>
              ✖
            </button>

            <iframe
              src={arquivoAtestado}
              title="Atestado"
              className="pdfViewer"
            />
          </div>
        </div>
      )}

      {editOpen && (
        <div className="modalOverlay">
          <div className="modalCard">
            <h3>Ajustar Turno — {editData.data}</h3>

            <div className="falta-toggle-box">
              <div className="falta-toggle-info">
                <span className="falta-label">Falta</span>
                <small>
                  Se marcar <strong>Sim</strong>, o saldo do dia ficará negativo
                  conforme a carga horária prevista.
                </small>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={editData.falta}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      falta: e.target.checked,
                      folga: e.target.checked ? false : editData.folga,
                      ferias: e.target.checked ? false : editData.ferias,
                    })
                  }
                />
                <span className="slider"></span>
              </label>

              <span
                className={editData.falta ? "switch-status sim" : "switch-status nao"}
              >
                {editData.falta ? "Sim" : "Não"}
              </span>
            </div>

            <div className="falta-toggle-box folga-box">
              <div className="falta-toggle-info">
                <span className="falta-label">Folga</span>
                <small>
                  Se marcar <strong>Sim</strong>, o dia ficará como{" "}
                  <strong>folga</strong>, com <strong>saldo zerado</strong> e
                  destaque em azul.
                </small>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={editData.folga}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      folga: e.target.checked,
                      falta: e.target.checked ? false : editData.falta,
                      ferias: e.target.checked ? false : editData.ferias,
                    })
                  }
                />
                <span className="slider slider-folga"></span>
              </label>

              <span
                className={editData.folga ? "switch-status folga" : "switch-status nao"}
              >
                {editData.folga ? "Sim" : "Não"}
              </span>
            </div>

            <div className="falta-toggle-box ferias-box">
              <div className="falta-toggle-info">
                <span className="falta-label">Férias</span>
                <small>
                  Se marcar <strong>Sim</strong>, o dia ficará como{" "}
                  <strong>férias</strong>, com <strong>saldo zerado</strong> e
                  destaque em roxo.
                </small>
              </div>

              <label className="switch">
                <input
                  type="checkbox"
                  checked={editData.ferias}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      ferias: e.target.checked,
                      falta: e.target.checked ? false : editData.falta,
                      folga: e.target.checked ? false : editData.folga,
                    })
                  }
                />
                <span className="slider slider-ferias"></span>
              </label>

              <span
                className={editData.ferias ? "switch-status ferias" : "switch-status nao"}
              >
                {editData.ferias ? "Sim" : "Não"}
              </span>
            </div>

            <div
              className={`modalGrid ${
                editData.falta || editData.folga || editData.ferias
                  ? "campos-desabilitados"
                  : ""
              }`}
            >
              <label>
                Entrada:
                <input
                  type="time"
                  value={editData.entrada}
                  disabled={editData.falta || editData.folga || editData.ferias}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      entrada: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Início Intervalo:
                <input
                  type="time"
                  value={editData.intervalo_inicio}
                  disabled={editData.falta || editData.folga || editData.ferias}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      intervalo_inicio: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Retorno Intervalo:
                <input
                  type="time"
                  value={editData.intervalo_fim}
                  disabled={editData.falta || editData.folga || editData.ferias}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      intervalo_fim: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Saída Final:
                <input
                  type="time"
                  value={editData.saida}
                  disabled={editData.falta || editData.folga || editData.ferias}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      saida: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="modalActions">
              <button
                className="btn-limpar-batidas"
                onClick={limparBatidasDoDia}
                disabled={limpandoBatidas || salvando}
              >
                {limpandoBatidas ? "Limpando..." : "Limpar Batidas do Dia"}
              </button>

              <button className="btn-cancel" onClick={() => setEditOpen(false)}>
                Cancelar
              </button>

              <button
                className="btn-save"
                onClick={salvarAlteracao}
                disabled={salvando || limpandoBatidas}
              >
                {salvando ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

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