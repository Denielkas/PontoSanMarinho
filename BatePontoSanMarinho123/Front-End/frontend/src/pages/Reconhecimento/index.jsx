import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";
import "./reconhecimento.css";

export default function Reconhecimento() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [msg, setMsg] = useState("Detectando rosto...");
  const [working, setWorking] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [funcId, setFuncId] = useState(null);
  const [funcNome, setFuncNome] = useState("");
  const [funcCpf, setFuncCpf] = useState("");

  const frameLoop = useRef(null);

  /* --------------------------
      1) INICIALIZA A CÂMERA
  --------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        });

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        startRecognitionLoop();
      } catch (err) {
        setMsg("Erro ao acessar a câmera");
      }
    })();

    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
      clearInterval(frameLoop.current);
    };
  }, []);

  /* --------------------------
       2) CAPTURAR FRAME
  --------------------------- */
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext("2d");

    /* 🔥 Reduz resolução para acelerar envio */
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    /* 🔥 JPEG mais leve para envio rápido */
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  /* --------------------------
     3) LOOP SUPER RÁPIDO
  --------------------------- */
  const startRecognitionLoop = () => {
    frameLoop.current = setInterval(async () => {
      if (working || confirmOpen) return;

      setWorking(true);

      const frame = captureFrame();

      try {
        const { data } = await apiFace.post("/recognize", {
          image_base64: frame,
        });

        if (data?.matched && data.funcionario_id) {
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
      }

      setWorking(false);
    }, 200); // 🔥 5x POR SEGUNDO — muito rápido
  };

  /* --------------------------
     4) BOTÃO: NÃO SOU EU
  --------------------------- */
  const cancelarIdentidade = () => {
    setConfirmOpen(false);
    setMsg("Detectando rosto...");
    startRecognitionLoop();
  };

  /* --------------------------
     5) BOTÃO: SOU EU
  --------------------------- */
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

  /* --------------------------
               HTML
  --------------------------- */
  return (
    <div className="recScreen">
      <div className="recCard">
        <h2 className="recTitle">Reconhecimento Facial</h2>

        <div className="videoWrap">
          <video ref={videoRef} className="video" muted playsInline />
        </div>

        <div className="recMsg">{msg}</div>

        <button className="recCancel" onClick={() => navigate("/")}>
          Cancelar
        </button>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* CONFIRMAÇÃO */}
      {confirmOpen && (
        <div className="modalOverlay" onClick={cancelarIdentidade}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar identidade</h3>

            <p><strong>{funcNome}</strong></p>
            <p>CPF: <strong>{funcCpf}</strong></p>

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
