require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const axios = require('axios');

// --- AMBIL RAHASIA DARI RAILWAY ---
const BOT_TOKEN = process.env.BOT_TOKEN; 
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; 

if (!BOT_TOKEN || !N8N_WEBHOOK_URL) {
    console.error("❌ ERROR: BOT_TOKEN atau N8N_WEBHOOK_URL belum diisi di Variables Railway!");
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

// --- 2. NAVIGASI MENU (LEVEL 2) ---

// Menu Akuntan
bot.action('menu_akuntan', (ctx) => {
    const text = "📂 *Divisi Akuntan*\nPilih dokumen yg mau diupload:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Nota PO', 'pilih_PO')],
        [Markup.button.callback('📊 RAB Harian', 'pilih_RAB')],
        [Markup.button.callback('📒 Laporan Keuangan', 'pilih_Laporan')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

// Menu Gizi
bot.action('menu_gizi', (ctx) => {
    const text = "🥦 *Divisi Gizi*\nPilih dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🍲 Menu Harian', 'pilih_MenuGizi')],
        [Markup.button.callback('👁️ Uji Organoleptik', 'pilih_Organoleptik')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

// Menu Aslap
bot.action('menu_aslap', (ctx) => {
    const text = "👷 *Divisi Aslap*\nPilih dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📸 Foto Menu Jadi', 'pilih_FotoMenu')],
        [Markup.button.callback('📦 Penerimaan Barang', 'pilih_Barang')],
        [Markup.button.callback('🔙 KEMBALI', 'back_main')]
    ]);
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

// Tombol Back
bot.action('back_main', (ctx) => {
    ctx.session = {}; 
    showMainMenu(ctx, true);
});

// --- 3. LOGIKA MEMILIH KATEGORI ---
const handleChoice = (ctx, kategori) => {
    // Simpan pilihan user di ingatan bot
    ctx.session = { waitingForUpload: true, kategori: kategori };
    
    const text = `✅ Kategori terpilih: *${kategori}*.\n\nSilakan **KIRIM FOTO/FILE** sekarang.`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Batal', 'back_main')]
    ]);
    
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
};

// --- 3. LOGIKA MEMILIH KATEGORI ---
const handleChoice = (ctx, kategori) => {
    // Simpan pilihan user di ingatan bot
    ctx.session = { waitingForUpload: true, kategori: kategori };
    
    const text = `✅ Kategori terpilih: *${kategori}*.\n\nSilakan **KIRIM FOTO/FILE** sekarang.`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Batal', 'back_main')]
    ]);
    
    ctx.editMessageText(text, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
};

// Daftarkan semua tombol pilihan dokumen disini
bot.action('pilih_PO', (ctx) => handleChoice(ctx, 'PO'));
bot.action('pilih_RAB', (ctx) => handleChoice(ctx, 'RAB'));
bot.action('pilih_Laporan', (ctx) => handleChoice(ctx, 'Laporan'));
bot.action('pilih_MenuGizi', (ctx) => handleChoice(ctx, 'Gizi'));
bot.action('pilih_Organoleptik', (ctx) => handleChoice(ctx, 'Organoleptik'));
bot.action('pilih_FotoMenu', (ctx) => handleChoice(ctx, 'Menu Jadi'));
bot.action('pilih_Barang', (ctx) => handleChoice(ctx, 'Barang'));


// --- 4. PROSES UPLOAD (KIRIM KE N8N) ---
bot.on(['photo', 'document'], async (ctx) => {
    // Cek apakah user sudah pilih menu?
    if (!ctx.session || !ctx.session.waitingForUpload) {
        return ctx.reply("⚠️ Harap pilih menu kategori dulu dari tombol di atas 👆");
    }

    try {
        const loading = await ctx.reply("🚀 Sedang mengirim ke arsip...");

        // Ambil Link File dari Server Telegram
        let fileId;
        if (ctx.message.photo) {
            // Ambil foto resolusi tertinggi
            fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        } else {
            fileId = ctx.message.document.file_id;
        }
        const fileLink = await ctx.telegram.getFileLink(fileId);

        // KIRIM PAKET KE N8N
        // Data yang dikirim: Link file, Kategori, dan Nama Pengirim
        await axios.post(N8N_WEBHOOK_URL, {
            fileUrl: fileLink.href,       
            kategori: ctx.session.kategori,
            sender: ctx.from.first_name
        });

        // Sukses
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
        await ctx.reply(`✅ *Sukses!* Dokumen kategori *${ctx.session.kategori}* berhasil disimpan.`);
        
        // Reset ke menu awal
        ctx.session = {}; 
        showMainMenu(ctx, false);

    } catch (error) {
        console.error("Error upload:", error);
        ctx.reply("❌ Gagal koneksi ke n8n. Pastikan n8n aktif.");
    }
});

// Jalankan Bot
bot.launch();
console.log('🤖 Bot Telegram SPPG sudah jalan di Server!');

// Biar aman kalau server restart
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
