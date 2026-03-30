import { useEffect, useMemo, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { api } from "../../services/api";
import "./listarAdmins.css";

export default function ListarAdmins() {
  const [lista, setLista] = useState([]);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const carregar = async () => {
    setMsg("Carregando...");
    try {
      const { data } = await api.get("/auth/admins");
      setLista(Array.isArray(data) ? data : []);
      setMsg("");
    } catch (err) {
      setMsg(err.response?.data?.error || "Erro ao carregar administradores");
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const total = useMemo(() => lista.length, [lista]);

  const abrirModal = (admin) => {
    setEditing(admin);
    setForm({
      username: admin.username || "",
      password: "",
      confirmPassword: "",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
    setOpen(true);
  };

  const fecharModal = () => {
    setOpen(false);
    setEditing(null);
    setForm({
      username: "",
      password: "",
      confirmPassword: "",
    });
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((old) => ({
      ...old,
      [name]: value,
    }));
  };

  const salvarAlteracoes = async () => {
    if (!editing) return;

    if (!form.password || !form.confirmPassword) {
      alert("Preencha a nova senha e a confirmação.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      alert("As senhas não coincidem.");
      return;
    }

    if (form.password.length < 4) {
      alert("A senha deve ter pelo menos 4 caracteres.");
      return;
    }

    setSaving(true);

    try {
      await api.put(`/auth/admins/${editing.id}/password`, {
        password: form.password,
      });

      setLista((old) =>
        old.map((item) =>
          item.id === editing.id
            ? {
              ...item,
              username: form.username,
            }
            : item
        )
      );

      fecharModal();
      alert("Senha alterada com sucesso.");
    } catch (err) {
      alert(err.response?.data?.error || "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="adminPage">
      <h2>Administradores cadastrados</h2>

      <div className="adminActions">
        <button className="btnPrimary" onClick={carregar}>
          Atualizar
        </button>
        <span className="total">Total: {total}</span>
      </div>

      {msg && <div className="adminMsg">{msg}</div>}

      <div className="tableWrap">
        <table className="adminTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuário</th>
              <th>Criado em</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {lista.length > 0 ? (
              lista.map((admin) => (
                <tr key={admin.id}>
                  <td>{admin.id}</td>
                  <td>{admin.username}</td>
                  <td>
                    {admin.created_at
                      ? new Date(admin.created_at).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="btnSecondary"
                      onClick={() => abrirModal(admin)}
                    >
                      Alterar Senha
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="emptyRow">
                  Nenhum administrador encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Alterar senha do administrador</h3>

            <div className="modal-grid">
              <div>
                <label>Usuário</label>
                <input
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  disabled
                />
              </div>

              <div></div>

              <div className="passwordField">
                <label>Nova senha</label>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={onChange}
                  placeholder="Digite a nova senha"
                />
                <button
                  type="button"
                  className="eyeButton"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <div className="passwordField">
                <label>Confirmar senha</label>
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={onChange}
                  placeholder="Repita a nova senha"
                />
                <button
                  type="button"
                  className="eyeButton"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <button
              className="btn-excluir-admin"
              onClick={() => excluirAdmin(admin.id)}
            >
              Excluir ADM
            </button>

            <div className="modal-actions">
              <button className="modal-btn-light" onClick={fecharModal}>
                Cancelar
              </button>

              <button
                className="modal-btn-primary"
                onClick={salvarAlteracoes}
                disabled={saving}
              >
                {saving ? "Salvando..." : "Salvar nova senha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}