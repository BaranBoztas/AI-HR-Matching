import { supabaseAdmin } from '../config/supabase.js';
import { extractSkills, generateEmbedding } from '../services/aiService.js';

/**
 * Retrieves the user's profile.
 */
export const getProfile = async (req, res) => {
  try {
    const { id, role } = req.user;

    // Fetch basic profile information
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Temel profil bilgisi bulunamadı.' });
    }

    let details = null;

    // Fetch data from the details table based on role
    if (role === 'candidate') {
      const { data: candidateDetails, error: candidateError } = await supabaseAdmin
        .from('candidate_profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      if (candidateError) throw candidateError;
      details = candidateDetails;
    } else if (role === 'company') {
      const { data: companyDetails, error: companyError } = await supabaseAdmin
        .from('company_profiles')
        .select('*')
        .eq('user_id', id)
        .maybeSingle();

      if (companyError) throw companyError;
      details = companyDetails;
    }

    // Combine data and return
    const responseData = {
      ...profile,
      details: details || {}
    };

    return res.status(200).json(responseData);
  } catch (error) {
    console.error('Profil Getirme Hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası: Profil bilgileri alınırken bir sorun oluştu.' });
  }
};

/**
 * Updates the user's profile.
 */
export const updateProfile = async (req, res) => {
  try {
    const { id, role } = req.user;

    // Separate data
    const { details, resumeText, ...generalProfileData } = req.body;

    // Update general profile data
    if (generalProfileData && Object.keys(generalProfileData).length > 0) {
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update(generalProfileData)
        .eq('id', id);

      if (profileUpdateError) {
        return res.status(400).json({ error: 'Genel profil bilgileri güncellenirken hata oluştu.', details: profileUpdateError });
      }
    }

    // AI result variables
    let skillsArray = null;
    let embeddingVector = null;

    // Perform AI analysis
    if (role === 'candidate' && resumeText && resumeText.trim() !== '') {
      [skillsArray, embeddingVector] = await Promise.all([
        extractSkills(resumeText, 'candidate'),
        generateEmbedding(resumeText)
      ]);
    }

    // Update profile details
    if ((details && typeof details === 'object') || (role === 'candidate' && resumeText)) {
      const detailTableName = role === 'candidate' ? 'candidate_profiles' : role === 'company' ? 'company_profiles' : null;

      if (detailTableName) {
        let upsertData = {
          user_id: id,
          ...(details || {})
        };

        if (role === 'candidate' && embeddingVector) {
          upsertData.embedding = embeddingVector;
          upsertData.parsed_text = resumeText;
        }

        const { error: detailUpdateError } = await supabaseAdmin
          .from(detailTableName)
          .upsert(upsertData);

        if (detailUpdateError) {
          return res.status(400).json({ error: 'Profil detayları (vektör dahil) güncellenirken hata oluştu.', details: detailUpdateError });
        }
      }
    }

    // Save skills to the system
    if (role === 'candidate' && skillsArray && skillsArray.length > 0) {

      // Deduplicate to avoid repeating the same skill
      const uniqueSkillsArray = [...new Set(skillsArray.map(s => s.trim()))].filter(Boolean);
      const skillsToInsert = uniqueSkillsArray.map(skill => ({ name: skill }));

      const { data: upsertedSkills, error: skillsError } = await supabaseAdmin
        .from('skills')
        .upsert(skillsToInsert, { onConflict: 'name' })
        .select('id, name');

      if (skillsError) {
        console.error('[Supabase Error]: Yetenekler (skills) tabloya yazılırken hata:', skillsError);
        throw new Error('Yetenekler veritabanına işlenirken bir sorun oluştu.');
      }

      if (upsertedSkills && upsertedSkills.length > 0) {

        await supabaseAdmin
          .from('candidate_skills')
          .delete()
          .eq('user_id', id);

        const candidateSkillsToInsert = upsertedSkills.map(skill => ({
          user_id: id,
          skill_id: skill.id
        }));

        const { error: linkError } = await supabaseAdmin
          .from('candidate_skills')
          .insert(candidateSkillsToInsert);

        if (linkError) {
          console.error('[Supabase Error]: Aday-Yetenek ilişkileri (candidate_skills) kurulurken hata:', linkError);
          throw new Error('Yetenek ilişkileri kaydedilemedi.');
        }
      }
    }

    // Return successful result
    return res.status(200).json({
      message: 'Profil başarıyla güncellendi.',
      extractedSkills: skillsArray
    });

  } catch (error) {
    console.error('Profil Güncelleme ve AI İşlem Hatası:', error);

    // Error handling
    const errorMessage = error.message || 'Sunucu hatası: Profil güncellenirken bir sorun oluştu.';
    return res.status(500).json({ error: errorMessage });
  }
};
