import express from "express";
import axios from "axios";
import crypto from "crypto";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================
// ⚙️ KONFIGURASI ENVIRONMENT
// ==============================
const MODE = process.env.IPAYMU_MODE || "live"; // live / sandbox
const IPAYMU_VA = process.env.IPAYMU_VA;
const IPAYMU_KEY = process.env.IPAYMU_KEY;
const BASE_URL = process.env.BASE_URL || "https://ipaymu-shopify.onrender.com";
const STORE_URL = process.env.STORE_URL || "https://arkebstore.my.id";

const IPAYMU_BASE_URL =
  MODE.toLowerCase() === "sandbox"
    ? "https://sandbox.ipaymu.com/api/v2"
    : "https://my.ipaymu.com/api/v2";

console.log(`🚀 Server running in ${MODE.toUpperCase()} MODE`);
console.log(`🔗 iPaymu API: ${IPAYMU_BASE_URL}`);

// ==============================
// 🌐 CORS
// ==============================
const allowedOrigins = [
  "https://arkebstore.my.id",
  "http://arkebstore.my.id",
  "https://www.arkebstore.my.id",
  BASE_URL,
];
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  })
);

// ==============================
// ✅ ROUTE TEST
// ==============================
app.get("/", (req, res) => {
  res.send(`✅ iPaymu-Server aktif di mode: ${MODE.toUpperCase()}`);
});

// ==============================
// 💳 ROUTE PEMBAYARAN DARI ARKEBSTORE → IPAYMU
// ==============================
app.all("/pay", async (req, res) => {
  try {
    const data = req.method === "GET" ? req.query : req.body;
    const { order_id, product, amount, buyerName, buyerEmail, buyerPhone, buyerAddress } = data;

    console.log("🔥 Request masuk ke /pay:", data);

    if (!order_id || !amount) {
      return res.status(400).send("❌ order_id atau amount tidak ditemukan");
    }

    const cleanAmount = Math.round(parseFloat(String(amount).replace(",", ".")));

    const body = {
      product: [product || `Pembayaran Order #${order_id}`],
      qty: [1],
      price: [cleanAmount],
      buyerName: buyerName || "Pelanggan ArkebStore",
      buyerEmail: buyerEmail || "pelanggan@arkebstore.my.id",
      buyerPhone: buyerPhone || "08123456789",
      buyerAddress: buyerAddress || "Alamat pelanggan ArkebStore",
      returnUrl: `${STORE_URL}/success.html`,
      cancelUrl: `${STORE_URL}/cancel.html`,
      notifyUrl: `${BASE_URL}/callback`,
    };

    // 🔐 SIGNATURE
    const jsonBody = JSON.stringify(body);
    const bodyHash = crypto.createHash("sha256").update(jsonBody).digest("hex");
    const stringToSign = `POST:${IPAYMU_VA}:${bodyHash}:${IPAYMU_KEY}`;
    const signature = crypto
      .createHmac("sha256", IPAYMU_KEY)
      .update(stringToSign)
      .digest("hex");

    const headers = {
      "Content-Type": "application/json",
      va: IPAYMU_VA,
      signature,
      timestamp: new Date().toISOString(),
    };

    console.log("📦 Signature:", signature);
    console.log("📡 Kirim ke:", `${IPAYMU_BASE_URL}/payment`);

    const response = await axios.post(`${IPAYMU_BASE_URL}/payment`, body, { headers });

    const redirectUrl = response.data?.Data?.Url;
    if (redirectUrl) {
      console.log("✅ Redirect ke:", redirectUrl);
      return res.redirect(redirectUrl);
    } else {
      console.log("⚠️ Response iPaymu:", response.data);
      return res.status(500).send("Gagal membuat link pembayaran iPaymu");
    }
  } catch (error) {
    console.error("❌ ERROR /pay:", error.response?.data || error.message);
    return res.status(500).send("Terjadi kesalahan di server iPaymu");
  }
});

// ==============================
// 🔁 CALLBACK DARI IPAYMU
// ==============================
app.post("/callback", (req, res) => {
  console.log("📩 Callback diterima dari iPaymu:", req.body);
  res.send("Callback diterima ✅");
});

// ==============================
// ☕ KEEP-ALIVE UNTUK RENDER
// ==============================
setInterval(async () => {
  try {
    await axios.get(BASE_URL);
    console.log("☕ Keep-alive ping sent to Render");
  } catch (err) {
    console.log("⚠ Keep-alive ping failed:", err.message);
  }
}, 4 * 60 * 1000);

// ==============================
// 🚀 JALANKAN SERVER
// ==============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🚀 Server berjalan di port ${PORT} (${MODE.toUpperCase()} MODE)`)
);
