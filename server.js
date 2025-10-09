import express from "express";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Halaman utama (cek status server)
app.get("/", (req, res) => {
  res.send("✅ iPaymu Render server aktif dan siap menerima transaksi Shopify!");
});

// Jalankan file resmi iPaymu
app.get("/create-payment", (req, res) => {
  // Pastikan path file ipaymu_direct_payment.js benar
  const ipaymuScriptPath = path.join(__dirname, "ipaymu-payment-v2-sample-nodejs-main", "ipaymu_direct_payment.js");

  exec(`node ${ipaymuScriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (stderr) console.warn("⚠️ Warning:", stderr);

    console.log("📦 Output:", stdout);
    try {
      const data = JSON.parse(stdout);
      if (data.Success) {
        // Kalau sukses, redirect ke halaman checkout Shopify sukses
        const shopifySuccessUrl = `https://arkebstore.myshopify.com/pages/payment-success?trx_id=${data.Data.TransactionId}`;
        return res.redirect(shopifySuccessUrl);
      } else {
        return res.status(400).json({ success: false, message: data.Message });
      }
    } catch {
      return res.status(200).send(stdout);
    }
  });
});

// Endpoint untuk menerima callback (notifyUrl) dari iPaymu
app.post("/callback", (req, res) => {
  console.log("📩 Callback diterima dari iPaymu:");
  console.log(req.body);
  
  // Misal kita redirect ke Shopify jika status success
  if (req.body.Status === "berhasil" || req.body.status === "success") {
    const redirectUrl = `https://arkebstore.myshopify.com/pages/payment-success?trx_id=${req.body.TransactionId}`;
    return res.redirect(redirectUrl);
  }

  res.send("✅ Callback diterima (status pending)");
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
