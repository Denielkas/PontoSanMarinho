import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import "./register.css";

export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMsg("As senhas não coincidem");
      return;
    }

    setLoading(true);
    setMsg("Cadastrando...");

    try {
      const { data } = await api.post("/auth/register", {
        username,
        password,
      });

      setMsg(data.message || "Cadastro realizado com sucesso");

      setTimeout(() => {
        navigate("/");
      }, 1200);
    } catch (err) {
      const error =
        err.response?.data?.error ||
        err.message ||
        "Erro inesperado ao cadastrar";

      setMsg("Falha: " + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="loginScreen">
      <div className="loginCard">
        <h2 className="loginTitle">Cadastrar Administrador</h2>

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

          <div className="floatLabel">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label className={password ? "filled" : ""}>Senha</label>
          </div>

          <div className="floatLabel">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <label className={confirmPassword ? "filled" : ""}>Confirmar senha</label>
          </div>

          <button className="loginButton" type="submit" disabled={loading}>
            {loading ? "Cadastrando..." : "Cadastrar"}
          </button>

          <button
            className="registerButton"
            type="button"
            onClick={() => navigate("/")}
          >
            Voltar para login
          </button>
        </form>

        <div className="loginMsg">{msg}</div>
      </div>
    </div>
  );
}