import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Reconhecimento from "./pages/Reconhecimento";
import CadastrarRosto from "./pages/CadastrarRosto";
import RegistrarFuncionario from "./pages/RegistrarFuncionario";
import ListarFuncionarios from "./pages/ListarFuncionarios";
import RelatorioFuncionario from "./pages/RelatorioFuncionario";
import InserirPontoManual from "./pages/InserirPontoManual";
import CadastrarAtestado from "./pages/CadastrarAtestado";
import BancoHoras from "./pages/BancoHoras";
import DashboardLayout from "./layouts/DashboardLayout";
import EscolherBatida from "./pages/EscolherBatida";
import BuscarPontos from "./pages/BuscarPontos";
import ResultadoPontos from "./pages/ResultadoPontos";

function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>

        {/* PÚBLICAS */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/reconhecimento" element={<Reconhecimento />} />
        <Route path="/escolher-batida" element={<EscolherBatida />} />

        {/* 👉 CONSULTA DE PONTO POR CPF */}
        <Route path="/buscar-pontos" element={<BuscarPontos />} />
        <Route path="/resultado-pontos" element={<ResultadoPontos />} />

        {/* ÁREA ADMIN */}
        <Route
          path="/app"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<Navigate to="registrar-funcionario" replace />} />

          <Route path="registrar-funcionario" element={<RegistrarFuncionario />} />
          <Route path="funcionarios" element={<ListarFuncionarios />} />
          <Route path="cadastrar-rosto/:id" element={<CadastrarRosto />} />

          <Route path="relatorio" element={<RelatorioFuncionario />} />
          <Route path="manual" element={<InserirPontoManual />} />
          <Route path="atestado" element={<CadastrarAtestado />} />
          <Route path="bancoHoras" element={<BancoHoras />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
