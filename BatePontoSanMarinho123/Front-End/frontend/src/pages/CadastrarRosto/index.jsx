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
        console.error(err);
      }
    }

    async function iniciarCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMsg("Câmera indisponível neste navegador.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await new Promise((resolve) => {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current.play();
              resolve();
            };
          });
        }

        setMsg("Câmera pronta.");
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
  }, [id]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;

    if (video.readyState < 2) {
      return null;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      return null;
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(video, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const salvar = async () => {
    if (saving) return;

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
        throw new Error(data.error || "Falha ao cadastrar");
      }

      abrirModal(
        "Registrado com sucesso!",
        `Rosto de ${nome} cadastrado com sucesso.`,
        false,
        true
      );
    } catch (err) {
      console.error(err);

      abrirModal(
        "Erro ao cadastrar",
        err?.response?.data?.error || err.message,
        true
      );
    } finally {
      setSaving(false);
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
          className="video"
        />
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <p className="msg">
        {nome ? `Funcionário: ${nome} — ` : ""}
        {msg}
      </p>

      <button onClick={salvar} className="rostocadBtn">
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