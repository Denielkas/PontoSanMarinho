import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { apiFace } from "../../services/apiFace";
import "./reconhecimento.css";

export default function Reconhecimento() {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameLoopRef = useRef(null);
  const streamRef = useRef(null);

  const workingRef = useRef(false);
  const confirmOpenRef = useRef(false);

  const [msg, setMsg] = useState("Detectando rosto...");
  const [working, setWorking] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [funcId, setFuncId] = useState(null);
  const [funcNome, setFuncNome] = useState("");
  const [funcCpf, setFuncCpf] = useState("");

  const stopRecognitionLoop = useCallback(() => {
    if (frameLoopRef.current) {
      clearInterval(frameLoopRef.current);
      frameLoopRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return null;
    if (!video.videoWidth || !video.videoHeight) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", 0.75);
  }, []);

  const startRecognitionLoop = useCallback(() => {
    stopRecognitionLoop();

    frameLoopRef.current = setInterval(async () => {
      if (workingRef.current || confirmOpenRef.current) return;

      const frame = captureFrame();
      if (!frame) return;

      workingRef.current = true;
      setWorking(true);

      try {
        const { data } = await apiFace.post("/recognize", {
          image_base64: frame,
        });

        if (data?.matched && data?.funcionario_id) {
          stopRecognitionLoop();

          setMsg("Rosto reconhecido...");

          const funcionarioId = data.funcionario_id;
          setFuncId(funcionarioId);

          const response = await api.get(`/funcionarios/public/${funcionarioId}`);

          setFuncNome(response.data?.nome || "");
          setFuncCpf(response.data?.cpf || "");

          confirmOpenRef.current = true;
          setConfirmOpen(true);

          setMsg("Confirme sua identidade");
        } else {
          setMsg("Procurando rosto...");
        }
      } catch (err) {
        console.error("Erro no reconhecimento:", err);
      } finally {
        workingRef.current = false;
        setWorking(false);
      }
    }, 1200);
  }, [captureFrame, stopRecognitionLoop]);

  useEffect(() => {
    async function iniciarCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setMsg("Câmera indisponível.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;

          await videoRef.current.play();

          setMsg("Detectando rosto...");
          startRecognitionLoop();
        }
      } catch (err) {
        console.error("Erro câmera:", err);
        setMsg("Erro ao acessar câmera.");
      }
    }

    iniciarCamera();

    return () => {
      stopRecognitionLoop();
      stopCamera();
    };
  }, [startRecognitionLoop, stopRecognitionLoop, stopCamera]);

  const cancelarIdentidade = () => {
    confirmOpenRef.current = false;

    setConfirmOpen(false);
    setFuncId(null);
    setFuncNome("");
    setFuncCpf("");

    setMsg("Detectando rosto...");

    startRecognitionLoop();
  };

  const confirmarIdentidade = () => {
    stopRecognitionLoop();

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
          <video
            ref={videoRef}
            className="video"
            autoPlay
            muted
            playsInline
          />

          {working && <div className="count">Lendo...</div>}
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