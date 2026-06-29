import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// .env dosyasındaki verileri okuyabilmek için konfigürasyon
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Eğer .env dosyasında bu bilgiler eksikse sunucu hata versin ki erkenden fark edelim
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Hata: SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY .env dosyasında bulunamadı!",
  );
}

// Supabase istemcisini service_role (Bodyguard/Süper Yönetici) yetkisiyle oluşturuyoruz
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // Sunucu taraflı (backend) çalıştığımız için session'ı hafızada tutmasına gerek yok
    autoRefreshToken: false,
  },
});

// Sadece veritabanı işlemlerinde (RLS'yi atlamak için) kullanılacak, auth işlemleriyle değiştirilmeyecek admin istemcisi
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
