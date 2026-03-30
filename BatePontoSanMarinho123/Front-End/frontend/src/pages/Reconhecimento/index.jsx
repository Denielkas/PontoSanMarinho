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
  const mountedRef = useRef(true);

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

    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const startRecognitionLoop = useCallback(() => {
    stopRecognitionLoop();

    frameLoopRef.current = setInterval(async () => {
      if (!mountedRef.current) return;
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
        setMsg("Erro ao reconhecer rosto.");
      } finally {
        workingRef.current = false;
        if (mountedRef.current) {
          setWorking(false);
        }
      }
    }, 1500);
  }, [captureFrame, stopRecognitionLoop]);

  const obterCameraFrontal = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Câmera indisponível neste navegador.");
    }

    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      console.log("Falhou exact:user, tentando user simples...", err);

      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err2) {
        console.log("Falhou facingMode user, tentando enumerar câmeras...", err2);

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");

        const frontal =
          videoInputs.find((d) =>
            /front|frontal|user|face/i.test(d.label || "")
          ) || videoInputs[0];

        if (!frontal?.deviceId) {
          throw new Error("Nenhuma câmera encontrada.");
        }

        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: frontal.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    async function iniciarCamera() {
      try {
        setMsg("Abrindo câmera frontal...");

        stopRecognitionLoop();
        stopCamera();

        const stream = await obterCameraFrontal();

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("autoplay", "");
          videoRef.current.setAttribute("muted", "");
          videoRef.current.setAttribute("playsinline", "");

          await videoRef.current.play();
        }

        setMsg("Detectando rosto...");
        startRecognitionLoop();
      } catch (err) {
        console.error("Erro câmera:", err);
        setMsg("Erro ao acessar câmera frontal.");
      }
    }

    iniciarCamera();

    return () => {
      mountedRef.current = false;
      stopRecognitionLoop();
      stopCamera();
    };
  }, [obterCameraFrontal, startRecognitionLoop, stopRecognitionLoop, stopCamera]);

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