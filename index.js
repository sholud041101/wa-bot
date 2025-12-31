require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');

// ==================================================
// ENV
// ==================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!BOT_TOKEN || !N8N_WEBHOOK_URL) {
    console.error("❌ ENV belum lengkap");
    process.exit(1);
}

// ==================================================
// INIT BOT
// ==================================================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ==================================================
// MENU UTAMA
// ==================================================
function showMainMenu(ctx) {
    ctx.reply(
        "Sistem Pelaporan SPPG\n\nPilih Divisi:",
        Markup.keyboard([
            ['Akuntan', 'Ahli Gizi'],
            ['Asisten Lapangan']
        ]).resize()
    );
}

bot.start((ctx) => {
    ctx.session = {};
    showMainMenu(ctx);
});

// ==================================================
// MENU DIVISI
// ==================================================
bot.hears('Akuntan', (ctx) => {
    ctx.reply(
        "Divisi Akuntan",
        Markup.inlineKeyboard([
            [Markup.button.callback('Nota PO', 'pilih_PO')],
            [Markup.button.callback('RAB', 'pilih_RAB')],
            [Markup.button.callback('Laporan Keuangan', 'pilih_Laporan')]
        ])
    );
});

bot.hears('Ahli Gizi', (ctx) => {
    ctx.reply(
        "Divisi Ahli Gizi",
        Markup.inlineKeyboard([
            [Markup.button.callback('Menu Harian', 'pilih_Gizi')],
            [Markup.button.callback('Uji Organoleptik', 'pilih_Organoleptik')]
        ])
    );
});

bot.hears('Asisten Lapangan', (ctx) => {
    ctx.reply(
        "Divisi Asisten Lapangan",
        Markup.inlineKeyboard([
            [Markup.button.callback('Foto Menu Jadi', 'pilih_Menu')],
            [Markup.button.callback('Penerimaan Barang', 'pilih_Barang')]
        ])
    );
});

// ==================================================
// PILIH KATEGORI
// ==================================================
function pilihKategori(ctx, kategori) {
    ctx.session.waitingForUpload = true;
    ctx.session.kategori = kategori;

    ctx.reply(`Kategori dipilih: ${kategori}\nSilakan kirim FILE / FOTO`);
}

bot.action('pilih_PO', (ctx) => pilihKategori(ctx, 'PO'));
bot.action('pilih_RAB', (ctx) => pilihKategori(ctx, 'RAB'));
bot.action('pilih_Laporan', (ctx) => pilihKategori(ctx, 'Laporan'));
bot.action('pilih_Gizi', (ctx) => pilihKategori(ctx, 'Gizi'));
bot.action('pilih_Organoleptik', (ctx) => pilihKategori(ctx, 'Organoleptik'));
bot.action('pilih_Menu', (ctx) => pilihKategori(ctx, 'Menu'));
bot.action('pilih_Barang', (ctx) => pilihKategori(ctx, 'Barang'));

// ==================================================
// UPLOAD FILE (INI SATU-SATUNYA BAGIAN BARU)
// ==================================================
bot.on(['photo', 'document'], async (ctx) => {
    if (!ctx.session.waitingForUpload) {
        return showMainMenu(ctx);
    }

    try {
        const fileId = ctx.message.photo
            ? ctx.message.photo[ctx.message.photo.length - 1].file_id
            : ctx.message.document.file_id;

        const fileLink = await ctx.telegram.getFileLink(fileId);

        const response = await axios.post(N8N_WEBHOOK_URL, {
            type: 'file',
            fileUrl: fileLink.href,
            kategori: ctx.session.kategori,
            sender: ctx.from.first_name
        });

        // 🔑 VALIDASI RESPOND n8n (INI KUNCI)
        if (!response.data || response.data.success !== true) {
            throw new Error('Upload gagal di server');
        }

        ctx.reply("✅ File BERHASIL disimpan");

    } catch (error) {
        console.error("❌ Upload error:", error.message);
        ctx.reply("❌ Upload GAGAL. Silakan coba ulang.");
    }

    ctx.session = {};
    showMainMenu(ctx);
});

// ==================================================
// START BOT (JANGAN DIUBAH)
// ==================================================
bot.launch();
console.log("🤖 Bot berjalan");

// ==================================================
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
