import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";

import "./vincularCPF.css";

// utils
const onlyDigits = (v = "") => String(v).replace(/\D+/g, "");

const formatCPF = (v = "") => {
  const s = onlyDigits(v).slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0, 3)}.${s.slice(3, 6)}`;
  if (s.length <= 9) return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}`;
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9, 11)}`;
};

export default function VincularCPF() {
  const navigate = useNavigate();
  const { state } = useLocation();

  // imagem capturada
  const capturedImage = state?.image || state?.photo || "";

  // estado do CPF
  const [cpfInput, setCpfInput] = useState("");
  const cpfDigits = useMemo(() => onlyDigits(cpfInput).slice(0, 11), [cpfInput]);

  // nome encontrado
  const [nome, setNome] = useState("");

  // modais e loading
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingNome, setLoadingNome] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!capturedImage) {
      alert("Nenhuma imagem capturada. Voltando…");
      navigate("/reconhecimento", { replace: true });
    }
  }, []);

  const onChangeCpf = (e) => setCpfInput(e.target.value);

  const onKeyDownCpf = (e) => {
    const allow =
      ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey;

    if (allow) return;

    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  // buscar nome no banco
  const buscarNome = async () => {
    if (cpfDigits.length !== 11) {
      return alert("CPF deve ter 11 dígitos");
    }

    try {
      setLoadingNome(true);
      const { data } = await api.get(`/funcionarios/by-cpf/${cpfDigits}`);
      setNome(data?.nome || "");
      setShowConfirm(true);
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao buscar CPF.");
    } finally {
      setLoadingNome(false);
    }
  };

  const confirmar = async () => {
    if (!capturedImage) return alert("Foto inválida.");
    if (cpfDigits.length !== 11) return alert("CPF inválido.");

    setSaving(true);

    try {
      const payload = {
        cpf: cpfDigits,
        image_base64: capturedImage,
        save_image: true,
      };

      const { data } = await apiFace.post("/enroll", payload);

      if (!data?.ok) {
        throw new Error(data?.error || "Erro ao vincular rosto.");
      }

      alert(`Vinculado com sucesso para ${nome} (${formatCPF(cpfDigits)})`);
      navigate("/", { replace: true });
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          err.message ||
          "Falha ao vincular."
      );
    } finally {
      setSaving(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="vincScreen">
      <div className="vincCard">
        <h2>Vincular rosto ao CPF</h2>

        <div className="preview">
          {capturedImage ? (
            <img src={capturedImage} alt="captura" />
          ) : (
            <div className="empty">Sem imagem</div>
          )}
        </div>

        <div className="form">
          <label>CPF</label>
          <input
            value={formatCPF(cpfInput)}
            onChange={onChangeCpf}
            onKeyDown={onKeyDownCpf}
            maxLength={14}
            inputMode="numeric"
            placeholder="000.000.000-00"
          />

          <button
            onClick={buscarNome}
            disabled={cpfDigits.length !== 11 || loadingNome}
          >
            {loadingNome ? "Buscando..." : "Buscar nome"}
          </button>
        </div>

        <button className="cancel" onClick={() => navigate("/reconhecimento")}>
          Voltar
        </button>
      </div>

      {/* modal */}
      {showConfirm && (
        <div className="modalOverlay" onClick={() => setShowConfirm(false)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar dados</h3>

            <p>
              Nome encontrado: <strong>{nome || "—"}</strong>
            </p>

            <p>
              CPF: <strong>{formatCPF(cpfDigits)}</strong>
            </p>

            <div className="modalActions">
              <button onClick={() => setShowConfirm(false)} disabled={saving}>
                Cancelar
              </button>

              <button onClick={confirmar} disabled={saving}>
                {saving ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
