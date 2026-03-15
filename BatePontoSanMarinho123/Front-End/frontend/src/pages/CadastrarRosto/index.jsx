import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaCheckCircle } from "react-icons/fa";
import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";
import "./cadastrarRosto.css";

export default function CadastrarRosto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState("Carregando...");
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitulo, setModalTitulo] = useState("");
  const [modalTexto, setModalTexto] = useState("");
  const [modalErro, setModalErro] = useState(false);

  const abrirModal = (titulo, texto, erro = false, redirecionar = false) => {
    setModalTitulo(titulo);
    setModalTexto(texto);
    setModalErro(erro);
    setModalOpen(true);

    setTimeout(() => {
      setModalOpen(false);

      if (redirecionar) {
        navigate("/app/funcionarios");
      }
    }, 1500);
  };

  useEffect(() => {
    api
      .get(`/funcionarios/${id}`)
      .then((r) => {
        setNome(r.data.nome);
        setMsg("Preparando câmera...");
      })
      .catch(() => {
        setMsg("Erro ao carregar funcionário");
      });

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setMsg("Clique para capturar o rosto");
      } catch {
        setMsg("Erro ao acessar a câmera");
      }
    })();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, [id]);

  const captureFrame = () => {
    const v = videoRef.current;
    const c = canvasRef.current;

    if (!v || !c) return null;
    if (!v.videoWidth || !v.videoHeight) return null;

    c.width = v.videoWidth;
    c.height = v.videoHeight;

    const ctx = c.getContext("2d");
    ctx.drawImage(v, 0, 0, c.width, c.height);

    return c.toDataURL("image/jpeg", 0.9);
  };

  const salvar = async () => {
    setSaving(true);

    const img = captureFrame();

    if (!img) {
      abrirModal("Erro ao cadastrar", "Não foi possível capturar a imagem.", true);
      setSaving(false);
      return;
    }

    try {
      const { data } = await apiFace.post("/enroll", {
        funcionario_id: Number(id),
        image_base64: img,
      });

      if (!data.ok) {
        throw new Error("Falha no cadastro facial");
      }

      abrirModal(
        "Registrado com sucesso!",
        `Rosto de ${nome || "funcionário"} cadastrado com sucesso!`,
        false,
        true
      );
    } catch (err) {
      console.error(err);
      abrirModal("Erro ao cadastrar", "Erro ao cadastrar rosto.", true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rostocadPage">
      <h2>Cadastrar Rosto</h2>

      <div className="videoArea">
        <video ref={videoRef} className="video" autoPlay playsInline muted />
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <p className="msg">
        {nome ? `Funcionário: ${nome} — ` : ""}
        {msg}
      </p>

      <button className="rostocadBtn" onClick={salvar} disabled={saving}>
        {saving ? "Salvando..." : "Capturar e Salvar"}
      </button>

      <button
        className="rostocadBack"
        onClick={() => navigate("/app/funcionarios")}
      >
        Voltar
      </button>

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
