import { supabaseAdmin } from "../config/supabase.js";
import { matchJobs } from "../services/aiService.js";

/**
 * Matches candidate's AI vector with job postings.
 */
export const matchCandidateWithJobs = async (req, res) => {
  try {
    const { candidateId } = req.params;
    const { work_type, location, min_score } = req.query;

    if (!candidateId) {
      return res
        .status(400)
        .json({ error: "Aday ID (candidateId) gereklidir." });
    }

    // Fetch candidate's vector
    const { data: candidateData, error: candidateError } = await supabaseAdmin
      .from("candidate_profiles")
      .select("embedding")
      .eq("user_id", candidateId)
      .single();

    if (candidateError || !candidateData || !candidateData.embedding) {
      console.error("[Match Error]: Aday vektörü bulunamadı", candidateError);
      return res
        .status(404)
        .json({
          error:
            "Adaya ait yapay zeka profili (vektör) bulunamadı. Lütfen önce profilinizi AI analizi ile güncelleyin.",
        });
    }

    let candidateVector = candidateData.embedding;
    if (typeof candidateVector === "string") {
      candidateVector = JSON.parse(candidateVector);
    }

    // Fetch active job postings
    let jobsQuery = supabaseAdmin
      .from("job_postings")
      .select("id, embedding")
      .eq("is_active", true)
      .not("embedding", "is", null);

    // Apply filters
    if (work_type) {
      jobsQuery = jobsQuery.eq("work_type", work_type);
    }
    if (location) {
      jobsQuery = jobsQuery.ilike("location", `%${location}%`);
    }

    const { data: activeJobs, error: jobsError } = await jobsQuery;

    if (jobsError) {
      console.error("[Match Error]: İş ilanları çekilirken hata", jobsError);
      return res
        .status(500)
        .json({ error: "İş ilanları veritabanından getirilemedi." });
    }

    if (!activeJobs || activeJobs.length === 0) {
      return res
        .status(200)
        .json({
          message: "Şu anda eşleştirilecek aktif iş ilanı bulunmuyor.",
          matches: [],
        });
    }

    // Convert data to Python format
    const jobVectorsPayload = activeJobs.map((job) => {
      let vec = job.embedding;
      if (typeof vec === "string") vec = JSON.parse(vec);
      return {
        id: job.id.toString(),
        vector: vec,
      };
    });

    // Perform matching in Python engine
    const rawMatches = await matchJobs(candidateVector, jobVectorsPayload);

    if (!rawMatches || rawMatches.length === 0) {
      return res
        .status(200)
        .json({ message: "Eşleşen ilan bulunamadı.", matches: [] });
    }

    // Filter by threshold value
    const threshold = min_score ? parseFloat(min_score) / 100 : 0.1;
    const filteredMatches = rawMatches.filter(
      (match) => match.score >= threshold,
    );

    if (filteredMatches.length === 0) {
      return res
        .status(200)
        .json({
          message: "Yeterince güçlü ve alakalı bir eşleşme bulunamadı.",
          matches: [],
        });
    }

    // Fetch details of matched jobs
    const matchedJobIds = filteredMatches.map((m) => m.id);

    // Retrieve jobs
    const { data: jobDetails, error: detailsError } = await supabaseAdmin
      .from("job_postings")
      .select(
        "id, title, work_type, company_id, description, parsed_requirements",
      )
      .in("id", matchedJobIds);

    if (detailsError) {
      console.error(
        "[Match Error]: İlan detayları çekilirken hata",
        detailsError,
      );
      return res
        .status(500)
        .json({ error: "Eşleşen ilan detayları alınamadı." });
    }

    // Fetch company details
    const companyIds = [...new Set(jobDetails.map((j) => j.company_id))];
    const { data: companiesData } = await supabaseAdmin
      .from("company_profiles")
      .select("user_id, company_name, website, industry")
      .in("user_id", companyIds);

    // Combine results
    const finalMatches = filteredMatches.map((match) => {
      const details = jobDetails.find((job) => job.id.toString() === match.id);
      const company = companiesData?.find(
        (c) => c.user_id === details?.company_id,
      );
      return {
        ...match,
        ...details,
        company_details: company || null,
        match_percentage: Math.round(match.score * 100), // Skoru yüzdeye çevir
      };
    });

    // Re-sort by score
    finalMatches.sort((a, b) => b.score - a.score);

    // Return the result
    return res.status(200).json({
      message: "Eşleştirme başarıyla tamamlandı.",
      total_matches: finalMatches.length,
      matches: finalMatches,
    });
  } catch (error) {
    console.error("Eşleştirme Controller Hatası:", error);
    return res.status(500).json({ error: errorMessage });
  }
};

/**
 * Matches job posting vector with candidates.
 */
export const matchJobWithCandidates = async (req, res) => {
  try {
    const { jobId } = req.params;
    const companyId = req.user?.id;

    if (!jobId) {
      return res.status(400).json({ error: "İlan ID (jobId) gereklidir." });
    }

    if (req.user?.role !== "company") {
      return res
        .status(403)
        .json({ error: "Sadece şirketler ilan eşleştirmesi yapabilir." });
    }

    // Fetch job posting vector
    const { data: jobData, error: jobError } = await supabaseAdmin
      .from("job_postings")
      .select("embedding, company_id")
      .eq("id", jobId)
      .single();

    if (jobError || !jobData || !jobData.embedding) {
      return res
        .status(404)
        .json({ error: "İlana ait yapay zeka profili bulunamadı." });
    }

    // Security: Does this job belong to this company?
    if (jobData.company_id !== companyId) {
      return res.status(403).json({ error: "Bu işlem için yetkiniz yok." });
    }

    let jobVector = jobData.embedding;
    if (typeof jobVector === "string") {
      jobVector = JSON.parse(jobVector);
    }

    // Fetch candidate vectors from the system
    const { data: allCandidates, error: candError } = await supabaseAdmin
      .from("candidate_profiles")
      .select("user_id, embedding")
      .not("embedding", "is", null);

    if (candError) {
      return res
        .status(500)
        .json({ error: "Adaylar veritabanından getirilemedi." });
    }

    if (!allCandidates || allCandidates.length === 0) {
      return res
        .status(200)
        .json({
          message: "Şu anda sistemde analiz edilecek aday bulunmuyor.",
          matches: [],
        });
    }

    // Convert data to Python format
    const candidateVectorsPayload = allCandidates.map((c) => {
      let vec = c.embedding;
      if (typeof vec === "string") vec = JSON.parse(vec);
      return {
        id: c.user_id.toString(),
        vector: vec,
      };
    });

    // Perform matching in Python engine
    const rawMatches = await matchJobs(jobVector, candidateVectorsPayload);

    if (!rawMatches || rawMatches.length === 0) {
      return res
        .status(200)
        .json({ message: "Eşleşen aday bulunamadı.", matches: [] });
    }

    const threshold = 0.1; // Test için esnek tutuldu
    const filteredMatches = rawMatches.filter(
      (match) => match.score >= threshold,
    );

    if (filteredMatches.length === 0) {
      return res
        .status(200)
        .json({
          message: "Yeterince güçlü eşleşen aday bulunamadı.",
          matches: [],
        });
    }

    // Fetch candidate details
    const matchedCandidateIds = filteredMatches.map((m) => m.id);

    const { data: candidateDetails, error: detailsError } = await supabaseAdmin
      .from("candidate_profiles")
      .select("user_id, full_name, parsed_text, phone, location")
      .in("user_id", matchedCandidateIds);

    if (detailsError) {
      return res.status(500).json({ error: "Aday detayları alınamadı." });
    }

    // Combine and sort results
    const finalMatches = filteredMatches
      .map((match) => {
        const details = candidateDetails.find(
          (c) => c.user_id.toString() === match.id,
        );
        return {
          ...match,
          ...details,
          match_percentage: Math.round(match.score * 100),
        };
      })
      .filter((m) => m.user_id); // Bulunamayanları filtrele

    finalMatches.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      message: "Aday analizi tamamlandı.",
      total_matches: finalMatches.length,
      matches: finalMatches,
    });
  } catch (error) {
    console.error("Job Matching Error:", error);
    return res
      .status(500)
      .json({ error: "Analiz sırasında sunucu hatası oluştu." });
  }
};
