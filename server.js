import express from "express";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// setup __dirname (karena kita pakai ES Module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ROUTE UTAMA
app.get("/", (req, res) => {
  res.send("✅ iPaymu Render server aktif dan siap menerima request!");
});

// ROUTE UNTUK MENJALANKAN FILE iPaymu RESMI
// Contoh: /create-payment
app.get("/create-payment", (req, res) => {
  const ipaymuScriptPath = path.join(__dirname, "ipaymu-payment-v2-sample-nodejs-main", "ipaymu_direct_payment.js");

  exec(`node ${ipaymuScriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return res.status(500).json({ success: false, error: error.message });
    }
    if (stderr) {
      console.error(`⚠️ Stderr: ${stderr}`);
    }
    console.log(`📦 Output: ${stdout}`);
    try {
      const output = JSON.parse(stdout);
      res.status(200).json(output);
    } catch {
      res.status(200).send(stdout);
    }
  });
});

// ROUTE CALLBACK UNTUK iPaymu (opsional, jika kamu pakai notifyUrl)
app.post("/callback", (req, res) => {
  console.log("📩 Callback diterima dari iPaymu:");
  console.log(req.body);
  res.send("Callback diterima ✅");
});

// SERVER JALAN DI PORT 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
