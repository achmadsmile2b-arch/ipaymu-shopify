import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================================
// 🔧 KONFIGURASI UTAMA
// ================================================
const MODE = "sandbox"; // 🔁 ganti ke "live" jika akun iPaymu sudah diverifikasi

// Shopify
const SHOPIFY_STORE = "arkebstore.myshopify.com"; // ubah ke domain toko kamu
const SHOPIFY_TOKEN = "YOUR_ADMIN_API_ACCESS_TOKEN"; // dari private app Shopify

// iPaymu
const IPAYMU_VA = "VA_KAMU"; // VA akun iPaymu kamu
const IPAYMU_APIKEY = "APIKEY_KAMU"; // API Key iPaymu kamu
const IPAYMU_URL =
  MODE === "live"
    ? "https://my.ipaymu.com/api/v2/payment"
    : "https://sandbox.ipaymu.com/api/v2/payment";

// URL Server Render kamu
const BASE_URL = "https://ipaymu-shopify.onrender.com";

// ================================================
// 🔍 CEK SERVER AKTIF
// ================================================
app.get("/", (req, res) => {
  res.send(`✅ Server aktif (${MODE.toUpperCase()} MODE) dan siap menerima request!`);
});

// ================================================
// 💳 ROUTE UNTUK PEMBAYARAN DARI SHOPIFY
// ================================================
app.get("/pay", async (req, res) => {
  const orderId = req.query.order_id;
  if (!orderId) return res.status(400).send("❌ order_id tidak ditemukan");

  try {
    // 1️⃣ Ambil data order dari Shopify
    const orderResponse = await axios.get(
      `https://${SHOPIFY_STORE}/admin/api/2024-04/orders/${orderId}.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const order = orderResponse.data.order;
    const totalPrice = parseFloat(order.total_price);
    const productNames = order.line_items.map((i) => i.name);
    const quantities = order.line_items.map((i) => i.quantity);
    const prices = order.line_items.map((i) => parseFloat(i.price));

    console.log(`🧾 Membuat link pembayaran iPaymu untuk Order #${orderId}`);

    // 2️⃣ Siapkan body request iPaymu
    const body = {
      product: productNames,
      qty: quantities,
      price: prices,
      returnUrl: `https://${SHOPIFY_STORE}`,
      cancelUrl: `https://${SHOPIFY_STORE}`,
      notifyUrl: `${BASE_URL}/callback`,
      referenceId: orderId,
    };

    // 3️⃣ Generate signature
    const jsonBody = JSON.stringify(body);
    const stringToSign = `POST:${IPAYMU_VA}:${crypto
      .createHash("sha256")
      .update(jsonBody)
      .digest("hex")}:${IPAYMU_APIKEY}`;
    const signature = crypto
      .createHmac("sha256", IPAYMU_APIKEY)
      .update(stringToSign)
      .digest("hex");

    // 4️⃣ Kirim ke iPaymu
    const response = await axios.post(IPAYMU_URL, body, {
      headers: {
        "Content-Type": "application/json",
        va: IPAYMU_VA,
        signature: signature,
        timestamp: new Date().toISOString(),
      },
    });

    // 5️⃣ Redirect pelanggan ke halaman pembayaran iPaymu
    if (response.data?.Data?.Url) {
      console.log("✅ Redirect ke:", response.data.Data.Url);
      return res.redirect(response.data.Data.Url);
    } else {
      console.error("⚠️ Gagal membuat link:", response.data);
      res.status(500).send("Gagal membuat link pembayaran iPaymu");
    }
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    res.status(500).send("Terjadi kesalahan saat membuat pembayaran");
  }
});

// ================================================
// 📩 CALLBACK DARI IPAYMU (PEMBAYARAN OTOMATIS)
// ================================================
app.post("/callback", async (req, res) => {
  console.log("📩 Callback diterima dari iPaymu:", req.body);

  try {
    const { reference_id, status, amount } = req.body;

    if (status === "berhasil") {
      console.log(`✅ Pembayaran order ${reference_id} berhasil!`);

      // 1️⃣ Update status order Shopify jadi "Paid"
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
      console.log(`🟢 Status order ${reference_id} di Shopify diperbarui jadi Paid`);
    } else {
      console.log(`⚠️ Pembayaran ${reference_id} belum berhasil`);
    }

    res.send("Callback diterima ✅");
  } catch (error) {
    console.error("❌ Gagal memproses callback:", error.message);
    res.status(500).send("Error memproses callback");
  }
});

// ================================================
// 🚀 JALANKAN SERVER
// ================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT} (${MODE.toUpperCase()} MODE)`));
