import React from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Dashboard from "./pages/Dashboard";
import "./App.css";

const AppLayout = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard");

  return (
    <div className="app-container">
      {!isDashboard && <Navbar />}
      <main className={isDashboard ? "dashboard-main" : "main-content"}>
        <Routes>
          <Route
            path="/"
            element={
              <div
                className="hero-section"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2rem",
                  padding: "2rem 0",
                }}
              >
                <div>
                  <h1>AI Destekli Akıllı İK Platformu</h1>
                  <p>
                    Geleneksel başvuru süreçlerini geride bırakın. Yapay zeka
                    ile şirketleri ve adayları saniyeler içinde yetenek bazlı
                    eşleştiriyoruz.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: "1.5rem",
                    width: "100%",
                    maxWidth: "1000px",
                    marginTop: "2rem",
                  }}
                >
                  <div
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "var(--bg-dark)",
                      borderRadius: "12px",
                      border: "1px solid var(--bg-medium)",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
                      textAlign: "left",
                    }}
                  >
                    <h3
                      style={{
                        color: "var(--accent-red)",
                        marginBottom: "0.75rem",
                        fontSize: "1.25rem",
                      }}
                    >
                      🚀 Proaktif AI Teklifleri
                    </h3>
                    <p
                      style={{
                        fontSize: "0.95rem",
                        margin: 0,
                        color: "var(--text-muted)",
                        lineHeight: "1.5",
                      }}
                    >
                      Şirketler ilan yayınlar, yapay zeka en uygun adayları
                      bulur ve eşleştirir. Şirketler tek tıkla iş teklifi
                      gönderebilir.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "var(--bg-dark)",
                      borderRadius: "12px",
                      border: "1px solid var(--bg-medium)",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
                      textAlign: "left",
                    }}
                  >
                    <h3
                      style={{
                        color: "var(--accent-red)",
                        marginBottom: "0.75rem",
                        fontSize: "1.25rem",
                      }}
                    >
                      🧠 Vektörel Semantik Arama
                    </h3>
                    <p
                      style={{
                        fontSize: "0.95rem",
                        margin: 0,
                        color: "var(--text-muted)",
                        lineHeight: "1.5",
                      }}
                    >
                      Kelime eşleşmesi değil, anlam eşleşmesi! Özgeçmişlerdeki
                      gerçek yetenekler Ollama Llama 3.2 ile analiz edilir.
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "1.5rem",
                      backgroundColor: "var(--bg-dark)",
                      borderRadius: "12px",
                      border: "1px solid var(--bg-medium)",
                      boxShadow: "0 4px 15px rgba(0,0,0,0.05)",
                      textAlign: "left",
                    }}
                  >
                    <h3
                      style={{
                        color: "var(--accent-red)",
                        marginBottom: "0.75rem",
                        fontSize: "1.25rem",
                      }}
                    >
                      ⚡ SQL + AI Yalın Filtre
                    </h3>
                    <p
                      style={{
                        fontSize: "0.95rem",
                        margin: 0,
                        color: "var(--text-muted)",
                        lineHeight: "1.5",
                      }}
                    >
                      Filtreleme işlemleri (şehir, çalışma türü) saniyeler
                      içinde SQL katmanında gerçekleşir, AI skoruyla entegre
                      çalışır.
                    </p>
                  </div>
                </div>
              </div>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;
