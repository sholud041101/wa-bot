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

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

// --- 1. FITUR TOMBOL MENU BIRU (COMMANDS) ---
// Ini yang memunculkan menu biru di pojok kiri bawah
bot.telegram.setMyCommands([
    { command: 'start', description: '🏠 Mulai / Menu Utama' },
    { command: 'help', description: '❓ Bantuan' },
    { command: 'cancel', description: '❌ Batalkan Proses' }
]);

// --- 2. TAMPILAN MENU UTAMA (MODEL KEYBOARD) ---
// Ini yang membuat tombol besar di bawah layar (seperti "Find a partner")
const showMainMenu = (ctx) => {
    const text = "👋 *Sistem Pelaporan SPPG*\n\nSilakan pilih Divisi Anda lewat tombol di bawah:";
    
    // Perhatikan: Kita pakai Markup.keyboard (bukan inlineKeyboard)
    // .resize() wajib dipakai agar tombolnya tidak kegedean
    const keyboard = Markup.keyboard([
        ['💰 Akuntan', '🥦 Ahli Gizi'], // Baris 1
        ['👷 Asisten Lapangan']         // Baris 2
    ]).resize(); 

    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
};

bot.start((ctx) => {
    ctx.session = {};
    showMainMenu(ctx);
});

// --- 3. MENANGKAP TOMBOL KEYBOARD (Pakai bot.hears) ---
// Karena tombol keyboard itu mengirim teks, kita tangkap teksnya

// A. Jika user klik "💰 Akuntan"
bot.hears('💰 Akuntan', (ctx) => {
    const text = "📂 *Divisi Akuntan*\nSilakan pilih jenis dokumen:";
    // Sub-menu tetap pakai Inline (gelembung) biar rapi
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Nota PO', 'pilih_PO')],
        [Markup.button.callback('📊 RAB Harian', 'pilih_RAB')],
        [Markup.button.callback('📒 Laporan Keuangan', 'pilih_Laporan')],
        [Markup.button.callback('❌ Tutup', 'tutup_menu')]
    ]);
    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
});

// B. Jika user klik "🥦 Ahli Gizi"
bot.hears('🥦 Ahli Gizi', (ctx) => {
    const text = "🥦 *Divisi Ahli Gizi*\nSilakan pilih jenis dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🍲 Menu Harian', 'pilih_MenuGizi')],
        [Markup.button.callback('👁️ Uji Organoleptik', 'pilih_Organoleptik')],
        [Markup.button.callback('❌ Tutup', 'tutup_menu')]
    ]);
    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
});

// C. Jika user klik "👷 Asisten Lapangan"
bot.hears('👷 Asisten Lapangan', (ctx) => {
    const text = "👷 *Divisi Aslap*\nSilakan pilih jenis dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📸 Foto Menu Jadi', 'pilih_FotoMenu')],
        [Markup.button.callback('📦 Penerimaan Barang', 'pilih_Barang')],
        [Markup.button.callback('❌ Tutup', 'tutup_menu')]
    ]);
    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
});

// --- 4. LOGIKA PILIHAN & UPLOAD (Sama seperti sebelumnya) ---

const handleChoice = (ctx, kategori) => {
    ctx.session = { waitingForUpload: true, kategori: kategori };
    // Hapus keyboard bawah sementara saat minta upload (biar fokus)
    ctx.reply(
        `✅ Kategori terpilih: *${kategori}*.\n\nSilakan **KIRIM FOTO/FILE** sekarang.`, 
        { parse_mode: 'Markdown', ...Markup.removeKeyboard() } 
    );
};

// Daftarkan Tombol Inline
bot.action('pilih_PO', (ctx) => handleChoice(ctx, 'PO'));
bot.action('pilih_RAB', (ctx) => handleChoice(ctx, 'RAB'));
bot.action('pilih_Laporan', (ctx) => handleChoice(ctx, 'Laporan'));
bot.action('pilih_MenuGizi', (ctx) => handleChoice(ctx, 'Gizi'));
bot.action('pilih_Organoleptik', (ctx) => handleChoice(ctx, 'Organoleptik'));
bot.action('pilih_FotoMenu', (ctx) => handleChoice(ctx, 'Menu Jadi'));
bot.action('pilih_Barang', (ctx) => handleChoice(ctx, 'Barang'));

// Tombol Tutup/Batal
bot.action('tutup_menu', (ctx) => {
    ctx.deleteMessage(); // Hapus menu inline
});
bot.command('cancel', (ctx) => {
    ctx.session = {};
    ctx.reply("Proses dibatalkan.", Markup.removeKeyboard());
    setTimeout(() => showMainMenu(ctx), 1000); // Munculkan menu lagi
});

// --- 5. PROSES UPLOAD KE N8N ---
bot.on(['photo', 'document'], async (ctx) => {
    if (!ctx.session || !ctx.session.waitingForUpload) {
        // Jika user kirim foto sembarangan, ingatkan pakai tombol
        return ctx.reply("⚠️ Silakan klik tombol Divisi di bawah dulu untuk memilih kategori.", {
            ...Markup.keyboard([
                ['💰 Akuntan', '🥦 Ahli Gizi'],
                ['👷 Asisten Lapangan']
            ]).resize()
        });
    }

    try {
        const loading = await ctx.reply("🚀 Sedang mengirim ke arsip...");
        let fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document.file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);

        if (N8N_WEBHOOK_URL) {
            await axios.post(N8N_WEBHOOK_URL, {
                fileUrl: fileLink.href,
                kategori: ctx.session.kategori,
                sender: ctx.from.first_name
            });
            await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
            await ctx.reply(`✅ *Sukses!* Dokumen *${ctx.session.kategori}* berhasil disimpan.`);
        } else {
            ctx.reply("❌ Link n8n error.");
        }
        
        // Reset dan tampilkan menu utama lagi
        ctx.session = {};
        showMainMenu(ctx);

    } catch (error) {
        console.error("Error:", error);
        ctx.reply("❌ Gagal upload.");
    }
});

bot.launch();
console.log('🤖 Bot dengan Menu Keyboard & Tombol Biru SIAP!');

// Graceful Stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
