import express from "express";
import fetch from "node-fetch";
import { exec } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Halaman utama untuk cek status server
app.get("/", (req, res) => {
  res.send("✅ Server iPaymu-Shopify aktif dan siap menerima transaksi & verifikasi otomatis!");
});

// Jalankan file iPaymu resmi
app.get("/create-payment", (req, res) => {
  const scriptPath = path.join(__dirname, "ipaymu-payment-v2-sample-nodejs-main", "ipaymu_direct_payment.js");

  exec(`node ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Error:", error.message);
      return res.status(500).json({ success: false, message: error.message });
    }

    if (stderr) console.warn("⚠️ Warning:", stderr);

    try {
      const data = JSON.parse(stdout);
      if (data.Success && data.Data.TransactionId) {
        const redirectUrl = `https://arkebstore.myshopify.com/pages/payment-success?trx_id=${data.Data.TransactionId}`;
        return res.redirect(redirectUrl);
      } else {
        return res.status(400).json({ success: false, message: data.Message });
      }
    } catch {
      res.status(200).send(stdout);
    }
  });
});

// ✅ Callback otomatis dari iPaymu (Notify URL)
app.post("/callback", async (req, res) => {
  console.log("📩 Callback diterima dari iPaymu:", req.body);

  const { TransactionId, Status } = req.body;

  // Lakukan verifikasi otomatis status transaksi ke iPaymu
  try {
    const apiKey = "API_KEY_KAMU"; // ganti dengan API key dari akun iPaymu
    const va = "VA_KAMU";          // ganti dengan VA iPaymu kamu

    const body = { transactionId: TransactionId };
    const bodyString = JSON.stringify(body);
    const timestamp = new Date().toISOString();
    const signature = crypto
      .createHmac("sha256", apiKey)
      .update(va + timestamp + bodyString)
      .digest("hex");

    const response = await fetch("https://my.ipaymu.com/api/v2/transaction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        va: va,
        signature: signature,
        timestamp: timestamp,
      },
      body: bodyString,
    });

    const result = await response.json();
    console.log("🔍 Hasil verifikasi otomatis:", result);

    if (result?.Data?.Status === "Success") {
      // Redirect otomatis ke Shopify halaman sukses
      const redirectUrl = `https://arkebstore.myshopify.com/pages/payment-success?trx_id=${TransactionId}`;
      console.log("✅ Pembayaran sukses, redirect ke Shopify...");
      return res.redirect(redirectUrl);
    } else {
      // Redirect ke halaman gagal di Shopify
      const failedUrl = `https://arkebstore.myshopify.com/pages/payment-failed?trx_id=${TransactionId}`;
      console.log("❌ Pembayaran gagal, redirect ke Shopify...");
      return res.redirect(failedUrl);
    }
  } catch (err) {
    console.error("⚠️ Gagal verifikasi:", err.message);
    res.status(500).send("Gagal verifikasi transaksi");
  }
});

// Jalankan server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
