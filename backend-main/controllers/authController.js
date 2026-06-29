import { supabase, supabaseAdmin } from "../config/supabase.js";

export const register = async (req, res) => {
  try {
    const { fullname, email, password, role } = req.body;

    // Create user on Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;

    if (!user) {
      return res.status(400).json({ error: "Kullanıcı oluşturulamadı." });
    }

    // Add user to profiles table
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        fullname: fullname,
        role: role,
      })
      .eq("id", user.id);

    if (profileError) {
      return res.status(400).json({ error: profileError.message });
    }

    return res.status(201).json({ message: "Kayıt başarılı." });
  } catch (error) {
    return res.status(500).json({ error: "Sunucu hatası oluştu." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Log in via Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      return res
        .status(401)
        .json({ error: "Giriş başarısız: Geçersiz e-posta veya şifre." });
    }

    const { user, session } = authData;
    console.log(user.id);
    const access_token = session.access_token;

    // Fetch user's role from profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profileData) {
      return res
        .status(401)
        .json({
          error: "Kullanıcı profili bulunamadı veya rol tanımlı değil.",
        });
    }

    // Return successful result
    return res.status(200).json({
      token: access_token,
      user: {
        id: user.id,
        email: user.email,
        role: profileData.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Sunucu hatası oluştu." });
  }
};
