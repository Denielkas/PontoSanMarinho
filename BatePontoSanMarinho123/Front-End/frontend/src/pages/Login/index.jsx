import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { api } from "../../services/api";
import "./login.css";

export default function Login() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("Autenticando...");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        username,
        password,
      });

      localStorage.setItem("token", data.token);
      navigate("/app/registrar-funcionario", { replace: true });
    } catch (err) {
      const error =
        err.response?.data?.error ||
        err.message ||
        "Erro inesperado ao autenticar";

      setMsg("Falha: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginScreen">
      <div className="loginCard">
        <h2 className="loginTitle">Login Administrativo</h2>

        <form className="loginForm" onSubmit={onSubmit}>
          <div className="floatLabel">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <label className={username ? "filled" : ""}>Usuário</label>
          </div>

          <div className="floatLabel passwordWrapper">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label className={password ? "filled" : ""}>Senha</label>

            <button
              type="button"
              className="eyeButton"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>

          <button className="loginButton" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <button
            className="registerButton"
            type="button"
            onClick={() => navigate("/register")}
          >
            Cadastrar administrador
          </button>
        </form>

        <div className="loginMsg">{msg}</div>
      </div>
    </div>
  );
}