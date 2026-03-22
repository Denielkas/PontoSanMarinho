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
    }, 1800);
  };

  useEffect(() => {
    async function carregarFuncionario() {
      try {
        const { data } = await api.get(`/funcionarios/${id}`);
        setNome(data.nome);
        setMsg("Preparando câmera...");
      } catch (error) {
        console.error("Erro ao carregar funcionário:", error);
        setMsg("Erro ao carregar funcionário");
      }
    }

    async function iniciarCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMsg("Câmera indisponível neste navegador ou fora de HTTPS.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setMsg("Clique para capturar o rosto");
      } catch (error) {
        console.error("Erro ao acessar câmera:", error);
        setMsg("Erro ao acessar a câmera");
      }
    }

    carregarFuncionario();
    iniciarCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [id]);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;
    if (!video.videoWidth || !video.videoHeight) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

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

      if (!data?.ok) {
        throw new Error(data?.error || "Falha no cadastro facial");
      }

      abrirModal(
        "Registrado com sucesso!",
        `Rosto de ${nome || "funcionário"} cadastrado com sucesso!`,
        false,
        true
      );
    } catch (error) {
      console.error("Erro ao cadastrar rosto:", error);

      abrirModal(
        "Erro ao cadastrar",
        error?.response?.data?.error ||
          error?.message ||
          "Erro ao cadastrar rosto.",
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