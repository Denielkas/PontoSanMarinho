import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import relogio from "../../assets/logo/relogio.png";
import logo from "../../assets/logo/Hotel-Sam-Marinho.png";

import "./home.css";

export default function Home() {
  const navigate = useNavigate();

  const [time, setTime] = useState(
    new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false
        })
      );
    }, 1000);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="homeScreen">
      <header className="homeHeader">
        <Link to="/login" className="brand">
          <img src={logo} className="brandLogo" alt="San Marinho" />
        </Link>
      </header>

      <main className="homeMain">

        {/* BATER PONTO */}
        <button
          className="clockButton"
          onClick={() => navigate("/reconhecimento")}
        >
          <img src={relogio} className="clockIcon" alt="Relógio" />
          <span className="clockTime">{time}</span>
          <span className="clockLabel">Bater ponto</span>
        </button>

        {/* VER PONTOS */}
        <button
          className="viewPointsButton"
          onClick={() => navigate("/buscar-pontos")}
        >
          <span className="viewPointsEmoji">📋</span>
          <span className="viewPointsLabel">Ver pontos batidos</span>
        </button>

      </main>
    </div>
  );
}
