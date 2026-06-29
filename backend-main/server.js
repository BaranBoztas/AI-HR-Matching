import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// Rota İçe Aktarımları
import profileRoutes from "./routes/profileRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import matchingRoutes from "./routes/matchingRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";

// .env dosyasındaki değişkenleri yüklüyoruz
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Ana Rotalar (Endpoints)
app.use("/api/profiles", profileRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/matches", matchingRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/applications", applicationRoutes);

// İlk Test Rotası
app.get("/", (req, res) => {
  res.json({ message: "İK Eşleştirme Platformu Backend-Main Aktif!" });
});

app.listen(PORT, () => {
  console.log(
    `🚀 Sunucu http://localhost:${PORT} adresinde başarıyla ayağa kalktı.`,
  );
});
