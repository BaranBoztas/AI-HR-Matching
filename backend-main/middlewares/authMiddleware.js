import { supabase, supabaseAdmin } from "../config/supabase.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Bearer token kontrolü
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({
          error: "Yetkilendirme hatası: Token bulunamadı veya format hatalı.",
        });
    }

    const token = authHeader.split(" ")[1];

    // Supabase ile JWT token doğrulama
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res
        .status(401)
        .json({
          error: "Yetkilendirme hatası: Geçersiz veya süresi dolmuş token.",
        });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return res
        .status(401)
        .json({
          error:
            "Yetkilendirme hatası: Kullanıcı profili bulunamadı veya rol tanımlı değil.",
        });
    }

    // Doğrulanan id ve rol bilgisini sonraki katmana aktarmak için isteğe (req) bağlama
    req.user = {
      id: user.id,
      role: profile.role,
    };

    next();
  } catch (error) {
    console.error("Auth Middleware Hatası:", error);
    return res
      .status(500)
      .json({
        error:
          "Sunucu hatası: Kimlik doğrulama işlemi sırasında beklenmeyen bir sorun oluştu.",
      });
  }
};
