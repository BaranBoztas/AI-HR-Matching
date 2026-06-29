/**
 * AI Service (Yapay Zeka Servis Entegrasyonu)
 * 
 * Bu modül, Node.js ana sunucusu (Backend) ile Python FastAPI tabanlı 
 * AI mikroservisi (localhost:8000) arasındaki iletişimi yönetir.
 * 
 * ES Module (import/export) standardında yazılmıştır ve modern Fetch API 
 * kullanılarak asenkron (async/await) ağ istekleri gerçekleştirir.
 */

// Python AI mikroservisinin kök URL'i.
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Gönderilen metinden (örneğin özgeçmiş veya iş ilanı) yetenekleri (skills) çıkarır.
 * Llama 3.2 (3B) modeli üzerinden çıkarım yapar.
 * 
 * @param {string} text - Analiz edilecek ham metin.
 * @param {string} type - Metnin türü ('candidate' veya 'company'). Varsayılan: 'candidate'.
 * @returns {Promise<Array<string>>} Çıkarılan yeteneklerin listesi (JSON dizisi).
 * @throws {Error} Ağ hatası, mikroservis kapalılık durumu (503) veya geçersiz veri (422) durumunda.
 */
export const extractSkills = async (text, type = 'candidate') => {
  try {
    // 1. Python mikroservisine POST isteği atıyoruz.
    // Gelen metni ve metin türünü JSON formatına dönüştürerek HTTP Body içerisine yerleştiriyoruz.
    const response = await fetch(`${AI_SERVICE_URL}/extract-skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, type }),
    });

    // 2. HTTP Durum Kodu (Status Code) Kontrolü ve Gelişmiş Hata Yönetimi
    // Eğer response 200-299 aralığında değilse (!response.ok), hataları özelleştiriyoruz.
    if (!response.ok) {
      if (response.status === 503) {
        console.error('[AI Service Error]: Model yükleniyor veya servis geçici olarak kullanılamıyor (503).');
        // Kullanıcıya/Frontend'e gösterilecek temiz hata mesajı fırlatıyoruz.
        throw new Error('Yapay zeka servisi şu anda meşgul veya başlatılıyor, lütfen daha sonra tekrar deneyin.');
      }
      
      if (response.status === 422) {
        console.error('[AI Service Error]: Geçersiz veri formatı gönderildi (422 Unprocessable Entity).');
        throw new Error('Analiz edilecek metin formatı geçerli değil.');
      }

      // Öngörülemeyen diğer HTTP hataları için genel yakalama bloğu
      console.error(`[AI Service Error]: HTTP Hata Kodu ${response.status} alındı.`);
      throw new Error('Yapay zeka servisi ile iletişim sırasında beklenmeyen bir HTTP hatası oluştu.');
    }

    // 3. Başarılı HTTP yanıtını (Stream) JSON nesnesine dönüştürüyoruz.
    const data = await response.json();
    
    // FastAPI şemasından (Schema) dönen veri bazen doğrudan liste (Array), bazen de { skills: [...] } objesi olabilir.
    // Her iki durumu da (Defensive) kapsayacak şekilde güvenli dönüş yapıyoruz.
    let extracted = [];
    if (Array.isArray(data)) {
        extracted = data;
    } else if (data && Array.isArray(data.skills)) {
        extracted = data.skills;
    }
    
    return extracted;

  } catch (error) {
    // Fetch isteği hiç yapılamazsa (örn. Python servisi kapalıysa - ECONNREFUSED) bu blok çalışır.
    console.error('[AI Service Exception]: extractSkills fonksiyonunda bir istisna (Exception) oluştu:', error.message);
    
    // Eğer fırlatılan hata zaten kendi throw ettiğimiz kullanıcı dostu hata ise, bunu değiştirmeden yukarı iletiyoruz.
    if (error.message.includes('Yapay zeka') || error.message.includes('metin formatı')) {
        throw error;
    }
    
    // Düşük seviyeli ağ (Network) hataları için son savunma hattı.
    throw new Error('Yapay zeka mikroservisine bağlanılamadı. Lütfen servisin çalıştığından emin olun.');
  }
};

/**
 * Gönderilen metnin semantik karşılığını (vektör) üretir.
 * Model: SentenceTransformers (all-MiniLM-L6-v2) - 384 boyutlu vektör oluşturur.
 * 
 * @param {string} text - Vektörü oluşturulacak metin.
 * @returns {Promise<Array<number>>} 384 elemanlı float (ondalıklı) sayı dizisi.
 * @throws {Error} İletişim kopukluğu veya geçersiz veri durumlarında fırlatılır.
 */
export const generateEmbedding = async (text) => {
  try {
    // 1. Embedding (vektörleştirme) endpoint'ine asenkron istek atıyoruz.
    const response = await fetch(`${AI_SERVICE_URL}/generate-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    // 2. Özel Durum ve Hata Kontrolleri
    if (!response.ok) {
       if (response.status === 503) {
        console.error('[AI Service Error]: Embedding servisi 503 döndü.');
        throw new Error('Vektör çıkarma işlemi geçici olarak kullanılamıyor.');
      }
      if (response.status === 422) {
        console.error('[AI Service Error]: Embedding için gönderilen metin 422 döndü.');
        throw new Error('Vektör oluşturulacak metin formatı geçersiz.');
      }
      
      console.error(`[AI Service Error]: Embedding üretilirken Hata Kodu ${response.status} alındı.`);
      throw new Error('Semantik vektör oluşturma işlemi başarısız oldu.');
    }

    // 3. JSON formatındaki yanıtı işleyip diziyi döndürme işlemi.
    const data = await response.json();
    
    // Beklentimiz 384 uzunluğunda bir float sayı dizisidir. (örn: [0.12, -0.05, 0.44, ...])
    return data.embedding || [];

  } catch (error) {
    console.error('[AI Service Exception]: generateEmbedding fonksiyonunda istisna oluştu:', error.message);
    
    if (error.message.includes('Vektör') || error.message.includes('Semantik')) {
        throw error;
    }
    
    throw new Error('Yapay zeka mikroservisine bağlanılamadı. Servis erişilebilir değil.');
  }
};

/**
 * Aday vektörü ile iş ilanı vektörleri arasında Kosinüs Benzerliği (Cosine Similarity)
 * hesaplamak için Python mikroservisine istek atar.
 * 
 * @param {Array<number>} candidateVector - Adayın 384 boyutlu vektörü
 * @param {Array<Object>} jobPostings - { id, vector } formatında iş ilanı vektörleri dizisi
 * @returns {Promise<Array<Object>>} - { id, score } formatında eşleşme sonuçları
 */
export const matchJobs = async (candidateVector, jobPostings) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/match-jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        candidate_vector: candidateVector,
        job_postings: jobPostings
      }),
    });

    if (!response.ok) {
      if (response.status === 422) {
        throw new Error('Geçersiz vektör boyutu (422). Vektörlerin 384 elemanlı olduğundan emin olun.');
      }
      throw new Error(`Eşleştirme servisi hata döndürdü: ${response.status}`);
    }

    const data = await response.json();
    return data || []; // [] dönerse eşleşme yok veya ilan yok
  } catch (error) {
    console.error('[AI Service Exception]: matchJobs fonksiyonunda istisna:', error.message);
    throw new Error('Eşleştirme motoru hatası: ' + error.message);
  }
};
