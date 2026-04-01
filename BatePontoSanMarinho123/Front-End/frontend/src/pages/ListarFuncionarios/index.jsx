import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import "./listar.css";

const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");

const formatCPF = (v = "") => {
  const s = onlyDigits(v);
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3, 6)}`;
  if (s.length <= 9) {
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}`;
  }
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
};

function montarUrlAbsoluta(url = "") {
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${window.location.origin}${url}`;
  }

  return `${window.location.origin}/${url}`;
}

export default function ListarFuncionarios() {
  const navigate = useNavigate();

  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState("");
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [funcoes, setFuncoes] = useState([]);
  const [saving, setSaving] = useState(false);

  const [imagemModalOpen, setImagemModalOpen] = useState(false);
  const [imagemModalUrl, setImagemModalUrl] = useState("");
  const [imagemModalNome, setImagemModalNome] = useState("");
  const [imagemCarregando, setImagemCarregando] = useState(false);
  const [erroImagem, setErroImagem] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    chegada: "",
    intervalo_inicio: "",
    intervalo_fim: "",
    saida: "",
    funcao_id: "",
    funcao_nome: "",
  });

  const listaFiltrada = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) return lista;

    return lista.filter((f) => {
      const nome = String(f.nome || "").toLowerCase();
      return nome.includes(termo);
    });
  }, [lista, busca]);

  const total = useMemo(() => listaFiltrada.length, [listaFiltrada]);

  const carregar = async () => {
    setMsg("Carregando...");
    try {
      const { data } = await api.get("/funcionarios");
      setLista([...data].sort((a, b) => Number(a.id) - Number(b.id)));
      setMsg("");
    } catch (err) {
      setMsg(err.response?.data?.error || "Erro ao carregar funcionários.");
    }
  };

  const carregarFuncoes = async () => {
    try {
      const { data } = await api.get("/funcoes");
      setFuncoes(data);
    } catch (err) {
      console.error("Erro ao carregar funções:", err);
    }
  };

  useEffect(() => {
    carregar();
    carregarFuncoes();
  }, []);

  const abrirModal = (f) => {
    setEditing(f);

    setForm({
      nome: f.nome || "",
      cpf: formatCPF(f.cpf || ""),
      chegada: (f.chegada || "").slice(0, 5),
      intervalo_inicio: (f.intervalo_inicio || "").slice(0, 5),
      intervalo_fim: (f.intervalo_fim || "").slice(0, 5),
      saida: (f.saida || "").slice(0, 5),
      funcao_id: f.funcao_id ? String(f.funcao_id) : "",
      funcao_nome: "",
    });

    setOpen(true);
  };

  const fecharModal = () => {
    setOpen(false);
    setEditing(null);
  };

  const fecharModalImagem = () => {
    setImagemModalOpen(false);
    setImagemModalUrl("");
    setImagemModalNome("");
    setImagemCarregando(false);
    setErroImagem(false);
  };

  const onChange = (e) => {
    const { name, value } = e.target;

    setForm((old) => ({
      ...old,
      [name]: name === "cpf" ? formatCPF(value) : value,
      ...(name === "funcao_id" && value !== "outro" ? { funcao_nome: "" } : {}),
    }));
  };

  const salvarAlteracoes = async () => {
    if (!editing) return;

    setSaving(true);

    try {
      const payload = {
        nome: form.nome,
        cpf: onlyDigits(form.cpf),
        chegada: form.chegada,
        intervalo_inicio: form.intervalo_inicio,
        intervalo_fim: form.intervalo_fim,
        saida: form.saida,
        funcao_id:
          form.funcao_id === "outro" || !form.funcao_id
            ? null
            : Number(form.funcao_id),
        funcao_nome: form.funcao_id === "outro" ? form.funcao_nome : null,
      };

      await api.put(`/funcionarios/${editing.id}`, payload);

      await carregarFuncoes();
      await carregar();
      fecharModal();
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao atualizar funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const verImagem = async (funcionarioId, nome) => {
    try {
      setImagemCarregando(true);
      setErroImagem(false);

      const { data } = await api.get(`/funcionarios/${funcionarioId}/imagem`);

      if (!data?.imagem_url) {
        alert("Este funcionário não possui imagem salva.");
        return;
      }

      const urlFinal = montarUrlAbsoluta(data.imagem_url);

      console.log("URL FINAL DA IMAGEM:", urlFinal);

      setImagemModalUrl(urlFinal);
      setImagemModalNome(nome || "Imagem do rosto");
      setImagemModalOpen(true);
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao abrir imagem.");
    } finally {
      setImagemCarregando(false);
    }
  };

  const excluirRosto = async (funcionarioId, nome) => {
    const confirmou = window.confirm(
      `Deseja realmente excluir o cadastro facial de ${nome}?`
    );

    if (!confirmou) return;

    try {
      await api.delete(`/funcionarios/${funcionarioId}/imagem`);

      setLista((old) =>
        old.map((f) =>
          Number(f.id) === Number(funcionarioId)
            ? {
                ...f,
                rosto_cadastrado: false,
                possui_imagem_rosto: false,
                foto_path: null,
              }
            : f
        )
      );

      if (imagemModalOpen) {
        fecharModalImagem();
      }

      alert("Cadastro facial excluído com sucesso.");
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao excluir cadastro facial.");
    }
  };

  return (
    <div className="listPage">
      <h2>Funcionários cadastrados</h2>

      <div className="listActions listActionsTop">
        <button className="btnPrimary" onClick={carregar}>
          Atualizar
        </button>

        <div className="buscaBox">
          <input
            type="text"
            placeholder="Pesquisar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="inputBusca"
          />
        </div>

        <span className="total">Total: {total}</span>
      </div>

      {msg && <div className="listMsg">{msg}</div>}

      <div className="tableWrap">
        <table className="listTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nome</th>
              <th>CPF</th>
              <th>Função</th>
              <th>Chegada</th>
              <th>Intervalo início</th>
              <th>Intervalo fim</th>
              <th>Saída</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {listaFiltrada.length > 0 ? (
              listaFiltrada.map((f) => (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td>{f.nome}</td>
                  <td>{formatCPF(f.cpf)}</td>
                  <td>{f.funcao_nome || "—"}</td>
                  <td>{f.chegada?.slice(0, 5)}</td>
                  <td>{f.intervalo_inicio?.slice(0, 5)}</td>
                  <td>{f.intervalo_fim?.slice(0, 5)}</td>
                  <td>{f.saida?.slice(0, 5)}</td>
                  <td>{new Date(f.created_at).toLocaleString()}</td>

                  <td className="acoesCell">
                    <div className="acoesWrap">
                      <button
                        className="btnSecondary"
                        onClick={() => abrirModal(f)}
                      >
                        Alterar
                      </button>

                      <button
                        onClick={() => navigate(`/app/cadastrar-rosto/${f.id}`)}
                        className={`acaoBtn ${
                          f.rosto_cadastrado ? "acaoBtn-rosto-ok" : "acaoBtn-rosto"
                        }`}
                      >
                        {f.rosto_cadastrado ? "Rosto Cadastrado" : "Cadastrar Rosto"}
                      </button>

                      {f.possui_imagem_rosto && (
                        <button
                          onClick={() => verImagem(f.id, f.nome)}
                          className="acaoBtn acaoBtn-ver"
                          disabled={imagemCarregando}
                        >
                          {imagemCarregando ? "Abrindo..." : "Ver Imagem"}
                        </button>
                      )}

                      {f.rosto_cadastrado && (
                        <button
                          onClick={() => excluirRosto(f.id, f.nome)}
                          className="acaoBtn acaoBtn-excluir"
                        >
                          Excluir Rosto
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="10" className="emptyRow">
                  Nenhum funcionário encontrado para essa pesquisa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Alterar Funcionário (ID {editing?.id})</h3>

            <div className="modal-grid">
              <div>
                <label>Nome</label>
                <input name="nome" value={form.nome} onChange={onChange} />
              </div>

              <div>
                <label>CPF</label>
                <input
                  name="cpf"
                  value={form.cpf}
                  onChange={onChange}
                  maxLength={14}
                />
              </div>

              <div>
                <label>Função</label>
                <select
                  name="funcao_id"
                  value={form.funcao_id}
                  onChange={onChange}
                >
                  <option value="">Selecione</option>
                  {funcoes.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                  <option value="outro">Outra função</option>
                </select>
              </div>

              {form.funcao_id === "outro" && (
                <div>
                  <label>Nova função</label>
                  <input
                    name="funcao_nome"
                    value={form.funcao_nome}
                    onChange={onChange}
                  />
                </div>
              )}

              <div>
                <label>Chegada</label>
                <input
                  type="time"
                  name="chegada"
                  value={form.chegada}
                  onChange={onChange}
                />
              </div>

              <div>
                <label>Início intervalo</label>
                <input
                  type="time"
                  name="intervalo_inicio"
                  value={form.intervalo_inicio}
                  onChange={onChange}
                />
              </div>

              <div>
                <label>Fim intervalo</label>
                <input
                  type="time"
                  name="intervalo_fim"
                  value={form.intervalo_fim}
                  onChange={onChange}
                />
              </div>

              <div>
                <label>Saída</label>
                <input
                  type="time"
                  name="saida"
                  value={form.saida}
                  onChange={onChange}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="modal-btn-light" onClick={fecharModal}>
                Cancelar
              </button>

              <button
                className="modal-btn-primary"
                onClick={salvarAlteracoes}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      {imagemModalOpen && (
        <div className="modal-overlay" onClick={fecharModalImagem}>
          <div
            className="modal-card modal-imagem-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-imagem-topo">
              <h3>Imagem salva do reconhecimento</h3>
              <button className="modal-fechar-x" onClick={fecharModalImagem}>
                ×
              </button>
            </div>

            <p className="modal-imagem-nome">{imagemModalNome}</p>

            <div className="modal-imagem-wrap">
              {!erroImagem ? (
                <img
                  src={imagemModalUrl}
                  alt={`Rosto de ${imagemModalNome}`}
                  className="modal-imagem-preview"
                  onError={() => {
                    console.log("ERRO AO CARREGAR IMAGEM:", imagemModalUrl);
                    setErroImagem(true);
                  }}
                />
              ) : (
                <div className="modal-imagem-erro-box">
                  <p>Não foi possível carregar a imagem.</p>
                  <p className="modal-imagem-url">{imagemModalUrl}</p>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={fecharModalImagem}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}