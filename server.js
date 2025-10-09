import express from "express";
import { spawn } from "child_process";

const app = express();

// 🏠 Halaman utama
app.get("/", (req, res) => {
  res.send("✅ iPaymu Render Server is running. Gunakan endpoint /create-payment untuk memulai transaksi.");
});

// 🔁 Jalankan file resmi iPaymu
app.get("/create-payment", (req, res) => {
  res.send("⏳ Request sedang dikirim ke API iPaymu...");

  const child = spawn("node", ["ipaymu.js"], { stdio: "inherit" });

  child.on("exit", (code) => {
    console.log(`iPaymu.js selesai dengan kode: ${code}`);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
