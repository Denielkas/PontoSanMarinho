import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";
import "./cadastrarRosto.css";

export default function CadastrarRosto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

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
    }, 2000);
  };

  useEffect(() => {
    async function carregarFuncionario() {
      try {
        const { data } = await api.get(`/funcionarios/${id}`);
        setNome(data.nome);
      } catch (err) {
        console.error("Erro ao carregar funcionário:", err);
        setMsg("Erro ao carregar funcionário");
      }
    }

    async function iniciarCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMsg("Câmera indisponível neste navegador.");
          return;
        }

        let stream = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { exact: "user" },
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: "user",
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
            audio: false,
          });
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = async () => {
              try {
                await videoRef.current.play();
              } catch (e) {
                console.error("Erro ao dar play no vídeo:", e);
              }
              resolve();
            };
          });
        }

        setMsg("Câmera frontal pronta. Clique para capturar o rosto.");
      } catch (err) {
        console.error("Erro câmera:", err);
        setMsg("Erro ao acessar câmera");
      }
    }

    carregarFuncionario();
    iniciarCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [id, navigate]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;
    if (video.readyState < 2) return null;

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) return null;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const imageBase64 = canvas.toDataURL("image/jpeg", 0.9);

    if (!imageBase64 || !imageBase64.startsWith("data:image/jpeg;base64,")) {
      return null;
    }

    return imageBase64;
  };

  const salvar = async () => {
    if (saving) return;

    setSaving(true);
    setMsg("Capturando imagem...");

    const img = captureFrame();

    if (!img) {
      abrirModal("Erro ao cadastrar", "Não foi possível capturar a imagem.", true);
      setSaving(false);
      setMsg("Câmera frontal pronta. Clique para capturar o rosto.");
      return;
    }

    try {
      const payload = {
        funcionario_id: Number(id),
        image_base64: img,
      };

      const { data } = await apiFace.post("/enroll", payload);

      if (!data?.ok) {
        throw new Error(data?.error || "Falha ao cadastrar rosto");
      }

      abrirModal(
        "Registrado com sucesso!",
        `Rosto de ${nome || "funcionário"} cadastrado com sucesso.`,
        false,
        true
      );
    } catch (err) {
      console.error("Erro ao cadastrar rosto:", err);

      abrirModal(
        "Erro ao cadastrar",
        err?.response?.data?.error || err.message || "Erro ao cadastrar rosto.",
        true
      );
    } finally {
      setSaving(false);
      setMsg("Câmera frontal pronta. Clique para capturar o rosto.");
    }
  };

  return (
    <div className="rostocadPage">
      <h2>Cadastrar Rosto</h2>

      <div className="videoArea">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="rostocadVideo"
        />
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <p className="msg">
        {nome ? `Funcionário: ${nome} — ` : ""}
        {msg}
      </p>

      <button onClick={salvar} className="rostocadBtn" disabled={saving}>
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
            {modalErro ? (
              <FaTimesCircle className="modal-icon modal-icon-erro" />
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