import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Projects from "./pages/Projects";
import Quotes from "./pages/Quotes";
import Suppliers from "./pages/Suppliers";
import Materials from "./pages/Materials";
import Requisitions from "./pages/Requisitions";
import CalendarPage from "./pages/CalendarPage";
import Reports from "./pages/Reports";
import Users from "./pages/Users";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" toastOptions={{
            style: { border: '2px solid #09090B', borderRadius: 0, boxShadow: '4px 4px 0px 0px rgba(9,9,11,1)', fontFamily: 'Chivo' }
          }} />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/proyectos" element={<Projects />} />
              <Route path="/cotizaciones" element={<Quotes />} />
              <Route path="/proveedores" element={<Suppliers />} />
              <Route path="/insumos" element={<Materials />} />
              <Route path="/requisiciones" element={<Requisitions />} />
              <Route path="/calendario" element={<CalendarPage />} />
              <Route path="/reportes" element={<Reports />} />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute roles={["admin"]}>
                    <Users />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
