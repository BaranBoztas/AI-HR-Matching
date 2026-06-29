import { supabaseAdmin } from '../config/supabase.js';
import { matchJobs } from '../services/aiService.js';

/**
 * Allows a candidate to apply for a job posting.
 */
export const applyForJob = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { job_id } = req.body;

    if (role !== 'candidate') {
      return res.status(403).json({ error: 'Sadece adaylar iş ilanlarına başvurabilir.' });
    }

    if (!job_id) {
      return res.status(400).json({ error: 'İlan ID (job_id) gereklidir.' });
    }

    // Save application to database
    const { error: insertError } = await supabaseAdmin
      .from('applications')
      .insert({
        candidate_id: id,
        job_id: job_id,
        status: 'pending'
      });

    if (insertError) {
      // Eğer unique constraint varsa (aynı ilana iki kez başvuru) hatayı yakala
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'Bu ilana zaten başvurdunuz.' });
      }
      throw insertError;
    }

    return res.status(201).json({ message: 'Başvurunuz başarıyla alındı.' });
  } catch (error) {
    console.error('Başvuru Hatası:', error);
    return res.status(500).json({ error: 'Başvuru sırasında bir hata oluştu.' });
  }
};

/**
 * Retrieves the candidate's own applications.
 */
export const getCandidateApplications = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role !== 'candidate') {
      return res.status(403).json({ error: 'Sadece adaylar kendi başvurularını görüntüleyebilir.' });
    }

    // Fetch the candidate's applications
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('applications')
      .select('*')
      .eq('candidate_id', id)
      .order('applied_at', { ascending: false });

    if (appsError) throw appsError;

    if (!apps || apps.length === 0) {
      return res.status(200).json({ applications: [] });
    }

    // Collect job posting IDs
    const jobIds = [...new Set(apps.map(a => a.job_id))];

    // Fetch job posting details
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('job_postings')
      .select('id, title, work_type, company_id')
      .in('id', jobIds);

    if (jobsError) throw jobsError;

    // Combine data
    const result = apps.map(app => {
      const job = jobs.find(j => j.id === app.job_id);
      return {
        id: app.id,
        status: app.status,
        created_at: app.applied_at, // Veritabanında applied_at, frontend'de created_at
        job_id: app.job_id,
        // Frontend compatible format
        job_postings: {
          title: job ? job.title : 'Bilinmeyen İlan',
          work_type: job ? job.work_type : 'Bilinmiyor',
          company_id: job ? job.company_id : null
        }
      };
    });

    return res.status(200).json({ applications: result });
  } catch (error) {
    console.error('Başvuruları Getirme Hatası:', error);
    return res.status(500).json({ error: 'Başvurular getirilirken bir hata oluştu.' });
  }
};

/**
 * Retrieves applications received for the company's job postings.
 */
export const getCompanyApplications = async (req, res) => {
    try {
        const { location, min_score } = req.query;

        // Security check
        const companyId = req.user?.id;
        if (!companyId) {
            return res.status(401).json({ error: "Yetkisiz erişim, şirket ID bulunamadı." });
        }

        // Fetch job postings
        const { data: jobs, error: jobError } = await supabaseAdmin
            .from('job_postings')
            .select('id, title, embedding')
            .eq('company_id', companyId);

        if (jobError) throw jobError;

        // Return empty if no jobs found
        if (!jobs || jobs.length === 0) {
            return res.json([]);
        }

        // Collect job IDs into an array
        const jobIds = jobs.map(j => j.id);

        // Fetch applications
        const { data: apps, error: appError } = await supabaseAdmin
            .from('applications')
            .select('*')
            .in('job_id', jobIds);

        if (appError) throw appError;

        // Return empty if no applications found
        if (!apps || apps.length === 0) {
            return res.json([]);
        }

        // Fetch candidate profiles
        let candQuery = supabaseAdmin
            .from('candidate_profiles')
            .select('user_id, full_name, parsed_text, phone, location, embedding');

        // Location filter
        if (location) {
            candQuery = candQuery.ilike('location', `%${location}%`);
        }

        const { data: candidates, error: candError } = await candQuery;

        if (candError) throw candError;

        // Fetch candidates' email addresses from the main profiles table
        const candidateUserIds = [...new Set(candidates.map(c => c.user_id))];
        const { data: profilesData } = await supabaseAdmin
            .from('profiles')
            .select('id, email')
            .in('id', candidateUserIds);

        // AI score calculation
        const scoreMap = {};

        const jobsWithApps = jobs.filter(j => apps.some(a => a.job_id === j.id));
        for (const job of jobsWithApps) {
            let jobVector = job.embedding;
            if (typeof jobVector === 'string') jobVector = JSON.parse(jobVector);

            if (!jobVector) continue;

            const jobApps = apps.filter(a => a.job_id === job.id);
            const candidatePayloads = [];

            for (const app of jobApps) {
                const cand = candidates.find(c => c.user_id === app.candidate_id);
                if (cand && cand.embedding) {
                    let candVector = cand.embedding;
                    if (typeof candVector === 'string') candVector = JSON.parse(candVector);
                    candidatePayloads.push({
                        id: app.id.toString(),
                        vector: candVector
                    });
                }
            }

            if (candidatePayloads.length > 0) {
                // Perform AI matching
                const rawMatches = await matchJobs(jobVector, candidatePayloads);
                if (rawMatches && rawMatches.length > 0) {
                    rawMatches.forEach(match => {
                        scoreMap[match.id] = Math.round(match.score * 100);
                    });
                }
            }
        }

        // Combine data
        let combinedData = apps.map(app => {
            const matchedJob = jobs.find(j => j.id === app.job_id);
            const matchedCandidate = candidates.find(c => c.user_id === app.candidate_id);
            const matchedProfile = profilesData?.find(p => p.id === app.candidate_id);

            const dynamicAiScore = scoreMap[app.id] || 0;

            return {
                id: app.id,
                job_id: app.job_id,
                status: app.status,
                match_score: app.match_score,
                applied_at: app.applied_at,
                job_title: matchedJob ? matchedJob.title : 'Bilinmeyen Pozisyon',
                candidate_name: matchedCandidate ? matchedCandidate.full_name : 'İsimsiz Aday',
                candidate_phone: matchedCandidate?.phone || 'Belirtilmemiş',
                candidate_location: matchedCandidate?.location || 'Belirtilmemiş',
                candidate_email: matchedProfile?.email || 'Belirtilmemiş',
                candidate_resume: matchedCandidate ? matchedCandidate.parsed_text : 'Aday özgeçmişini tamamlamamış.',
                // Frontend compatibility
                job_postings: { title: matchedJob ? matchedJob.title : 'Bilinmeyen İlan' },
                profiles: { fullname: matchedCandidate ? matchedCandidate.full_name : 'Gizli Aday' },
                ai_score: dynamicAiScore,
                _hasCandidateRecord: !!matchedCandidate // Record status
            };
        });

        // Remove location mismatches
        if (location) {
            combinedData = combinedData.filter(app => app._hasCandidateRecord);
        }

        // Min Score filter
        if (min_score) {
            const scoreThreshold = parseInt(min_score, 10);
            combinedData = combinedData.filter(app => app.ai_score >= scoreThreshold);
        }

        // Return result
        return res.json({ applications: combinedData });

    } catch (error) {
        // Error handling
        console.error("Başvuru getirme hatası:", error);
        return res.status(500).json({ error: "Gelen başvurular işlenirken kod düzeyinde hata oluştu." });
    }
};

/**
 * Updates the application status.
 */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id: appId } = req.params;
    const { status } = req.body;
    const companyId = req.user?.id;

    if (req.user?.role !== 'company') {
      return res.status(403).json({ error: 'Sadece şirketler başvuru güncelleyebilir.' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Yeni statü (status) belirtilmelidir.' });
    }

    // Authorization check
    const { data: appData, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('job_id')
      .eq('id', appId)
      .single();

    if (appErr || !appData) return res.status(404).json({ error: 'Başvuru bulunamadı.' });

    const { data: jobData, error: jobErr } = await supabaseAdmin
      .from('job_postings')
      .select('company_id')
      .eq('id', appData.job_id)
      .single();

    if (jobErr || jobData.company_id !== companyId) {
       return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    // Update
    const { error: updateError } = await supabaseAdmin
      .from('applications')
      .update({ status })
      .eq('id', appId);

    if (updateError) throw updateError;

    return res.status(200).json({ message: 'Başvuru durumu başarıyla güncellendi.' });
  } catch (error) {
    console.error('Başvuru Güncelleme Hatası:', error);
    return res.status(500).json({ error: 'Başvuru güncellenirken hata oluştu.' });
  }
};

/**
 * Allows the company to make a direct offer to a candidate.
 */
export const makeOfferToCandidate = async (req, res) => {
  try {
    const { candidate_id, job_id } = req.body;
    const companyId = req.user?.id;

    if (req.user?.role !== 'company') {
      return res.status(403).json({ error: 'Sadece şirketler teklif yapabilir.' });
    }

    if (!candidate_id || !job_id) {
      return res.status(400).json({ error: 'Aday ID (candidate_id) ve İlan ID (job_id) gereklidir.' });
    }

    // Security: Does this job posting really belong to this company?
    const { data: jobData, error: jobErr } = await supabaseAdmin
      .from('job_postings')
      .select('company_id')
      .eq('id', job_id)
      .single();

    if (jobErr || jobData.company_id !== companyId) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    // Save offer to database
    const { error: insertError } = await supabaseAdmin
      .from('applications')
      .insert({
        candidate_id,
        job_id,
        status: 'offered'
      });

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'Bu adaya bu ilan için zaten bir teklif veya başvuru yapılmış.' });
      }
      throw insertError;
    }

    return res.status(201).json({ message: 'Teklif adaya başarıyla iletildi.' });
  } catch (error) {
    console.error('Teklif Hatası:', error);
    return res.status(500).json({ error: 'Teklif gönderilirken bir hata oluştu.' });
  }
};

/**
 * Retrieves the candidate's incoming offers.
 */
export const getCandidateOffers = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role !== 'candidate') {
      return res.status(403).json({ error: 'Sadece adaylar gelen teklifleri görüntüleyebilir.' });
    }

    // Fetch the candidate's offered applications
    const { data: apps, error: appsError } = await supabaseAdmin
      .from('applications')
      .select('*')
      .eq('candidate_id', id)
      .eq('status', 'offered')
      .order('applied_at', { ascending: false });

    if (appsError) throw appsError;

    if (!apps || apps.length === 0) {
      return res.status(200).json({ offers: [] });
    }

    // Collect job posting IDs
    const jobIds = [...new Set(apps.map(a => a.job_id))];

    // Fetch job posting details
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from('job_postings')
      .select('id, title, work_type, location, company_id')
      .in('id', jobIds);

    if (jobsError) throw jobsError;

    const companyIds = [...new Set(jobs.map(j => j.company_id))];

    // Fetch company profiles
    const { data: companies, error: companiesError } = await supabaseAdmin
      .from('company_profiles')
      .select('user_id, company_name')
      .in('user_id', companyIds);

    if (companiesError) throw companiesError;

    // Combine data
    const result = apps.map(app => {
      const job = jobs.find(j => j.id === app.job_id);
      const company = job ? companies.find(c => c.user_id === job.company_id) : null;
      
      return {
        id: app.id,
        status: app.status,
        created_at: app.applied_at,
        job_id: app.job_id,
        job_title: job ? job.title : 'Bilinmeyen İlan',
        work_type: job ? job.work_type : 'Bilinmiyor',
        location: job ? job.location : 'Bilinmiyor',
        company_name: company ? company.company_name : 'Gizli Şirket'
      };
    });

    return res.status(200).json({ offers: result });
  } catch (error) {
    console.error('Teklifleri Getirme Hatası:', error);
    return res.status(500).json({ error: 'Teklifler getirilirken bir hata oluştu.' });
  }
};

/**
 * Allows a candidate to respond (accept/reject) to an offer.
 */
export const respondToOffer = async (req, res) => {
  try {
    const { id: appId } = req.params;
    const { status } = req.body; // 'accepted' or 'rejected'
    const candidateId = req.user?.id;

    if (req.user?.role !== 'candidate') {
      return res.status(403).json({ error: 'Sadece adaylar teklifleri yanıtlayabilir.' });
    }

    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ error: 'Geçersiz statü. Sadece accepted veya rejected gönderilebilir.' });
    }

    // Verify application belongs to candidate and is currently 'offered'
    const { data: appData, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('candidate_id, status')
      .eq('id', appId)
      .single();

    if (appErr || !appData) {
      return res.status(404).json({ error: 'Başvuru/Teklif bulunamadı.' });
    }

    if (appData.candidate_id !== candidateId) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }

    if (appData.status !== 'offered') {
      return res.status(400).json({ error: 'Bu başvuru şu anda yanıtlanabilir bir teklif aşamasında değil.' });
    }

    // Update status
    const { error: updateError } = await supabaseAdmin
      .from('applications')
      .update({ status })
      .eq('id', appId);

    if (updateError) throw updateError;

    return res.status(200).json({ message: 'Teklif başarıyla yanıtlandı.' });
  } catch (error) {
    console.error('Teklif Yanıtlama Hatası:', error);
    return res.status(500).json({ error: 'Teklif yanıtlanırken hata oluştu.' });
  }
};
