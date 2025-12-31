require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');

// ==========================================================
// ENV
// ==========================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (!BOT_TOKEN) {
    console.error("❌ BOT_TOKEN belum diisi");
    process.exit(1);
}

if (!N8N_WEBHOOK_URL) {
    console.error("❌ N8N_WEBHOOK_URL belum diisi");
    process.exit(1);
}

// ==========================================================
// INIT BOT
// ==========================================================
const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// CATCH ERROR GLOBAL (WAJIB)
bot.catch((err, ctx) => {
    console.error("❌ BOT ERROR:", err);
});

// ==========================================================
// MODUL REKAP
// ==========================================================
require('./fitur_rekap')(bot);

// ==========================================================
// COMMAND
// ==========================================================
bot.telegram.setMyCommands([
    { command: 'start', description: 'Mulai / Menu Utama' },
    { command: 'cancel', description: 'Batalkan Proses' }
]);

// ==========================================================
// MENU UTAMA
// ==========================================================
const showMainMenu = (ctx) => {
    ctx.reply(
        "👋 <b>Sistem Pelaporan SPPG</b>\n\nSilakan pilih divisi:",
        {
            parse_mode: 'HTML',
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
// MENU DIVISI
// ==========================================================
bot.hears('💰 Akuntan', (ctx) => {
    ctx.reply(
        "<b>📂 Divisi Akuntan</b>",
        {
            parse_mode: 'HTML',
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
        "<b>🥦 Divisi Ahli Gizi</b>",
        {
            parse_mode: 'HTML',
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
        "<b>👷 Divisi Asisten Lapangan</b>",
        {
            parse_mode: 'HTML',
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
// PILIH KATEGORI
// ==========================================================
const handleChoice = (ctx, kategori, label = kategori) => {
    ctx.session = { waitingForUpload: true, kategori };
    ctx.reply(
        `✅ <b>Kategori:</b> ${label}\n\nSilakan kirim <b>FILE / FOTO</b>.`,
        { parse_mode: 'HTML', ...Markup.removeKeyboard() }
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
    ctx.reply("❌ Proses dibatalkan", { parse_mode: 'HTML' });
    setTimeout(() => showMainMenu(ctx), 500);
});

// ==========================================================
// UPLOAD FILE KE N8N (RESPOND TO WEBHOOK)
// ==========================================================
bot.on(['photo', 'document'], async (ctx) => {
    if (!ctx.session?.waitingForUpload) {
        return showMainMenu(ctx);
    }

    const loading = await ctx.reply("🚀 Mengirim file...", { parse_mode: 'HTML' });

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

        if (!res.data || res.data.success !== true) {
            throw new Error(res.data?.error || 'Upload gagal di n8n');
        }

        await ctx.reply("✅ <b>File berhasil disimpan di Google Drive</b>", {
            parse_mode: 'HTML'
        });

    } catch (err) {
        console.error("❌ Upload error:", err.message);
        await ctx.reply("❌ <b>Upload gagal</b>. Silakan coba ulang.", {
            parse_mode: 'HTML'
        });
    }

    ctx.session = {};
    showMainMenu(ctx);
});

// ==========================================================
// START BOT
// ==========================================================
console.log("🚀 Menjalankan bot...");

bot.launch()
    .then(() => console.log("✅ Bot berhasil dijalankan"))
    .catch(err => console.error("❌ Gagal launch bot:", err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
