import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==============================
// ⚙️ KONFIGURASI ENVIRONMENT
// ==============================
const MODE = process.env.IPAYMU_MODE || "sandbox"; // sandbox / live
const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
const SHOPIFY_TOKEN = process.env.SHOPIFY_TOKEN;
const IPAYMU_VA = process.env.IPAYMU_VA;
const IPAYMU_KEY = process.env.IPAYMU_KEY;
const BASE_URL = process.env.BASE_URL || "https://ipaymu-shopify.onrender.com";

const IPAYMU_BASE_URL =
  MODE.toLowerCase() === "sandbox"
    ? "https://sandbox.ipaymu.com/api/v2"
    : "https://my.ipaymu.com/api/v2";

console.log(`🚀 Server running in ${MODE.toUpperCase()} MODE`);
console.log(`🔗 iPaymu API: ${IPAYMU_BASE_URL}`);

// ==============================
// 🧩 ROUTE UTAMA TEST
// ==============================
app.get("/", (req, res) => {
  res.send(`✅ iPaymu-Server aktif di mode: ${MODE.toUpperCase()}`);
});

// ==============================
// 💳 ROUTE PEMBAYARAN SHOPIFY → IPAYMU
// ==============================
app.all("/pay", async (req, res) => {
  console.log("🔥 Request masuk ke /pay:", req.method, req.query || req.body);
  try {
    const data = req.method === "GET" ? req.query : req.body;
    const { order_id, buyerName, buyerEmail, buyerPhone, amount } = data;

    if (!order_id || !amount) {
      return res.status(400).send("❌ order_id atau amount tidak ditemukan");
    }

    console.log("📦 order_id:", order_id, "💰 amount:", amount);

    const cleanAmount = Math.round(parseFloat(String(amount).replace(",", ".")));

    const body = {
      product: [`Pembayaran Order #${order_id}`],
      qty: [1],
      price: [cleanAmount],
      buyerName: buyerName || "Pelanggan",
      buyerEmail: buyerEmail || "example@email.com",
      buyerPhone: buyerPhone || "08123456789",
      returnUrl: `https://${SHOPIFY_STORE}/`,
      cancelUrl: `https://${SHOPIFY_STORE}/cart`,
      notifyUrl: `${BASE_URL}/callback`,
    };

    const jsonBody = JSON.stringify(body);
    const timestamp = new Date().toISOString();

    // 🔐 Signature iPaymu (versi baru)
const bodyHash = crypto.createHash("sha256").update(jsonBody).digest("hex");
const stringToSign = `POST:${IPAYMU_VA}:${bodyHash}:${IPAYMU_KEY}`;
const signature = crypto
  .createHmac("sha256", IPAYMU_KEY)
  .update(stringToSign)
  .digest("hex");
    const response = await axios.post(`${IPAYMU_BASE_URL}/payment`, body, {
      headers: {
        "Content-Type": "application/json",
        va: IPAYMU_VA,
        signature,
        timestamp,
      },
    });

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
// 🧾 BUAT LINK PEMBAYARAN MANUAL (OPSIONAL)
// ==============================
app.post("/create-payment", async (req, res) => {
  try {
    const {
      buyerName,
      buyerEmail,
      buyerPhone,
      amount,
      orderId,
      product,
      returnUrl,
      cancelUrl,
      callbackUrl,
    } = req.body;

    const cleanAmount = Math.round(parseFloat(String(amount).replace(",", ".")));

    const body = {
      buyerName,
      buyerEmail,
      buyerPhone,
      amount: cleanAmount,
      orderId,
      product,
      returnUrl,
      cancelUrl,
      notifyUrl: callbackUrl || `${BASE_URL}/callback`,
    };

    const jsonBody = JSON.stringify(body);
    const stringToSign = `POST:${IPAYMU_VA}:${crypto
      .createHash("sha256")
      .update(jsonBody)
      .digest("hex")}:${IPAYMU_KEY}`;
    const signature = crypto
      .createHmac("sha256", IPAYMU_KEY)
      .update(stringToSign)
      .digest("hex");

    const response = await axios.post(`${IPAYMU_BASE_URL}/payment`, body, {
      headers: {
        "Content-Type": "application/json",
        va: IPAYMU_VA,
        signature,
        timestamp: new Date().toISOString(),
      },
    });

    console.log("✅ Response iPaymu:", response.data);
    res.json(response.data);
  } catch (err) {
    console.error("❌ Error create-payment:", err.response?.data || err.message);
    res.status(400).json({
      success: false,
      error: err.response?.data || err.message,
    });
  }
});

// ==============================
// 🔁 CALLBACK DARI IPAYMU → SHOPIFY
// ==============================
app.post("/callback", async (req, res) => {
  try {
    const { reference_id, status, amount } = req.body;
    console.log("📩 Callback diterima dari iPaymu:", req.body);

    if (status === "berhasil" || status === "success") {
      console.log(`✅ Pembayaran order ${reference_id} berhasil!`);

      // Update status order di Shopify jadi Paid
      await axios.post(
        `https://${SHOPIFY_STORE}/admin/api/2024-04/orders/${reference_id}/transactions.json`,
        {
          transaction: {
            kind: "sale",
            status: "success",
            amount: amount || "0",
          },
        },
        {
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(`🟢 Order ${reference_id} di Shopify diperbarui jadi "Paid"`);
    } else {
      console.log(`⚠ Pembayaran ${reference_id} belum berhasil`);
    }

    res.send("Callback diterima ✅");
  } catch (error) {
    console.error("❌ Gagal memproses callback:", error.message);
    res.status(500).send("Error memproses callback");
  }
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
