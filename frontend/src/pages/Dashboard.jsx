import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState(null);
  const [userProfileId, setUserProfileId] = useState(null); // to pass to /api/matches/candidate/:id

  // Dashboard Core States
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview"); // overview, my_applications, create_job, incoming_applications

  // Onboarding States
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [candidateForm, setCandidateForm] = useState({
    full_name: "",
    phone: "",
    location: "",
    education: "",
    experience: "",
    projects: "",
    skills: "",
  });
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    industry: "",
    website: "",
    description: "",
  });

  // Data States
  const [aiMatches, setAiMatches] = useState([]);
  const [myApplications, setMyApplications] = useState([]);
  const [incomingApplications, setIncomingApplications] = useState([]);
  const [myOffers, setMyOffers] = useState([]); // Yeni: Adaya gelen teklifler
  const [myJobs, setMyJobs] = useState([]); // Yeni: Şirketin kendi ilanları
  const [selectedJobId, setSelectedJobId] = useState(null); // İlan detayı/başvuru inceleme için
  const [expandedCandidateJobId, setExpandedCandidateJobId] = useState(null); // Aday tarafı ilan detayı için
  const [expandedAppId, setExpandedAppId] = useState(null); // Şirket tarafı CV detayı için
  const [jobForm, setJobForm] = useState({
    title: "",
    description: "",
    work_type: "onsite",
    location: "",
  });
  const [editJobForm, setEditJobForm] = useState(null); // İlan düzenleme formu
  const [aiRecommendedCandidates, setAiRecommendedCandidates] = useState([]); // İlana özel AI önerileri
  const [reIndexing, setReIndexing] = useState(false); // İlan güncellenirken AI loading
  const [actionLoading, setActionLoading] = useState(false); // For applying or posting jobs

  // Filter States
  const [candidateFilters, setCandidateFilters] = useState({
    work_type: "",
    location: "",
    min_score: 0,
  });
  const [companyFilters, setCompanyFilters] = useState({
    location: "",
    min_score: 0,
  });

  // AI Proactive Matching States
  const [analyzingMatches, setAnalyzingMatches] = useState(false);
  const [jobMatches, setJobMatches] = useState([]);
  const [createdJobId, setCreatedJobId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }
    const userRole = localStorage.getItem("userRole");
    setRole(userRole);
    fetchProfileData(token, userRole);
  }, [navigate]);

  const fetchProfileData = async (token, userRole) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          handleLogout();
          return;
        }
        throw new Error("Profil yüklenemedi.");
      }

      const data = await response.json();
      setUserProfileId(data.id);

      if (!data.details || Object.keys(data.details).length === 0) {
        setIsOnboarding(true);
        if (userRole === "candidate" && data.fullname) {
          setCandidateForm((prev) => ({ ...prev, full_name: data.fullname }));
        }
      } else {
        setIsOnboarding(false);
        // Profil tamamlandıysa sekme verilerini çek
        if (userRole === "candidate") {
          let edu = "", exp = "", proj = "", sk = "";
          if (data.details.parsed_text) {
             const text = data.details.parsed_text;
             const eduMatch = text.match(/Eğitim:\n([\s\S]*?)(?=\n\nDeneyimler:|$)/);
             const expMatch = text.match(/Deneyimler:\n([\s\S]*?)(?=\n\nProjeler:|$)/);
             const projMatch = text.match(/Projeler:\n([\s\S]*?)(?=\n\nYetenekler:|$)/);
             const skMatch = text.match(/Yetenekler:\n([\s\S]*?)$/);
             
             if(eduMatch) edu = eduMatch[1];
             if(expMatch) exp = expMatch[1];
             if(projMatch) proj = projMatch[1];
             if(skMatch) sk = skMatch[1];
          }

          setCandidateForm(prev => ({
              ...prev,
              full_name: data.details.full_name || data.fullname || "",
              phone: data.details.phone || "",
              location: data.details.location || "",
              education: edu,
              experience: exp,
              projects: proj,
              skills: sk,
              parsed_text: data.details.parsed_text || "",
          }));

          fetchAiMatches(token, data.id);
        } else if (userRole === "company") {
          setActiveTab("my_jobs"); // Varsayılan Şirket Sekmesi (Değiştirildi)
          fetchIncomingApplications(token);
          fetchMyJobs(token); // İlanları da önden yükle
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- DATA FETCHING METHODS ---
  const fetchAiMatches = async (
    token,
    candidateId,
    filters = candidateFilters,
  ) => {
    try {
      const params = new URLSearchParams();
      if (filters.work_type) params.append("work_type", filters.work_type);
      if (filters.location) params.append("location", filters.location);
      if (filters.min_score) params.append("min_score", filters.min_score);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/matches/candidate/${candidateId}?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setAiMatches(data.matches || []);
      }
    } catch (err) {
      console.error("AI Eşleşmeleri çekilirken hata:", err);
    }
  };

  const handleCandidateFilterChange = (key, value) => {
    const newFilters = { ...candidateFilters, [key]: value };
    setCandidateFilters(newFilters);
    fetchAiMatches(localStorage.getItem("token"), userProfileId, newFilters);
  };

  const handleCompanyFilterChange = (key, value) => {
    const newFilters = { ...companyFilters, [key]: value };
    setCompanyFilters(newFilters);
    fetchIncomingApplications(localStorage.getItem("token"), newFilters);
  };

  const fetchMyApplications = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/applications/candidate`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setMyApplications(data.applications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyOffers = async () => {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/applications/candidate/offers`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setMyOffers(data.offers || []);
      }
    } catch (err) {
      console.error("Teklifler çekilirken hata:", err);
    }
  };

  const handleOfferRespond = async (appId, status) => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/applications/${appId}/respond`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      if (response.ok) {
        alert(status === 'accepted' ? 'Teklif Kabul Edildi!' : 'Teklif Reddedildi.');
        fetchMyOffers();
        // My Applications state'ini de güncelle ki sekmeyi değiştirirse son durumu görsün
        fetchMyApplications(); 
      } else {
        const err = await response.json();
        alert(err.error || "İşlem başarısız.");
      }
    } catch (error) {
      alert("Sunucu ile bağlantı kurulamadı.");
    }
  };

  const fetchIncomingApplications = async (
    token = localStorage.getItem("token"),
    filters = companyFilters,
  ) => {
    try {
      const params = new URLSearchParams();
      if (filters.location) params.append("location", filters.location);
      if (filters.min_score) params.append("min_score", filters.min_score);

      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/applications/company?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setIncomingApplications(data.applications || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMyJobs = async (token = localStorage.getItem("token")) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/jobs/company`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Şirket ilanları çekilirken hata:", err);
    }
  };

  // --- TAB CHANGING LOGIC ---
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedJobId(null); // Sekme değiştiğinde detayı sıfırla
    setEditJobForm(null);
    setAiRecommendedCandidates([]);
    setExpandedCandidateJobId(null); // Expand statelerini temizle
    setExpandedAppId(null);
    if (tab === "my_applications") fetchMyApplications();
    if (tab === "incoming_offers") fetchMyOffers();
    if (tab === "incoming_applications") fetchIncomingApplications();
    if (tab === "my_jobs") fetchMyJobs();
  };

  // --- ACTION METHODS (APPLY & POST JOB) ---
  const handleApplyJob = async (jobId) => {
    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (response.ok) {
        alert("Başvurunuz başarıyla iletildi!");
        // Eşleşmeleri tekrar çek veya direkt o kartı kaldır
        fetchAiMatches(token, userProfileId);
      } else {
        const err = await response.json();
        alert(err.error || "Başvuru sırasında hata oluştu.");
      }
    } catch (error) {
      alert("Başvuru yapılamadı.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (appId, newStatus) => {
    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/applications/${appId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (res.ok) {
        fetchIncomingApplications(token);
      } else {
        alert("Durum güncellenirken hata oluştu.");
      }
    } catch (err) {
      alert("İşlem başarısız.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMakeOffer = async (candidateId, offerJobId = createdJobId) => {
    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/applications/offer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ candidate_id: candidateId, job_id: offerJobId }),
      });
      if (res.ok) {
        alert("Yapay Zeka üzerinden teklif başarıyla iletildi!");
        setJobMatches((prev) => prev.filter((m) => m.user_id !== candidateId));
        setAiRecommendedCandidates((prev) =>
          prev.filter((m) => m.user_id !== candidateId),
        );
      } else {
        const err = await res.json();
        alert(err.error || "Teklif gönderilemedi.");
      }
    } catch (err) {
      alert("Teklif işlemi başarısız.");
    } finally {
      setActionLoading(false);
    }
  };

  const fetchAiRecommendations = async (jobId, token) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/matches/job/${jobId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setAiRecommendedCandidates(data.matches || []);
      }
    } catch (err) {
      console.error("AI Önerileri alınamadı", err);
    }
  };

  const handleJobSelect = (jobId) => {
    setSelectedJobId(jobId);
    const job = myJobs.find((j) => j.id === jobId);
    if (job) {
      setEditJobForm({
        title: job.title,
        description: job.description,
        work_type: job.work_type,
        location: job.location,
      });
    }
    fetchAiRecommendations(jobId, localStorage.getItem("token"));
  };

  const handleUpdateJob = async (e) => {
    e.preventDefault();
    setReIndexing(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/jobs/${selectedJobId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(editJobForm),
        },
      );
      if (response.ok) {
        alert("İlan başarıyla güncellendi ve yeniden indekslendi.");
        fetchMyJobs(token);
        fetchAiRecommendations(selectedJobId, token);
      } else {
        const err = await response.json();
        alert(err.error || "İlan güncellenemedi.");
      }
    } catch (error) {
      alert("İşlem başarısız oldu.");
    } finally {
      setReIndexing(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Bu ilanı ve ilana yapılan tüm başvuruları silmek istediğinize emin misiniz?")) {
      return;
    }
    
    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        alert("İlan başarıyla silindi.");
        setSelectedJobId(null);
        setEditJobForm(null);
        setAiRecommendedCandidates([]);
        fetchMyJobs(token);
      } else {
        const err = await response.json();
        alert(err.error || "İlan silinemedi.");
      }
    } catch (error) {
      alert("Silme işlemi başarısız oldu.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostJob = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobForm),
      });
      if (response.ok) {
        const data = await response.json();
        setJobForm({
          title: "",
          description: "",
          work_type: "onsite",
          location: "",
        });

        // AI Analizi başlat
        setCreatedJobId(data.jobId);
        analyzeJobMatches(data.jobId, token);
      } else {
        const err = await response.json();
        alert(err.error || "İlan yayınlanamadı.");
      }
    } catch (error) {
      alert("İlan yayınlama işlemi başarısız.");
    } finally {
      setActionLoading(false);
    }
  };

  const analyzeJobMatches = async (jobId, token) => {
    setAnalyzingMatches(true);
    try {
      // 1.5 saniyelik görsel animasyon gecikmesi
      setTimeout(async () => {
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/api/matches/job/${jobId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (res.ok) {
          const data = await res.json();
          setJobMatches(data.matches || []);
          setActiveTab("job_matches_result");
        }
        setAnalyzingMatches(false);
      }, 1500);
    } catch (err) {
      setAnalyzingMatches(false);
      handleTabChange("my_jobs");
    }
  };

  const submitOnboarding = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const token = localStorage.getItem("token");
    let payload = {};
    if (role === "candidate") {
      const resumeText =
        `Eğitim:\n${candidateForm.education}\n\nDeneyimler:\n${candidateForm.experience}\n\nProjeler:\n${candidateForm.projects}\n\nYetenekler:\n${candidateForm.skills}`.trim();
      payload = {
        details: {
          full_name: candidateForm.full_name,
          phone: candidateForm.phone,
          location: candidateForm.location,
        },
        resumeText: resumeText,
      };
    } else if (role === "company") {
      payload = { details: { ...companyForm } };
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profiles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Güncelleme başarısız oldu.");

      setIsOnboarding(false);
      fetchProfileData(token, role);
    } catch (error) {
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    const token = localStorage.getItem("token");

    const resumeText =
      `Eğitim:\n${candidateForm.education}\n\nDeneyimler:\n${candidateForm.experience}\n\nProjeler:\n${candidateForm.projects}\n\nYetenekler:\n${candidateForm.skills}`.trim();

    const payload = {
      details: {
        full_name: candidateForm.full_name,
        phone: candidateForm.phone,
        location: candidateForm.location,
      },
      resumeText: resumeText,
    };

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/profiles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Güncelleme başarısız oldu.");

      alert("Profiliniz ve vektörünüz başarıyla güncellendi!");
      fetchProfileData(token, "candidate");
    } catch (error) {
      alert("Bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userRole");
    navigate("/login");
  };

  if (loading)
    return (
      <div
        className="dashboard-container"
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        <div className="cyber-spinner"></div>
      </div>
    );

  if (isOnboarding) {
    return (
      <div className="onboarding-container">
        {isSubmitting && (
          <div className="ai-loading-overlay">
            <div className="cyber-spinner"></div>
            <h3>Yapay Zeka Devrede</h3>
            <p>Profiliniz analiz ediliyor ve vektör uzayına işleniyor...</p>
          </div>
        )}
        <div className="onboarding-card">
          <h2>Profilini Tamamla</h2>
          <p className="subtitle">
            Sistemin senin için en iyi sonuçları üretmesi için bilgileri gir.
          </p>
          <form className="cyber-form" onSubmit={submitOnboarding}>
            {role === "candidate" && (
              <>
                <div className="form-group">
                  <label>Ad Soyad</label>
                  <input
                    type="text"
                    name="full_name"
                    value={candidateForm.full_name}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        full_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    type="tel"
                    name="phone"
                    value={candidateForm.phone}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        phone: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Konum</label>
                  <input
                    type="text"
                    name="location"
                    value={candidateForm.location}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        location: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Eğitim Bilgileri</label>
                  <textarea
                    name="education"
                    value={candidateForm.education}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        education: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Deneyimler</label>
                  <textarea
                    name="experience"
                    value={candidateForm.experience}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        experience: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Projeler</label>
                  <textarea
                    name="projects"
                    value={candidateForm.projects}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        projects: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Yetenekler (Virgülle ayırın)</label>
                  <input
                    type="text"
                    name="skills"
                    value={candidateForm.skills}
                    onChange={(e) =>
                      setCandidateForm({
                        ...candidateForm,
                        skills: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </>
            )}
            {role === "company" && (
              <>
                <div className="form-group full-width">
                  <label>Şirket Adı</label>
                  <input
                    type="text"
                    name="company_name"
                    value={companyForm.company_name}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        company_name: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Sektör</label>
                  <input
                    type="text"
                    name="industry"
                    value={companyForm.industry}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        industry: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Web Sitesi</label>
                  <input
                    type="url"
                    name="website"
                    value={companyForm.website}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        website: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="form-group full-width">
                  <label>Şirket Tanımı</label>
                  <textarea
                    name="description"
                    value={companyForm.description}
                    onChange={(e) =>
                      setCompanyForm({
                        ...companyForm,
                        description: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </>
            )}
            <button type="submit" className="cyber-btn" disabled={isSubmitting}>
              {isSubmitting ? "İşleniyor..." : "Profili Tamamla"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDER CANDIDATE TABS ---
  const getStatusBadge = (status) => {
    if (status === "shortlisted") {
      return (
        <span
          className="status-badge"
          style={{
            backgroundColor: "#cbd5e1",
            color: "#2563eb",
            border: "1px solid #2563eb",
            boxShadow: "0 0 10px rgba(37, 99, 235, 0.5)",
          }}
        >
          GÖRÜŞME AYARLANDI
        </span>
      );
    }
    if (status === "offered") {
      return (
        <span
          className="status-badge"
          style={{
            backgroundColor: "rgba(220, 38, 38, 0.1)",
            color: "#dc2626",
            border: "1px solid #dc2626",
            boxShadow: "0 0 10px rgba(220, 38, 38, 0.3)",
            width: "100%",
          }}
        >
          ŞİRKETTEN DAVET / TEKLİF ALDINIZ
        </span>
      );
    }
    return (
      <span className={`status-badge status-${status}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const renderCandidateDashboard = () => {
    if (activeTab === "overview") {
      return (
        <div className="cyber-list-container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h2 className="section-title" style={{ margin: 0 }}>
              AI Uyumlu İlanlar (Öneriler)
            </h2>
          </div>

          <div
            className="cyber-filter-bar"
            style={{
              display: "flex",
              gap: "15px",
              padding: "15px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginBottom: "20px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              className="filter-group"
              style={{ flex: 1, minWidth: "150px" }}
            >
              <label
                style={{
                  color: "#2563eb",
                  fontSize: "0.8rem",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Çalışma Türü
              </label>
              <select
                className="cyber-select"
                value={candidateFilters.work_type}
                onChange={(e) =>
                  handleCandidateFilterChange("work_type", e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #94a3b8",
                  color: "#1e293b",
                  borderRadius: "4px",
                }}
              >
                <option value="">Tümü</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div
              className="filter-group"
              style={{ flex: 1, minWidth: "150px" }}
            >
              <label
                style={{
                  color: "#2563eb",
                  fontSize: "0.8rem",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Şehir
              </label>
              <input
                type="text"
                placeholder="Örn: İstanbul"
                value={candidateFilters.location}
                onChange={(e) =>
                  handleCandidateFilterChange("location", e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #94a3b8",
                  color: "#1e293b",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div
              className="filter-group"
              style={{ flex: 1, minWidth: "200px" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <label
                  style={{
                    color: "#2563eb",
                    fontSize: "0.8rem",
                    display: "block",
                    marginBottom: "5px",
                  }}
                >
                  Min AI Skoru
                </label>
                <span style={{ color: "#1e293b", fontSize: "0.8rem" }}>
                  %{candidateFilters.min_score}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={candidateFilters.min_score}
                onChange={(e) =>
                  handleCandidateFilterChange("min_score", e.target.value)
                }
                style={{ width: "100%", accentColor: "#2563eb" }}
              />
            </div>
          </div>

          {aiMatches.length === 0 ? (
            <div className="placeholder-card">
              <p>
                Henüz sana uygun bir ilan bulunamadı. Yeni ilanlar eklendikçe
                burada belirecek.
              </p>
            </div>
          ) : (
            <div className="cyber-cards-grid">
              {aiMatches.map((job) => (
                <div key={job.id} className="cyber-job-card">
                  <div
                    className="card-header"
                    onClick={() =>
                      setExpandedCandidateJobId(
                        expandedCandidateJobId === job.id ? null : job.id,
                      )
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <h3>{job.title}</h3>
                    <div className="ai-score-badge">
                      <span className="score-label">AI UYUM SKORU</span>
                      <span className="score-value">
                        %{job.match_percentage}
                      </span>
                    </div>
                  </div>
                  <div className="card-body">
                    <span className="work-type-badge">
                      {job.work_type.toUpperCase()}
                    </span>
                    {expandedCandidateJobId === job.id && (
                      <div
                        className="job-details"
                        style={{
                          marginTop: "15px",
                          padding: "10px",
                          backgroundColor: "#f8fafc",
                          borderRadius: "5px",
                          borderLeft: "3px solid #2563eb",
                        }}
                      >
                        {job.company_details && (
                          <div
                            style={{
                              marginBottom: "15px",
                              paddingBottom: "10px",
                              borderBottom: "1px solid #e2e8f0",
                            }}
                          >
                            <strong
                              style={{
                                color: "#2563eb",
                                fontSize: "0.95rem",
                                display: "block",
                                marginBottom: "5px",
                              }}
                            >
                              {job.company_details.company_name}
                            </strong>
                            <div
                              style={{
                                display: "flex",
                                gap: "15px",
                                fontSize: "0.8rem",
                                color: "#64748b",
                              }}
                            >
                              <span>
                                🏢{" "}
                                {job.company_details.industry ||
                                  "Belirtilmemiş"}
                              </span>
                              {job.company_details.website && (
                                <span>
                                  🌐{" "}
                                  <a
                                    href={
                                      job.company_details.website.startsWith(
                                        "http",
                                      )
                                        ? job.company_details.website
                                        : `https://${job.company_details.website}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: "#2563eb",
                                      textDecoration: "none",
                                    }}
                                  >
                                    Web Sitesi
                                  </a>
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        <p
                          style={{
                            fontSize: "0.9rem",
                            color: "#475569",
                            marginBottom: "10px",
                            lineHeight: "1.4",
                          }}
                        >
                          {job.description}
                        </p>
                        {job.parsed_requirements && (
                          <div style={{ marginTop: "10px" }}>
                            <strong
                              style={{ color: "#2563eb", fontSize: "0.85rem" }}
                            >
                              Öne Çıkan Yetenekler:
                            </strong>
                            <p
                              style={{
                                fontSize: "0.85rem",
                                color: "#64748b",
                                marginTop: "5px",
                              }}
                            >
                              {job.parsed_requirements}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="card-footer">
                    <button
                      className="cyber-btn-small"
                      onClick={() => handleApplyJob(job.id)}
                    >
                      Başvur
                    </button>
                    <button
                      className="cyber-btn-small outline"
                      onClick={() =>
                        setExpandedCandidateJobId(
                          expandedCandidateJobId === job.id ? null : job.id,
                        )
                      }
                    >
                      {expandedCandidateJobId === job.id
                        ? "Daralt"
                        : "Detaylar"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (activeTab === "my_applications") {
      return (
        <div className="cyber-list-container">
          <h2 className="section-title">Başvurularım</h2>
          {myApplications.length === 0 ? (
            <div className="placeholder-card">
              <p>Henüz bir ilana başvurmadınız.</p>
            </div>
          ) : (
            <div className="cyber-cards-grid">
              {myApplications.map((app) => (
                <div
                  key={app.id}
                  className="cyber-job-card"
                  style={
                    app.status === "offered"
                      ? {
                          border: "1px solid #dc2626",
                          boxShadow: "0 0 15px rgba(220, 38, 38, 0.2)",
                        }
                      : {}
                  }
                >
                  <div className="card-header">
                    <h3>{app.job_postings?.title}</h3>
                  </div>
                  <div className="card-body">
                    {getStatusBadge(app.status)}
                    <span
                      className="work-type-badge"
                      style={{ marginTop: "10px", display: "inline-block" }}
                    >
                      {app.job_postings?.work_type?.toUpperCase() ||
                        "BİLİNMİYOR"}
                    </span>
                    <p className="date-text">
                      {new Date(app.created_at).toLocaleDateString("tr-TR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (activeTab === "incoming_offers") {
      return (
        <div className="cyber-list-container">
          <h2 className="section-title">Gelen Teklifler</h2>
          {myOffers.length === 0 ? (
            <div className="placeholder-card">
              <p>Henüz size yapılmış bir iş teklifi bulunmuyor.</p>
            </div>
          ) : (
            <div className="cyber-cards-grid">
              {myOffers.map((offer) => (
                <div key={offer.id} className="cyber-job-card" style={{ border: "1px solid #2563eb", boxShadow: "0 4px 6px rgba(37, 99, 235, 0.1)" }}>
                  <div className="card-header">
                    <h3>{offer.company_name}</h3>
                    <span className="badge" style={{ backgroundColor: "#10b981", color: "white" }}>Yeni Teklif</span>
                  </div>
                  <div className="card-body">
                    <p style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "8px", color: "#1e293b" }}>{offer.job_title}</p>
                    <p style={{ fontSize: "0.9rem", color: "#475569", marginBottom: "5px" }}>📍 Konum: {offer.location}</p>
                    <p style={{ fontSize: "0.9rem", color: "#475569", marginBottom: "15px" }}>💼 Çalışma Türü: {offer.work_type?.toUpperCase()}</p>
                  </div>
                  <div className="card-footer" style={{ display: "flex", gap: "10px" }}>
                    <button 
                      className="cyber-btn-small" 
                      style={{ flex: 1, backgroundColor: "#10b981", borderColor: "#10b981" }}
                      onClick={() => handleOfferRespond(offer.id, 'accepted')}
                    >
                      Kabul Et
                    </button>
                    <button 
                      className="cyber-btn-small outline" 
                      style={{ flex: 1, color: "#dc2626", borderColor: "#dc2626" }}
                      onClick={() => handleOfferRespond(offer.id, 'rejected')}
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (activeTab === "update_profile") {
      return (
        <div className="cyber-list-container">
          <h2 className="section-title">Özgeçmişimi Güncelle</h2>
          <div className="onboarding-card" style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
            <p className="subtitle" style={{ marginBottom: "20px" }}>
              Bilgilerini güncellediğinde, yapay zeka yeni metinlerini analiz edip vektörünü yenileyecektir.
            </p>
            <form className="cyber-form" onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label>Ad Soyad</label>
                <input
                  type="text"
                  value={candidateForm.full_name}
                  onChange={(e) => setCandidateForm({ ...candidateForm, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Telefon</label>
                <input
                  type="tel"
                  value={candidateForm.phone}
                  onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group full-width">
                <label>Konum</label>
                <input
                  type="text"
                  value={candidateForm.location}
                  onChange={(e) => setCandidateForm({ ...candidateForm, location: e.target.value })}
                  required
                />
              </div>

              <div className="form-group full-width">
                <label>Eğitim Bilgileri</label>
                <textarea
                  value={candidateForm.education}
                  onChange={(e) => setCandidateForm({ ...candidateForm, education: e.target.value })}
                  required
                />
              </div>
              <div className="form-group full-width">
                <label>Deneyimler</label>
                <textarea
                  value={candidateForm.experience}
                  onChange={(e) => setCandidateForm({ ...candidateForm, experience: e.target.value })}
                  required
                />
              </div>
              <div className="form-group full-width">
                <label>Projeler</label>
                <textarea
                  value={candidateForm.projects}
                  onChange={(e) => setCandidateForm({ ...candidateForm, projects: e.target.value })}
                  required
                />
              </div>
              <div className="form-group full-width">
                <label>Yetenekler (Virgülle ayırın)</label>
                <input
                  type="text"
                  value={candidateForm.skills}
                  onChange={(e) => setCandidateForm({ ...candidateForm, skills: e.target.value })}
                  required
                />
              </div>
              
              <button type="submit" className="cyber-btn" disabled={actionLoading} style={{ marginTop: "15px" }}>
                {actionLoading ? "Yapay Zeka Devrede..." : "Güncelle ve Vektörü Yenile"}
              </button>
            </form>
          </div>
        </div>
      );
    }
  };

  // --- RENDER COMPANY TABS ---
  const renderCompanyDashboard = () => {
    if (activeTab === "incoming_applications") {
      return (
        <div className="cyber-list-container">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "15px",
            }}
          >
            <h2 className="section-title" style={{ margin: 0 }}>
              Gelen Başvurular
            </h2>
          </div>

          <div
            className="cyber-filter-bar"
            style={{
              display: "flex",
              gap: "15px",
              padding: "15px",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              marginBottom: "20px",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <div
              className="filter-group"
              style={{ flex: 1, minWidth: "200px" }}
            >
              <label
                style={{
                  color: "#2563eb",
                  fontSize: "0.8rem",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Aday Şehri
              </label>
              <input
                type="text"
                placeholder="Örn: Ankara"
                value={companyFilters.location}
                onChange={(e) =>
                  handleCompanyFilterChange("location", e.target.value)
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: "#ffffff",
                  border: "1px solid #94a3b8",
                  color: "#1e293b",
                  borderRadius: "4px",
                }}
              />
            </div>
            <div
              className="filter-group"
              style={{ flex: 1, minWidth: "250px" }}
            >
              <button
                className="cyber-btn"
                style={{
                  width: "100%",
                  padding: "10px",
                  ...(companyFilters.min_score === 80
                    ? {
                        backgroundColor: "#cbd5e1",
                        border: "1px solid #2563eb",
                        color: "#2563eb",
                      }
                    : {}),
                }}
                onClick={() =>
                  handleCompanyFilterChange(
                    "min_score",
                    companyFilters.min_score === 80 ? 0 : 80,
                  )
                }
              >
                {companyFilters.min_score === 80
                  ? "⭐ Sadece Yüksek Skorlular Açık"
                  : "Yüksek Skorlu Adayları Göster"}
              </button>
            </div>
          </div>

          {incomingApplications.length === 0 ? (
            <div className="placeholder-card">
              <p>Henüz yayınladığınız ilanlara başvuru gelmemiş.</p>
            </div>
          ) : (
            <div className="cyber-cards-grid">
              {incomingApplications.map((app) => (
                <div key={app.id} className="cyber-job-card">
                  <div className="card-header">
                    <h3>{app.profiles?.fullname || "Aday İsmi Yok"}</h3>
                    <div className="ai-score-badge">
                      <span className="score-label">Aday Uyumu</span>
                      <span className="score-value">%{app.ai_score || 85}</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <p className="job-title-text">
                      İlan:{" "}
                      <strong>
                        {app.job_title || app.job_postings?.title}
                      </strong>
                    </p>
                    {getStatusBadge(app.status)}

                    {expandedAppId === app.id && (
                      <div
                        className="candidate-details"
                        style={{
                          marginTop: "15px",
                          padding: "10px",
                          backgroundColor: "#f8fafc",
                          borderRadius: "5px",
                          borderLeft: "3px solid #2563eb",
                        }}
                      >
                        <div
                          style={{
                            marginBottom: "15px",
                            paddingBottom: "10px",
                            borderBottom: "1px solid #e2e8f0",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "10px",
                            fontSize: "0.85rem",
                          }}
                        >
                          <div style={{ color: "#475569" }}>
                            <strong style={{ color: "#2563eb" }}>
                              📧 E-Posta:
                            </strong>{" "}
                            {app.candidate_email}
                          </div>
                          <div style={{ color: "#475569" }}>
                            <strong style={{ color: "#2563eb" }}>
                              📱 Telefon:
                            </strong>{" "}
                            {app.candidate_phone}
                          </div>
                          <div
                            style={{ color: "#475569", gridColumn: "span 2" }}
                          >
                            <strong style={{ color: "#2563eb" }}>
                              📍 Konum:
                            </strong>{" "}
                            {app.candidate_location}
                          </div>
                        </div>

                        <strong
                          style={{ color: "#2563eb", fontSize: "0.85rem" }}
                        >
                          Özgeçmiş Detayları:
                        </strong>
                        <pre
                          style={{
                            fontSize: "0.85rem",
                            color: "#475569",
                            whiteSpace: "pre-wrap",
                            marginTop: "8px",
                            fontFamily: "inherit",
                            lineHeight: "1.4",
                          }}
                        >
                          {app.candidate_resume ||
                            "Aday özgeçmişini doldurmamış."}
                        </pre>
                      </div>
                    )}
                  </div>
                  <div
                    className="card-footer"
                    style={{ display: "flex", gap: "10px" }}
                  >
                    {app.status === "pending" && (
                      <button
                        className="cyber-btn-small"
                        style={{ flex: 1 }}
                        onClick={() =>
                          handleUpdateStatus(app.id, "shortlisted")
                        }
                      >
                        Görüşme Sağla
                      </button>
                    )}
                    <button
                      className="cyber-btn-small outline"
                      style={{ flex: 1 }}
                      onClick={() =>
                        setExpandedAppId(
                          expandedAppId === app.id ? null : app.id,
                        )
                      }
                    >
                      {expandedAppId === app.id ? "Gizle" : "Profili İncele"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    } else if (activeTab === "job_matches_result") {
      return (
        <div className="cyber-list-container">
          <h2 className="section-title" style={{ color: "#2563eb" }}>
            Bu İlan İçin Önerilen En İyi Yapay Zekâ Adayları
          </h2>
          {jobMatches.length === 0 ? (
            <div className="placeholder-card">
              <p>Bu ilana uygun yeterli skor alan bir aday bulunamadı.</p>
              <button
                className="cyber-btn outline"
                style={{ marginTop: "15px" }}
                onClick={() => handleTabChange("my_jobs")}
              >
                İlanlarıma Git
              </button>
            </div>
          ) : (
            <>
              <div className="cyber-cards-grid">
                {jobMatches.map((cand) => (
                  <div key={cand.user_id} className="cyber-job-card">
                    <div className="card-header">
                      <h3>{cand.full_name}</h3>
                      <div className="ai-score-badge">
                        <span className="score-label">AI UYUM SKORU</span>
                        <span className="score-value">
                          %{cand.match_percentage}
                        </span>
                      </div>
                    </div>
                    <div className="card-body">
                      <p
                        style={{
                          fontSize: "0.85rem",
                          color: "#475569",
                          marginBottom: "5px",
                        }}
                      >
                        📍 Konum: {cand.location}
                      </p>
                      <strong style={{ color: "#2563eb", fontSize: "0.85rem" }}>
                        Aday Özgeçmişi:
                      </strong>
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px",
                          backgroundColor: "#f8fafc",
                          borderRadius: "5px",
                          maxHeight: "150px",
                          overflowY: "auto",
                        }}
                      >
                        <pre
                          style={{
                            fontSize: "0.8rem",
                            color: "#475569",
                            whiteSpace: "pre-wrap",
                            fontFamily: "inherit",
                          }}
                        >
                          {cand.parsed_text}
                        </pre>
                      </div>
                    </div>
                    <div className="card-footer">
                      <button
                        className="cyber-btn-small"
                        style={{
                          backgroundColor: "rgba(220, 38, 38, 0.1)",
                          color: "#dc2626",
                          border: "1px solid #dc2626",
                          width: "100%",
                        }}
                        onClick={() => handleMakeOffer(cand.user_id)}
                      >
                        AI İş Teklifi Gönder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "20px", textAlign: "center" }}>
                <button
                  className="cyber-btn outline"
                  onClick={() => handleTabChange("my_jobs")}
                >
                  İlanlarıma Dön
                </button>
              </div>
            </>
          )}
        </div>
      );
    } else if (activeTab === "create_job") {
      return (
        <div
          className="onboarding-card"
          style={{ maxWidth: "800px", margin: "0 auto" }}
        >
          <h2>Yeni İlan Yayınla</h2>
          <p className="subtitle">
            Yapay zeka motoru, iş ilanınızı saniyeler içinde analiz edip vektör
            havuzuna katacak.
          </p>
          <form className="cyber-form" onSubmit={handlePostJob}>
            <div className="form-group full-width">
              <label>İlan Başlığı</label>
              <input
                type="text"
                value={jobForm.title}
                onChange={(e) =>
                  setJobForm({ ...jobForm, title: e.target.value })
                }
                required
                placeholder="Örn: Senior Frontend Developer"
              />
            </div>
            <div className="form-group full-width">
              <label>Çalışma Türü</label>
              <select
                value={jobForm.work_type}
                onChange={(e) =>
                  setJobForm({ ...jobForm, work_type: e.target.value })
                }
                className="cyber-select"
              >
                <option value="remote">Remote (Uzaktan)</option>
                <option value="hybrid">Hybrid (Hibrit)</option>
                <option value="onsite">On-site (Ofisten)</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label>Şehir / Konum</label>
              <input
                type="text"
                value={jobForm.location}
                onChange={(e) =>
                  setJobForm({ ...jobForm, location: e.target.value })
                }
                required
                placeholder="Örn: İstanbul"
              />
            </div>
            <div className="form-group full-width">
              <label>İş Tanımı & Gereksinimler</label>
              <textarea
                value={jobForm.description}
                onChange={(e) =>
                  setJobForm({ ...jobForm, description: e.target.value })
                }
                required
                placeholder="Pozisyondan beklentilerinizi, aradığınız yetenekleri ve sorumlulukları detaylıca yazın..."
              ></textarea>
            </div>
            <button
              type="submit"
              className="cyber-btn"
              disabled={actionLoading}
            >
              {actionLoading
                ? "Yapay Zeka Analiz Ediyor..."
                : "Yayınla ve İndeksle"}
            </button>
          </form>
        </div>
      );
    } else if (activeTab === "my_jobs") {
      if (selectedJobId && editJobForm) {
        const selectedJob = myJobs.find((j) => j.id === selectedJobId);
        const jobApplicants = incomingApplications.filter(
          (app) => app.job_id === selectedJobId,
        );

        return (
          <div className="cyber-list-container">
            <button
              className="cyber-btn-small outline"
              onClick={() => {
                setSelectedJobId(null);
                setEditJobForm(null);
                setAiRecommendedCandidates([]);
              }}
              style={{ marginBottom: "20px", width: "fit-content" }}
            >
              &larr; İlanlarıma Dön
            </button>
            <h2 className="section-title" style={{ color: "#2563eb" }}>
              {selectedJob?.title} - İlan Yönetimi
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "30px",
                alignItems: "start",
              }}
            >
              {/* Sol Kolon: İlan Düzenleme Formu */}
              <div
                className="onboarding-card"
                style={{ margin: 0, padding: "20px" }}
              >
                <h3 style={{ color: "#1e293b", marginBottom: "15px" }}>
                  İlan Detayları ve Düzenle
                </h3>
                <form className="cyber-form" onSubmit={handleUpdateJob}>
                  <div className="form-group full-width">
                    <label>İlan Başlığı</label>
                    <input
                      type="text"
                      value={editJobForm.title}
                      onChange={(e) =>
                        setEditJobForm({
                          ...editJobForm,
                          title: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Çalışma Türü</label>
                    <select
                      value={editJobForm.work_type}
                      onChange={(e) =>
                        setEditJobForm({
                          ...editJobForm,
                          work_type: e.target.value,
                        })
                      }
                      className="cyber-select"
                    >
                      <option value="remote">Remote</option>
                      <option value="hybrid">Hybrid</option>
                      <option value="onsite">On-site</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Şehir / Konum</label>
                    <input
                      type="text"
                      value={editJobForm.location}
                      onChange={(e) =>
                        setEditJobForm({
                          ...editJobForm,
                          location: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>İş Tanımı & Gereksinimler</label>
                    <textarea
                      value={editJobForm.description}
                      onChange={(e) =>
                        setEditJobForm({
                          ...editJobForm,
                          description: e.target.value,
                        })
                      }
                      required
                      rows="8"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="cyber-btn"
                    disabled={reIndexing}
                  >
                    {reIndexing
                      ? "Yeniden İndeksleniyor..."
                      : "Güncelle ve Yeniden İndeksle"}
                  </button>
                  <button
                    type="button"
                    className="cyber-btn outline"
                    style={{ marginTop: "15px", width: "100%", borderColor: "#dc2626", color: "#dc2626" }}
                    onClick={() => handleDeleteJob(selectedJobId)}
                    disabled={reIndexing || actionLoading}
                  >
                    İlanı Sil
                  </button>
                </form>
              </div>

              {/* Sağ Kolon: AI Önerileri ve Başvurular */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "30px",
                }}
              >
                {/* Bölüm 1: AI Önerileri */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    padding: "20px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                  }}
                >
                  <h3
                    style={{
                      color: "#dc2626",
                      marginBottom: "15px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span>🤖</span> AI Önerilen Adaylar
                  </h3>
                  {aiRecommendedCandidates.length === 0 ? (
                    <p style={{ fontSize: "0.9rem", color: "#64748b" }}>
                      Bu ilana uygun güçlü bir eşleşme henüz bulunamadı.
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                      }}
                    >
                      {aiRecommendedCandidates.slice(0, 5).map((cand) => (
                        <div
                          key={cand.user_id}
                          style={{
                            backgroundColor: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            padding: "15px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                            }}
                          >
                            <div>
                              <strong
                                style={{ color: "#1e293b", display: "block" }}
                              >
                                {cand.full_name}
                              </strong>
                              <span
                                style={{ fontSize: "0.8rem", color: "#64748b" }}
                              >
                                📍 {cand.location}
                              </span>
                            </div>
                            <span
                              style={{
                                backgroundColor: "rgba(220, 38, 38, 0.1)",
                                color: "#dc2626",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "0.8rem",
                                fontWeight: "bold",
                              }}
                            >
                              %{cand.match_percentage} Uyum
                            </span>
                          </div>
                          <button
                            className="cyber-btn-small"
                            style={{
                              backgroundColor: "#dc2626",
                              borderColor: "#dc2626",
                            }}
                            onClick={() =>
                              handleMakeOffer(cand.user_id, selectedJobId)
                            }
                          >
                            İş Teklifi Gönder
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bölüm 2: Mevcut Başvurular */}
                <div>
                  <h3 style={{ color: "#2563eb", marginBottom: "15px" }}>
                    Gelen Başvurular
                  </h3>
                  {jobApplicants.length === 0 ? (
                    <div
                      className="placeholder-card"
                      style={{ padding: "20px" }}
                    >
                      <p>Henüz başvuru yok.</p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px",
                      }}
                    >
                      {jobApplicants.map((app) => (
                        <div
                          key={app.id}
                          style={{
                            backgroundColor: "#fff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "8px",
                            padding: "15px",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "10px",
                            }}
                          >
                            <strong style={{ color: "#1e293b" }}>
                              {app.candidate_name ||
                                app.profiles?.fullname ||
                                "İsimsiz Aday"}
                            </strong>
                            <span
                              style={{
                                color: "#2563eb",
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                              }}
                            >
                              %{app.ai_score || 85} Uyum
                            </span>
                          </div>
                          <div style={{ marginBottom: "10px" }}>
                            {getStatusBadge(app.status)}
                          </div>
                          <div style={{ display: "flex", gap: "10px" }}>
                            {app.status === "pending" && (
                              <button
                                className="cyber-btn-small"
                                style={{ flex: 1, padding: "5px" }}
                                onClick={() =>
                                  handleUpdateStatus(app.id, "shortlisted")
                                }
                              >
                                Görüşme
                              </button>
                            )}
                            <button
                              className="cyber-btn-small outline"
                              style={{ flex: 1, padding: "5px" }}
                              onClick={() =>
                                setExpandedAppId(
                                  expandedAppId === app.id ? null : app.id,
                                )
                              }
                            >
                              {expandedAppId === app.id ? "Gizle" : "İncele"}
                            </button>
                          </div>
                          {expandedAppId === app.id && (
                            <div
                              style={{
                                marginTop: "10px",
                                paddingTop: "10px",
                                borderTop: "1px solid #e2e8f0",
                                fontSize: "0.85rem",
                                color: "#475569",
                              }}
                            >
                              <p>
                                <strong>E-Posta:</strong> {app.candidate_email}
                              </p>
                              <p>
                                <strong>Telefon:</strong> {app.candidate_phone}
                              </p>
                              <div
                                style={{
                                  marginTop: "5px",
                                  maxHeight: "100px",
                                  overflowY: "auto",
                                  backgroundColor: "#f8fafc",
                                  padding: "5px",
                                  borderRadius: "4px",
                                }}
                              >
                                <pre
                                  style={{
                                    fontFamily: "inherit",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {app.candidate_resume || "CV Yok"}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="cyber-list-container">
          <h2 className="section-title">İlanlarım</h2>
          {myJobs.length === 0 ? (
            <div className="placeholder-card">
              <p>Henüz bir ilan yayınlamadınız.</p>
            </div>
          ) : (
            <div className="cyber-cards-grid">
              {myJobs.map((job) => {
                const appCount = incomingApplications.filter(
                  (app) => app.job_id === job.id,
                ).length;
                return (
                  <div
                    key={job.id}
                    className="cyber-job-card interactive-card"
                    onClick={() => handleJobSelect(job.id)}
                    style={{
                      cursor: "pointer",
                      border: "1px solid #cbd5e1",
                      transition: "all 0.3s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.border = "1px solid #2563eb")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.border = "1px solid #cbd5e1")
                    }
                  >
                    <div className="card-header">
                      <h3>{job.title}</h3>
                      <span
                        className="badge"
                        style={{ backgroundColor: "#e2e8f0", color: "#2563eb" }}
                      >
                        {appCount} Başvuru
                      </span>
                    </div>
                    <div className="card-body">
                      <span className="work-type-badge">
                        {job.work_type.toUpperCase()}
                      </span>
                      <p className="date-text" style={{ marginTop: "10px" }}>
                        Yayınlanma:{" "}
                        {new Date(job.created_at).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                    <div className="card-footer">
                      <button className="cyber-btn-small">Detayları Gör</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="dashboard-container">
      {(actionLoading || reIndexing) && (
        <div className="ai-loading-overlay">
          <div className="cyber-spinner"></div>
          <h3>Yapay Zeka Devrede</h3>
          <p>
            {reIndexing
              ? "İlan yeniden analiz ediliyor ve vektör güncelleniyor..."
              : "Lütfen bekleyin, verileriniz işleniyor..."}
          </p>
        </div>
      )}
      {analyzingMatches && (
        <div className="ai-loading-overlay">
          <div className="cyber-spinner"></div>
          <h3 style={{ color: "#2563eb", marginTop: "20px" }}>
            AI Eşleşen Adaylar Analiz Ediliyor...
          </h3>
          <p>Lütfen bekleyin, vektör havuzu taranıyor...</p>
        </div>
      )}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>AI-HR Match</h2>
          <span className="badge">
            {role === "company" ? "Şirket Paneli" : "Aday Paneli"}
          </span>
        </div>
        <nav className="sidebar-nav">
          {role === "candidate" && (
            <>
              <button
                className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
                onClick={() => handleTabChange("overview")}
              >
                AI Uyumlu İlanlar
              </button>
              <button
                className={`nav-item ${activeTab === "my_applications" ? "active" : ""}`}
                onClick={() => handleTabChange("my_applications")}
              >
                Başvurularım
              </button>
              <button
                className={`nav-item ${activeTab === "incoming_offers" ? "active" : ""}`}
                onClick={() => handleTabChange("incoming_offers")}
              >
                Gelen Teklifler
              </button>
              <button
                className={`nav-item ${activeTab === "update_profile" ? "active" : ""}`}
                onClick={() => handleTabChange("update_profile")}
              >
                Özgeçmişimi Güncelle
              </button>
            </>
          )}
          {role === "company" && (
            <>
              <button
                className={`nav-item ${activeTab === "incoming_applications" ? "active" : ""}`}
                onClick={() => handleTabChange("incoming_applications")}
              >
                Gelen Başvurular
              </button>
              <button
                className={`nav-item ${activeTab === "my_jobs" ? "active" : ""}`}
                onClick={() => handleTabChange("my_jobs")}
              >
                İlanlarım
              </button>
              <button
                className={`nav-item ${activeTab === "create_job" ? "active" : ""}`}
                onClick={() => handleTabChange("create_job")}
              >
                İlan Yayınla
              </button>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            Çıkış Yap
          </button>
        </div>
      </aside>

      <main className="dashboard-content">
        {role === "candidate"
          ? renderCandidateDashboard()
          : renderCompanyDashboard()}
      </main>
    </div>
  );
};

export default Dashboard;
