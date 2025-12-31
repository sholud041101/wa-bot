require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');

// --- AMBIL RAHASIA ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!BOT_TOKEN) {
    console.error("❌ ERROR: BOT_TOKEN belum diisi!");
    process.exit(1);
}

if (!N8N_WEBHOOK_URL) {
    console.error("❌ ERROR: N8N_WEBHOOK_URL belum diisi!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// ==========================================================
// 1. INTEGRASI MODUL REKAP
// ==========================================================
require('./fitur_rekap')(bot);

// ==========================================================
// 2. COMMAND BOT
// ==========================================================
bot.telegram.setMyCommands([
    { command: 'start', description: '🏠 Mulai / Menu Utama' },
    { command: 'help', description: '❓ Bantuan' },
    { command: 'cancel', description: '❌ Batalkan Proses' }
]);

// ==========================================================
// 3. MENU UTAMA
// ==========================================================
const showMainMenu = (ctx) => {
    ctx.reply(
        "👋 *Sistem Pelaporan SPPG*\n\nSilakan pilih Divisi:",
        {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
                ['💰 Akuntan', '🥦 Ahli Gizi'],
                ['👷 Asisten Lapangan']
            ]).resize()
        }
    );
};

bot.start((ctx) => {
    ctx.session = {};
    showMainMenu(ctx);
});

// ==========================================================
// 4. MENU DIVISI
// ==========================================================
bot.hears('💰 Akuntan', (ctx) => {
    ctx.reply(
        "📂 *Divisi Akuntan*",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📄 Nota PO', 'pilih_PO')],
                [Markup.button.callback('📊 RAB Harian', 'pilih_RAB')],
                [Markup.button.callback('📒 Laporan Keuangan', 'pilih_Laporan')],
                [Markup.button.callback('❌ Tutup', 'tutup_menu')]
            ])
        }
    );
});

bot.hears('🥦 Ahli Gizi', (ctx) => {
    ctx.reply(
        "🥦 *Divisi Ahli Gizi*",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🍲 Menu Harian', 'pilih_MenuGizi')],
                [Markup.button.callback('👁️ Uji Organoleptik', 'pilih_Organoleptik')],
                [Markup.button.callback('❌ Tutup', 'tutup_menu')]
            ])
        }
    );
});

bot.hears('👷 Asisten Lapangan', (ctx) => {
    ctx.reply(
        "👷 *Divisi Asisten Lapangan*",
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('📸 Foto Menu Jadi', 'pilih_FotoMenu')],
                [Markup.button.callback('📦 Penerimaan Barang', 'pilih_Barang')],
                [Markup.button.callback('📝 Rekap PM Harian', 'pilih_RekapPM')],
                [Markup.button.callback('🚚 Dokumentasi Distribusi', 'pilih_DokDistribusi')],
                [Markup.button.callback('❌ Tutup', 'tutup_menu')]
            ])
        }
    );
});

// ==========================================================
// 5. PILIH KATEGORI
// ==========================================================
const handleChoice = (ctx, kategori, label = kategori) => {
    ctx.session = { waitingForUpload: true, kategori };
    ctx.reply(
        `✅ Kategori: *${label}*\n\nSilakan kirim FILE / FOTO.`,
        { parse_mode: 'Markdown', ...Markup.removeKeyboard() }
    );
};

bot.action('pilih_PO', (ctx) => handleChoice(ctx, 'PO'));
bot.action('pilih_RAB', (ctx) => handleChoice(ctx, 'RAB'));
bot.action('pilih_Laporan', (ctx) => handleChoice(ctx, 'Laporan'));
bot.action('pilih_MenuGizi', (ctx) => handleChoice(ctx, 'Gizi'));
bot.action('pilih_Organoleptik', (ctx) => handleChoice(ctx, 'Organoleptik'));
bot.action('pilih_FotoMenu', (ctx) => handleChoice(ctx, 'Menu Jadi'));
bot.action('pilih_Barang', (ctx) => handleChoice(ctx, 'Barang'));
bot.action('pilih_DokDistribusi', (ctx) => handleChoice(ctx, 'Distribusi', 'Dokumentasi Distribusi'));

bot.action('tutup_menu', (ctx) => ctx.deleteMessage());

bot.command('cancel', (ctx) => {
    ctx.session = {};
    ctx.reply("❌ Proses dibatalkan.");
    setTimeout(() => showMainMenu(ctx), 500);
});

// ==========================================================
// 6. UPLOAD FILE KE N8N (VERSI FINAL)
// ==========================================================
bot.on(['photo', 'document'], async (ctx) => {
    if (!ctx.session?.waitingForUpload) {
        return showMainMenu(ctx);
    }

    const loading = await ctx.reply("🚀 Mengirim file ke server...");

    try {
        const fileId = ctx.message.photo
            ? ctx.message.photo[ctx.message.photo.length - 1].file_id
            : ctx.message.document.file_id;

        const fileLink = await ctx.telegram.getFileLink(fileId);

        const res = await axios.post(N8N_WEBHOOK_URL, {
            type: 'file',
            fileUrl: fileLink.href,
            kategori: ctx.session.kategori,
            sender: ctx.from.first_name
        });

        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);

        // 🔑 VALIDASI RESPOND n8n
        if (!res.data || res.data.success !== true) {
            throw new Error(res.data?.error || 'Upload gagal di n8n');
        }

        await ctx.reply("✅ File BERHASIL disimpan di Google Drive");

    } catch (err) {
        console.error("❌ Upload Error:", err.message);
        await ctx.reply("❌ Upload GAGAL. Silakan coba ulang.");
    }

    ctx.session = {};
    showMainMenu(ctx);
});

// ==========================================================
// 7. LAPORAN TEKS
// ==========================================================
bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith('/')) return;

    const loading = await ctx.reply("⏳ Mengirim laporan teks...");

    try {
        const res = await axios.post(N8N_WEBHOOK_URL, {
            type: 'text',
            textContent: text,
            sender: ctx.from.first_name,
            date: new Date().toISOString()
        });

        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);

        if (!res.data || res.data.success !== true) {
            throw new Error('Gagal simpan laporan');
        }

        ctx.reply("✅ Laporan teks berhasil disimpan");

    } catch (err) {
        console.error(err.message);
        ctx.reply("❌ Gagal mengirim laporan teks");
    }
});

// ==========================================================
// START BOT
// ==========================================================
bot.launch();
console.log("🤖 Bot SPPG AKTIF");

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
