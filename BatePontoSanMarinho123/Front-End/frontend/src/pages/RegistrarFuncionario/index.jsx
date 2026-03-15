import { useEffect, useState } from "react";
import { FaCheckCircle } from "react-icons/fa";
import { api } from "../../services/api";
import "./registrar.css";

/* ---------------- UTILIDADES ---------------- */

const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");

const formatCPF = (v = "") => {
  const s = onlyDigits(v).slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3, 6)}`;
  if (s.length <= 9)
    return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}`;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
};

/* ---------------- COMPONENTE ---------------- */

export default function RegistrarFuncionario() {
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    funcao_id: "",
    chegada: "08:00",
    intervalo_inicio: "12:00",
    intervalo_fim: "13:00",
    saida: "17:00",
  });

  const [funcoes, setFuncoes] = useState([]);
  const [isOutraFuncao, setIsOutraFuncao] = useState(false);
  const [novaFuncao, setNovaFuncao] = useState("");
  const [loading, setLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTexto, setModalTexto] = useState("");
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalErro, setModalErro] = useState(false);

  /* ---------------- BUSCAR FUNÇÕES ---------------- */

  const loadFuncoes = async () => {
    try {
      const { data } = await api.get("/funcoes");
      setFuncoes(data);
    } catch (err) {
      console.error(err);
      abrirModal("Erro", "Erro ao carregar funções", true);
    }
  };

  useEffect(() => {
    loadFuncoes();
  }, []);

  /* ---------------- MODAL ---------------- */

  const abrirModal = (titulo, texto, erro = false) => {
    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    setTimeout(() => {
      setModalOpen(false);
    }, 1500);
  };

  /* ---------------- HANDLERS ---------------- */

  const onChange = (e) => {
    const { name, value } = e.target;

    if (name === "funcao_id") {
      if (value === "OUTRA") {
        setIsOutraFuncao(true);
        setForm((old) => ({ ...old, funcao_id: "" }));
      } else {
        setIsOutraFuncao(false);
        setNovaFuncao("");
        setForm((old) => ({ ...old, funcao_id: value }));
      }
      return;
    }

    setForm((old) => ({
      ...old,
      [name]: name === "cpf" ? formatCPF(value) : value,
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        nome: form.nome,
        cpf: onlyDigits(form.cpf),
        funcao_id: isOutraFuncao ? null : form.funcao_id,
        funcao_nome: isOutraFuncao ? novaFuncao : null,
        chegada: form.chegada,
        intervalo_inicio: form.intervalo_inicio,
        intervalo_fim: form.intervalo_fim,
        saida: form.saida,
      };

      const { data } = await api.post("/funcionarios", payload);

      await loadFuncoes();

      setForm({
        nome: "",
        cpf: "",
        funcao_id: "",
        chegada: "08:00",
        intervalo_inicio: "12:00",
        intervalo_fim: "13:00",
        saida: "17:00",
      });

      setIsOutraFuncao(false);
      setNovaFuncao("");

      abrirModal(
        "Registrado com sucesso!",
        `Funcionário ${data.nome} cadastrado com sucesso!`
      );
    } catch (err) {
      abrirModal(
        "Erro ao cadastrar",
        err.response?.data?.error || "Erro ao cadastrar funcionário.",
        true
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- JSX ---------------- */

  return (
    <div className="regPage">
      <h2 className="regTitle">Cadastrar Funcionário</h2>

      <form className="regForm" onSubmit={onSubmit}>
        <div className="formItem1">
          <label>Nome</label>
          <input
            name="nome"
            value={form.nome}
            onChange={onChange}
            required
            placeholder="Digite o nome completo"
            className="inputDiferente"
          />
        </div>

        <div className="formItem1">
          <label>CPF</label>
          <input
            name="cpf"
            value={form.cpf}
            onChange={onChange}
            maxLength={14}
            inputMode="numeric"
            required
            placeholder="000.000.000-00"
            className="inputDiferente"
          />
        </div>

        <div className="formItem1">
          <label>Função</label>
          <select
            name="funcao_id"
            value={isOutraFuncao ? "OUTRA" : form.funcao_id}
            onChange={onChange}
            required={!isOutraFuncao}
            className="inputDiferente"
          >
            <option value="">Selecione a função</option>
            {funcoes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
            <option value="OUTRA">Outra...</option>
          </select>
        </div>

        {isOutraFuncao && (
          <div className="formItem1">
            <label>Nova função</label>
            <input
              value={novaFuncao}
              onChange={(e) => setNovaFuncao(e.target.value)}
              required
              placeholder="Digite a nova função"
              className="inputDiferente"
            />
          </div>
        )}

        <div className="grid2">
          <div className="formItem">
            <label>Entrada</label>
            <input
              type="time"
              name="chegada"
              value={form.chegada}
              onChange={onChange}
              required
              className="inputIguais"
            />
          </div>

          <div className="formItem">
            <label>Saída</label>
            <input
              type="time"
              name="saida"
              value={form.saida}
              onChange={onChange}
              required
              className="inputIguais"
            />
          </div>
        </div>

        <div className="grid2">
          <div className="formItem">
            <label>Início do Intervalo</label>
            <input
              type="time"
              name="intervalo_inicio"
              value={form.intervalo_inicio}
              onChange={onChange}
              required
              className="inputIguais"
            />
          </div>

          <div className="formItem">
            <label>Volta do Intervalo</label>
            <input
              type="time"
              name="intervalo_fim"
              value={form.intervalo_fim}
              onChange={onChange}
              required
              className="inputIguais"
            />
          </div>
        </div>

        <button className="regButton" type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Cadastrar"}
        </button>
      </form>

      {modalOpen && (
        <div className="modal-ponto">
          <div className={`modal-box ${modalErro ? "modal-box-erro" : ""}`}>
            <FaCheckCircle className={`modal-icon ${modalErro ? "modal-icon-erro" : ""}`} />
            <h3>{modalTitulo}</h3>
            <p>{modalTexto}</p>
          </div>
        </div>
      )}
    </div>
  );
}
