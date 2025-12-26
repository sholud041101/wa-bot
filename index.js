const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.post("/whatsapp", (req, res) => {
  const pesan = (req.body.Body || "").toLowerCase().trim();

  let balasan = "";

  if (pesan === "halo" || pesan === "hai" || pesan === "hi") {
    balasan =
`Halo 👋
Silakan pilih menu:

1️⃣ Laporan Harian
2️⃣ Upload Foto
3️⃣ Laporan Keuangan

Balas dengan angka (1/2/3).`;
  } 
  else if (pesan === "1") {
    balasan = "📝 Silakan ketik laporan harian Anda.";
  } 
  else if (pesan === "2") {
    balasan = "📷 Silakan kirim foto laporan.";
  } 
  else if (pesan === "3") {
    balasan = "💰 Silakan ketik laporan keuangan.";
  } 
  else {
    balasan = "❓ Menu tidak dikenali. Ketik *halo* untuk melihat menu.";
  }

  res.set("Content-Type", "text/xml");
  res.send(`
<Response>
  <Message>${balasan}</Message>
</Response>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Bot WhatsApp berjalan di port " + PORT);
});
