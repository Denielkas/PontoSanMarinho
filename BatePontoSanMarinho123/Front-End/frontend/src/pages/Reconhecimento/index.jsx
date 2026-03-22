import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";
import "./reconhecimento.css";

export default function Reconhecimento() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameLoop = useRef(null);
  const streamRef = useRef(null);

  const [msg, setMsg] = useState("Detectando rosto...");
  const [working, setWorking] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [funcId, setFuncId] = useState(null);
  const [funcNome, setFuncNome] = useState("");
  const [funcCpf, setFuncCpf] = useState("");

  useEffect(() => {
    async function iniciarCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        startRecognitionLoop();
      } catch (err) {
        console.error("Erro ao acessar a câmera:", err);
        setMsg("Erro ao acessar a câmera");
      }
    }

    iniciarCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      if (frameLoop.current) {
        clearInterval(frameLoop.current);
      }
    };
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;
    if (!video.videoWidth || !video.videoHeight) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.6);
  };

  const startRecognitionLoop = () => {
    if (frameLoop.current) {
      clearInterval(frameLoop.current);
    }

    frameLoop.current = setInterval(async () => {
      if (working || confirmOpen) return;

      const frame = captureFrame();
      if (!frame) return;

      setWorking(true);

      try {
        const { data } = await apiFace.post("/recognize", {
          image_base64: frame,
        });

        if (data?.matched && data?.funcionario_id) {
          clearInterval(frameLoop.current);

          setFuncId(data.funcionario_id);

          const r = await api.get(`/funcionarios/public/${data.funcionario_id}`);

          setFuncNome(r.data.nome);
          setFuncCpf(r.data.cpf);

          setConfirmOpen(true);
          setMsg("Confirme sua identidade");
        } else {
          setMsg("Procurando rosto...");
        }
      } catch (err) {
        console.error("Erro no reconhecimento:", err);
      } finally {
        setWorking(false);
      }
    }, 700);
  };

  const cancelarIdentidade = () => {
    setConfirmOpen(false);
    setFuncId(null);
    setFuncNome("");
    setFuncCpf("");
    setMsg("Detectando rosto...");
    startRecognitionLoop();
  };

  const confirmarIdentidade = () => {
    navigate("/escolher-batida", {
      state: {
        funcionario: {
          id: funcId,
          nome: funcNome,
          cpf: funcCpf,
        },
      },
    });
  };

  return (
    <div className="recScreen">
      <div className="recCard">
        <h2 className="recTitle">Reconhecimento Facial</h2>

        <div className="videoWrap">
          <video ref={videoRef} className="video" autoPlay muted playsInline />
        </div>

        <div className="recMsg">{msg}</div>

        <button className="recCancel" onClick={() => navigate("/")}>
          Cancelar
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {confirmOpen && (
        <div className="modalOverlay" onClick={cancelarIdentidade}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar identidade</h3>

            <p>
              <strong>{funcNome}</strong>
            </p>
            <p>
              CPF: <strong>{funcCpf}</strong>
            </p>

            <div className="modalActions">
              <button onClick={cancelarIdentidade}>Não sou eu</button>
              <button onClick={confirmarIdentidade}>Sou eu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}