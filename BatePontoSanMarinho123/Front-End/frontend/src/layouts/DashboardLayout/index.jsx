import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../../assets/logo/Hotel-Sam-Marinho.png";
import "./layout.css";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/", { replace: true });
  };

  const toggleMenu = () => setOpen(!open);
  const closeOnClick = () => setOpen(false);

  return (
    <div className={`dashContainer ${open ? "menu-open" : ""}`}>
      
      {/* BOTÃO DE MENU */}
      <button className="menuToggle" onClick={toggleMenu}>
        {open ? "←" : "☰"}
      </button>

      {/* SIDEBAR */}
      <aside className={`dashSidebar ${open ? "show" : ""}`}>
        
        <div className="sidebarHeader">
          <img src={logo} className="sidebarLogo" alt="San Marinho" />
        </div>

        <nav className="dashMenu">

          <NavLink to="registrar-funcionario" className="dashLink" onClick={closeOnClick}>
            Cadastrar Funcionário
          </NavLink>

          <NavLink to="funcionarios" className="dashLink" onClick={closeOnClick}>
            Ver Funcionários
          </NavLink>

          <NavLink to="relatorio" className="dashLink" onClick={closeOnClick}>
            Relatório
          </NavLink>

          <NavLink to="manual" className="dashLink" onClick={closeOnClick}>
            Inserir Ponto Manual
          </NavLink>

          <NavLink to="atestado" className="dashLink" onClick={closeOnClick}>
            Anexar Atestado
          </NavLink>
          
          <NavLink to="bancoHoras" className="dashLink" onClick={closeOnClick}>
            Banco de Horas
          </NavLink>

        </nav>

        <button className="dashLogout" onClick={logout}>
          Sair
        </button>
      </aside>

      {/* CONTEÚDO */}
      <main className="dashContent">
        <Outlet />
      </main>

    </div>
  );
}
