require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');

// --- AMBIL RAHASIA DARI RAILWAY ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

// Cek apakah token ada
if (!BOT_TOKEN) {
    console.error("❌ ERROR FATAL: BOT_TOKEN belum diisi di Railway Variables!");
    process.exit(1); 
}

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// --- 1. TAMPILAN MENU UTAMA ---
const showMainMenu = (ctx, isEdit = false) => {
    const text = "👋 *Sistem Pelaporan SPPG*\nSilakan pilih Divisi Anda:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('💰 Akuntan', 'menu_akuntan')],
        [Markup.button.callback('🥦 Ahli Gizi', 'menu_gizi')],
        [Markup.button.callback('👷 Asisten Lapangan', 'menu_aslap')]
    ]);

    if (isEdit) {
        ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
    } else {
        ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
    }
};

bot.start((ctx) => {
    ctx.session = {};
    showMainMenu(ctx, false);
});

// --- 2. NAVIGASI MENU ---
bot.action('menu_akuntan', (ctx) => {
    const text = "📂 *Divisi Akuntan*\nPilih dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Nota PO', 'pilih_PO')],
        [Markup.button.callback('📊 RAB Harian', 'pilih_RAB')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('menu_gizi', (ctx) => {
    const text = "🥦 *Divisi Gizi*\nPilih dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🍲 Menu Harian', 'pilih_MenuGizi')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('menu_aslap', (ctx) => {
    const text = "👷 *Divisi Aslap*\nPilih dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📸 Foto Menu Jadi', 'pilih_FotoMenu')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('back_main', (ctx) => {
    ctx.session = {};
    showMainMenu(ctx, true);
});

// --- 3. LOGIKA PILIHAN ---
const handleChoice = (ctx, kategori) => {
    ctx.session = { waitingForUpload: true, kategori: kategori };
    const text = `✅ Kategori: *${kategori}*.\n\nSilakan **KIRIM FOTO** sekarang.`;
    const keyboard = Markup.inlineKeyboard([[Markup.button.callback('🔙 Batal', 'back_main')]]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
};

bot.action('pilih_PO', (ctx) => handleChoice(ctx, 'PO'));
bot.action('pilih_RAB', (ctx) => handleChoice(ctx, 'RAB'));
bot.action('pilih_MenuGizi', (ctx) => handleChoice(ctx, 'Gizi'));
bot.action('pilih_FotoMenu', (ctx) => handleChoice(ctx, 'Menu Jadi'));

// --- 4. UPLOAD SYSTEM ---
bot.on(['photo', 'document'], async (ctx) => {
    if (!ctx.session || !ctx.session.waitingForUpload) {
        return ctx.reply("⚠️ Pilih menu dulu di atas.");
    }
    try {
        const loading = await ctx.reply("🚀 Mengirim data...");
        let fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document.file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);

        if (N8N_WEBHOOK_URL) {
            await axios.post(N8N_WEBHOOK_URL, {
                fileUrl: fileLink.href,
                kategori: ctx.session.kategori
            });
            await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
            await ctx.reply(`✅ *Sukses!* File masuk kategori ${ctx.session.kategori}.`);
        } else {
            ctx.reply("❌ Link n8n belum disetting di Railway.");
        }
        ctx.session = {};
        showMainMenu(ctx, false);
    } catch (e) {
        console.error(e);
        ctx.reply("❌ Error koneksi.");
    }
});

bot.launch();
console.log('✅ BOT BERHASIL NYALA!');

// Stop handler
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
