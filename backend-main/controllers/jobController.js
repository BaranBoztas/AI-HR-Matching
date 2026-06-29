import { supabaseAdmin as supabase } from "../config/supabase.js";
import { extractSkills, generateEmbedding } from "../services/aiService.js";

/**
 * Creates a new job posting.
 */
export const createJobPosting = async (req, res) => {
  try {
    const { id, role } = req.user;

    // Security check
    if (role !== "company") {
      return res
        .status(403)
        .json({
          error:
            "Yetkisiz işlem: Sadece şirket hesapları iş ilanı oluşturabilir.",
        });
    }

    // Job posting data from frontend
    const { title, description, work_type, location } = req.body;

    if (!title || !description || !location) {
      return res
        .status(400)
        .json({
          error:
            "İlan başlığı (title), detay metni (description) ve şehir (location) zorunludur.",
        });
    }

    let skillsArray = [];
    let embeddingVector = null;

    // Job analysis and vector generation
    try {
      [skillsArray, embeddingVector] = await Promise.all([
        extractSkills(description, "company"),
        generateEmbedding(description),
      ]);
    } catch (aiError) {
      // AI error handling
      console.error("[AI İşlem Hatası]: İş ilanı analiz edilemedi.", aiError);
      throw new Error(
        aiError.message ||
          "İlan analiz edilirken yapay zeka servisinde bir sorun oluştu.",
      );
    }

    // Save job posting to database
    const jobData = {
      company_id: id,
      title: title,
      description: description,
      location: location,
      work_type: work_type || "onsite",
      // Skills array
      parsed_requirements:
        skillsArray && skillsArray.length > 0 ? skillsArray.join(", ") : null,
      // Vector array
      embedding: embeddingVector,
    };

    // Write job posting to database
    const { data: newJob, error: jobInsertError } = await supabase
      .from("job_postings")
      .insert(jobData)
      .select("id")
      .single();

    if (jobInsertError || !newJob) {
      console.error(
        "[Supabase Error]: İş ilanı kaydedilirken hata:",
        jobInsertError,
      );
      throw new Error(
        "İş ilanı veritabanına kaydedilemedi. Detay: " +
          JSON.stringify(jobInsertError),
      );
    }

    const newJobId = newJob.id;

    // Save extracted skills to the system
    if (skillsArray && skillsArray.length > 0) {
      // Save skills to the skills table
      const skillsToInsert = skillsArray.map((skill) => ({ name: skill }));

      const { data: upsertedSkills, error: skillsError } = await supabase
        .from("skills")
        .upsert(skillsToInsert, { onConflict: "name" })
        .select("id, name");

      if (skillsError) {
        console.error(
          "[Supabase Error]: İş ilanının yetenekleri tabloya (skills) yazılırken hata:",
          skillsError,
        );
        throw new Error("Yetenekler sisteme entegre edilemedi.");
      }

      // Establish many-to-many relationship
      if (upsertedSkills && upsertedSkills.length > 0) {
        const jobSkillsToInsert = upsertedSkills.map((skill) => ({
          job_id: newJobId,
          skill_id: skill.id,
        }));

        const { error: linkError } = await supabase
          .from("job_skills")
          .insert(jobSkillsToInsert);

        if (linkError) {
          console.error(
            "[Supabase Error]: İş ilanı-Yetenek ilişkileri (job_skills) kurulurken hata:",
            linkError,
          );
          throw new Error("İlanın yetenek bağları kurulamadı.");
        }
      }
    }

    // Return successful response
    return res.status(201).json({
      message:
        "İş ilanı başarıyla oluşturuldu ve yapay zeka tarafından indekslendi.",
      jobId: newJobId,
      extractedSkills: skillsArray,
    });
  } catch (error) {
    console.error("İş İlanı Oluşturma Hatası:", error);
    // Error handling
    const errorMessage =
      error.message ||
      "Sunucu hatası: İş ilanı oluşturulurken beklenmeyen bir sorun oluştu.";
    return res.status(500).json({ error: errorMessage });
  }
};

/**
 * Updates an existing job posting.
 */
export const updateJobPosting = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { id: jobId } = req.params;

    if (role !== "company") {
      return res
        .status(403)
        .json({
          error:
            "Yetkisiz işlem: Sadece şirket hesapları iş ilanını güncelleyebilir.",
        });
    }

    const { title, description, work_type, location } = req.body;

    if (!title || !description || !location) {
      return res
        .status(400)
        .json({
          error: "İlan başlığı, detay metni ve şehir alanları zorunludur.",
        });
    }

    // Authorization check
    const { data: existingJob, error: checkError } = await supabase
      .from("job_postings")
      .select("id")
      .eq("id", jobId)
      .eq("company_id", id)
      .single();

    if (checkError || !existingJob) {
      return res
        .status(403)
        .json({
          error: "Bu ilanı düzenleme yetkiniz yok veya ilan bulunamadı.",
        });
    }

    let skillsArray = [];
    let embeddingVector = null;

    try {
      // Re-calculate vector
      [skillsArray, embeddingVector] = await Promise.all([
        extractSkills(description, "company"),
        generateEmbedding(description),
      ]);
    } catch (aiError) {
      console.error(
        "[AI İşlem Hatası]: İlan yeniden analiz edilemedi.",
        aiError,
      );
      throw new Error(
        aiError.message ||
          "İlan analiz edilirken yapay zeka servisinde bir sorun oluştu.",
      );
    }

    const updateData = {
      title,
      description,
      location,
      work_type: work_type || "onsite",
      parsed_requirements:
        skillsArray && skillsArray.length > 0 ? skillsArray.join(", ") : null,
      embedding: embeddingVector,
    };

    const { error: updateError } = await supabase
      .from("job_postings")
      .update(updateData)
      .eq("id", jobId);

    if (updateError) {
      console.error(
        "[Supabase Error]: İş ilanı güncellenirken hata:",
        updateError,
      );
      throw new Error("İş ilanı veritabanında güncellenemedi.");
    }

    // Update related skills
    await supabase.from("job_skills").delete().eq("job_id", jobId);

    if (skillsArray && skillsArray.length > 0) {
      const skillsToInsert = skillsArray.map((skill) => ({ name: skill }));

      const { data: upsertedSkills, error: skillsError } = await supabase
        .from("skills")
        .upsert(skillsToInsert, { onConflict: "name" })
        .select("id, name");

      if (!skillsError && upsertedSkills && upsertedSkills.length > 0) {
        const jobSkillsToInsert = upsertedSkills.map((skill) => ({
          job_id: jobId,
          skill_id: skill.id,
        }));
        await supabase.from("job_skills").insert(jobSkillsToInsert);
      }
    }

    return res.status(200).json({
      message:
        "İş ilanı başarıyla güncellendi ve AI tarafından yeniden indekslendi.",
      extractedSkills: skillsArray,
    });
  } catch (error) {
    console.error("İş İlanı Güncelleme Hatası:", error);
    const errorMessage =
      error.message ||
      "Sunucu hatası: İş ilanı güncellenirken beklenmeyen bir sorun oluştu.";
    return res.status(500).json({ error: errorMessage });
  }
};

/**
 * Retrieves job postings created by the company.
 */
export const getCompanyJobs = async (req, res) => {
  try {
    const { id, role } = req.user;

    if (role !== "company") {
      return res
        .status(403)
        .json({ error: "Sadece şirket hesapları bu işlemi yapabilir." });
    }

    const { data: jobs, error } = await supabase
      .from("job_postings")
      .select("*")
      .eq("company_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Supabase Error]: İlanlar getirilirken hata:", error);
      throw new Error("İlanlarınız getirilirken bir sorun oluştu.");
    }

    return res.status(200).json({ jobs: jobs || [] });
  } catch (error) {
    console.error("Şirket İlanları Getirme Hatası:", error);
    return res.status(500).json({ error: error.message || "Sunucu hatası." });
  }
};

/**
 * Deletes an existing job posting and related data.
 */
export const deleteJobPosting = async (req, res) => {
  try {
    const { id, role } = req.user;
    const { id: jobId } = req.params;

    if (role !== "company") {
      return res
        .status(403)
        .json({
          error:
            "Yetkisiz işlem: Sadece şirket hesapları iş ilanını silebilir.",
        });
    }

    // Verify ownership
    const { data: existingJob, error: checkError } = await supabase
      .from("job_postings")
      .select("id")
      .eq("id", jobId)
      .eq("company_id", id)
      .single();

    if (checkError || !existingJob) {
      return res
        .status(403)
        .json({ error: "Bu ilanı silme yetkiniz yok veya ilan bulunamadı." });
    }

    // Delete associated applications
    const { error: appDeleteError } = await supabase
      .from("applications")
      .delete()
      .eq("job_id", jobId);

    if (appDeleteError) {
      console.error(
        "[Supabase Error]: Başvurular silinirken hata:",
        appDeleteError,
      );
      throw new Error("İlana ait başvurular silinemedi.");
    }

    // Delete associated job_skills
    const { error: skillDeleteError } = await supabase
      .from("job_skills")
      .delete()
      .eq("job_id", jobId);

    if (skillDeleteError) {
      console.error(
        "[Supabase Error]: İlan yetenekleri silinirken hata:",
        skillDeleteError,
      );
      throw new Error("İlana ait yetenek ilişkileri silinemedi.");
    }

    // Delete the job posting
    const { error: jobDeleteError } = await supabase
      .from("job_postings")
      .delete()
      .eq("id", jobId);

    if (jobDeleteError) {
      console.error(
        "[Supabase Error]: İş ilanı silinirken hata:",
        jobDeleteError,
      );
      throw new Error("İş ilanı veritabanından silinemedi.");
    }

    return res
      .status(200)
      .json({ message: "İlan ve ilgili tüm veriler başarıyla silindi." });
  } catch (error) {
    console.error("İş İlanı Silme Hatası:", error);
    return res
      .status(500)
      .json({
        error:
          error.message ||
          "Sunucu hatası: İş ilanı silinirken beklenmeyen bir sorun oluştu.",
      });
  }
};
