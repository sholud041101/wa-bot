const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));

app.post("/whatsapp", (req, res) => {
  const pesan = (req.body.Body || "").toLowerCase();

  // JIKA USER BARU / KETIK HALO
  if (pesan === "halo" || pesan === "hai" || pesan === "hi") {
    res.set("Content-Type", "text/xml");
    res.send(`
<Response>
  <Message>
    <Body>Halo 👋 Silakan pilih menu:</Body>
    <Interactive>
      <Type>button</Type>
      <Action>
        <Buttons>
          <Button>
            <Type>reply</Type>
            <Reply>
              <Id>laporan_harian</Id>
              <Title>Laporan Harian</Title>
            </Reply>
          </Button>
          <Button>
            <Type>reply</Type>
            <Reply>
              <Id>upload_foto</Id>
              <Title>Upload Foto</Title>
            </Reply>
          </Button>
          <Button>
            <Type>reply</Type>
            <Reply>
              <Id>laporan_keuangan</Id>
              <Title>Keuangan</Title>
            </Reply>
          </Button>
        </Buttons>
      </Action>
    </Interactive>
  </Message>
</Response>
    `);
    return;
  }

  // JIKA USER KLIK TOMBOL
  let balasan = "Menu tidak dikenali.";

  if (pesan.includes("laporan_harian")) {
    balasan = "📝 Silakan ketik laporan harian Anda.";
  } else if (pesan.includes("upload_foto")) {
    balasan = "📷 Silakan kirim foto laporan.";
  } else if (pesan.includes("laporan_keuangan")) {
    balasan = "💰 Silakan ketik laporan keuangan.";
  }

  res.set("Content-Type", "text/xml");
  res.send(`
<Response>
  <Message>${balasan}</Message>
</Response>
  `);
});

app.listen(3000, () => {
  console.log("Bot dengan tombol sudah berjalan di port 3000");
});


