# İK Platformu - Context Blueprint (Mimari ve Yapısal Çerçeve)

Bu döküman, projenin anlık (geliştirilmiş) durumunu yansıtan genel bir proje taslağıdır. Geliştirici ve takım arkadaşları için yüksek seviyeli mimari görünümü sağlar.

## 1. Proje Özeti
Bu proje, iş ilanları ve aday özgeçmişlerini yapay zeka (LLM ve Vektör Veritabanları) kullanarak anlamsal olarak eşleştiren, şirket ve adayları bir araya getiren yenilikçi bir İK eşleştirme platformudur.

## 2. Teknoloji Yığını (Tech Stack)

### Frontend (İstemci)
- **Kütüphane:** React (Vite)
- **Tasarım Dili:** Vanilla CSS (Kurumsal Light Theme: Mavi ve Bordo tonları, Cyberpunk esintileri)
- **Yönlendirme:** React Router DOM

### Backend (BFF - Backend For Frontend)
- **Çalışma Ortamı:** Node.js
- **Çatı:** Express.js
- **Kimlik Doğrulama:** JWT (JSON Web Token)

### AI Mikroservisi (Yapay Zeka)
- **Çalışma Ortamı:** Python
- **Çatı:** FastAPI
- **LLM Entegrasyonu:** Ollama üzerinden Llama 3.2 (Yetenek ve bağlam çıkarımı için)
- **Embedding:** SentenceTransformers (`all-MiniLM-L6-v2`) (384 boyutlu vektör oluşturma)
- **Matematik Motoru:** NumPy (Kosinüs Benzerliği - Cosine Similarity hesaplamaları)

### Veritabanı (BaaS)
- **Hizmet:** Supabase (PostgreSQL tabanlı)
- **Mimari:** Code-Level Join (Veritabanı bazlı Foreign Key yerine uygulama seviyesinde birleştirme prensibi - MVP için)
- **Güvenlik:** Service Role Key ile sunucu taraflı güvenli erişim

## 3. Veritabanı Şeması (Core Tables)
- `users`: Kimlik doğrulama (auth) tablosu.
- `profiles`: Ortak kullanıcı bilgileri (`id`, `email`, `role`, `created_at`, `fullname`).
- `candidate_profiles`: Aday detayları (`parsed_text`, `phone`, `location`, `education`, `experience`, `skills`, `embedding`).
- `company_profiles`: Şirket detayları (`industry`, `website`, `description`).
- `job_postings`: İş ilanları (`title`, `description`, `location`, `work_type`, `parsed_requirements`, `embedding`, `company_id`).
- `applications`: Başvuru kayıtları (`job_id`, `candidate_id`, `status`, `match_score`, `applied_at`).
- `skills` & `job_skills`: İlan yetenekleri için many-to-many tablo yapısı.

## 4. Temel İş Akışları (Workflows)
1. **İlan Oluşturma ve Düzenleme (Re-vectorization):**
   - Şirket ilanı oluşturur veya günceller. Node.js ilanı alır, Python mikroservisine gönderir.
   - Python metinden yetenek çıkarır ve 384 boyutlu vektör oluşturur. Yeni veriler Supabase'e kaydedilir.
2. **Aday Eşleştirme (Cosine Similarity):**
   - Şirket veya aday eşleşme görmek istediğinde, tüm vektörler Node.js üzerinden çekilir ve Python API'ye iletilir.
   - NumPy kullanılarak vektörler arası Kosinüs Benzerliği hesaplanır. Sonuçlar skor bazında sıralanıp dönülür.
3. **Otonom Teklif (Direct Job Offer):**
   - Şirket panelindeki *AI Önerilen Adaylar* listesinden, bir adaya doğrudan teklif (`offered` statüsünde başvuru) gönderilebilir.
4. **Başvuru Yönetimi (Dinamik Skorlama):**
   - Gelen başvurular listelendiğinde, başvuruların skorları statik veriden okunmaz. Python AI servisi aracılığıyla güncel aday ve ilan vektörleri karşılaştırılarak **anlık ve güncel eşleşme yüzdeleri** elde edilir.

## 5. Geliştirme ve Tasarım Prensipleri
- **KISS (Keep It Simple, Stupid):** MVP sürecinde aşırı kurumsal abstraksiyonlardan kaçınılır.
- **Güvenlik:** Node.js rotaları JWT (`authMiddleware`) ile korunur.
- **Kullanıcı Deneyimi (UX):** AI tabanlı uzun süren vektör işleme süreçlerinde ekrana bilgilendirici "Loading Spinner" (Yapay Zeka Devrede) yansıtılır. İşlem sırasında butonlar devre dışı bırakılarak olası aksaklıklar ve spam tıklamalar engellenir.
