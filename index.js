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

// ==========================================================
// 1. INTEGRASI MODUL BARU (REKAPITULASI OTOMATIS)
// ==========================================================
require('./fitur_rekap')(bot);


// --- 2. FITUR TOMBOL MENU BIRU (COMMANDS) ---
bot.telegram.setMyCommands([
    { command: 'start', description: '🏠 Mulai / Menu Utama' },
    { command: 'help', description: '❓ Bantuan' },
    { command: 'cancel', description: '❌ Batalkan Proses' }
]);

// --- 3. TAMPILAN MENU UTAMA (MODEL KEYBOARD) ---
const showMainMenu = (ctx) => {
    const text = "👋 *Sistem Pelaporan SPPG*\n\nSilakan pilih Divisi Anda lewat tombol di bawah:";
    
    // Tombol Besar di Bawah Layar
    const keyboard = Markup.keyboard([
        ['💰 Akuntan', '🥦 Ahli Gizi'],
        ['👷 Asisten Lapangan']
    ]).resize(); 

    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
};

bot.start((ctx) => {
    ctx.session = {};
    showMainMenu(ctx);
});

// --- 4. MENANGKAP TOMBOL KEYBOARD ---

// A. Divisi Akuntan
bot.hears('💰 Akuntan', (ctx) => {
    const text = "📂 *Divisi Akuntan*\nSilakan pilih jenis dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📄 Nota PO', 'pilih_PO')],
        [Markup.button.callback('📊 RAB Harian', 'pilih_RAB')],
        [Markup.button.callback('📒 Laporan Keuangan', 'pilih_Laporan')],
        [Markup.button.callback('❌ Tutup', 'tutup_menu')]
    ]);
    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
});

// B. Divisi Ahli Gizi
bot.hears('🥦 Ahli Gizi', (ctx) => {
    const text = "🥦 *Divisi Ahli Gizi*\nSilakan pilih jenis dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🍲 Menu Harian', 'pilih_MenuGizi')],
        [Markup.button.callback('👁️ Uji Organoleptik', 'pilih_Organoleptik')],
        [Markup.button.callback('❌ Tutup', 'tutup_menu')]
    ]);
    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
});

// C. Divisi Asisten Lapangan
bot.hears('👷 Asisten Lapangan', (ctx) => {
    const text = "👷 *Divisi Aslap*\nSilakan pilih jenis dokumen:";
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('📸 Foto Menu Jadi', 'pilih_FotoMenu')],
        [Markup.button.callback('📦 Penerimaan Barang', 'pilih_Barang')],
        
        // Tombol ini nanti akan ditangani oleh fitur_rekap.js
        [Markup.button.callback('📝 Rekap PM Harian', 'pilih_RekapPM')],            

        [Markup.button.callback('🚚 Dokumentasi Distribusi', 'pilih_DokDistribusi')],
        [Markup.button.callback('❌ Tutup', 'tutup_menu')]
    ]);
    ctx.reply(text, { parse_mode: 'Markdown', ...keyboard });
});

// --- 5. LOGIKA PILIHAN & UPLOAD (FILE/FOTO) ---

const handleChoice = (ctx, kategori, namaLengkap) => {
    ctx.session = { waitingForUpload: true, kategori: kategori };
    const label = namaLengkap || kategori;
    
    ctx.reply(
        `✅ Kategori terpilih: *${label}*.\n\nSilakan **KIRIM FOTO/FILE** sekarang.`, 
        { parse_mode: 'Markdown', ...Markup.removeKeyboard() } 
    );
};

// Daftarkan Tombol Upload
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
    ctx.reply("Proses dibatalkan.", Markup.removeKeyboard());
    setTimeout(() => showMainMenu(ctx), 1000);
});

// --- 6. PROSES UPLOAD FILE KE N8N ---
bot.on(['photo', 'document'], async (ctx) => {
    // Cek apakah user sudah menekan tombol kategori sebelumnya?
    if (!ctx.session || !ctx.session.waitingForUpload) {
        return ctx.reply("⚠️ Silakan klik tombol Divisi di bawah dulu untuk memilih kategori.", {
            ...Markup.keyboard([
                ['💰 Akuntan', '🥦 Ahli Gizi'],
                ['👷 Asisten Lapangan']
            ]).resize()
        });
    }

    try {
        const loading = await ctx.reply("🚀 Sedang mengirim file ke arsip...");
        let fileId = ctx.message.photo ? ctx.message.photo[ctx.message.photo.length - 1].file_id : ctx.message.document.file_id;
        const fileLink = await ctx.telegram.getFileLink(fileId);

        if (N8N_WEBHOOK_URL) {
            await axios.post(N8N_WEBHOOK_URL, {
                type: 'file', // <--- Penanda untuk Switch n8n (Jalur Atas)
                fileUrl: fileLink.href,
                kategori: ctx.session.kategori,
                sender: ctx.from.first_name
            });
            await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
            await ctx.reply(`✅ *Sukses!* Dokumen berhasil disimpan.`);
        } else {
            ctx.reply("❌ Link n8n error (Environment Variable kosong).");
        }
        
        ctx.session = {};
        showMainMenu(ctx);

    } catch (error) {
        console.error("Error File:", error);
        ctx.reply("❌ Gagal upload file.");
    }
});

// --- 7. HANDLER TEXT LAPORAN (PENAMBAHAN BARU) ---
// Ini akan menangkap teks biasa yang diketik user
bot.on('text', async (ctx) => {
    const textPesan = ctx.message.text;

    // Filter 1: Jangan respon jika itu Command (awalan /)
    if (textPesan.startsWith('/')) return;

    // Filter 2: Jangan respon jika itu Tombol Menu Utama (supaya tidak double)
    if (['💰 Akuntan', '🥦 Ahli Gizi', '👷 Asisten Lapangan'].includes(textPesan)) return;

    // Filter 3: Jangan respon tombol Cancel
    if (textPesan === '❌ Batalkan Proses') return;

    console.log(`📨 Menerima Teks Laporan: ${textPesan}`);
    const loading = await ctx.reply('⏳ Sedang meneruskan laporan teks ke database...');

    try {
        if (N8N_WEBHOOK_URL) {
            // Kirim ke n8n
            await axios.post(N8N_WEBHOOK_URL, {
                type: 'text',              // <--- PENTING: Kunci untuk Switch n8n (Jalur Bawah)
                textContent: textPesan,    // Isi Laporan
                sender: ctx.from.first_name,
                date: new Date().toISOString()
            });
            
            await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id);
            ctx.reply('✅ Laporan Teks berhasil masuk database!');
        } else {
            ctx.reply("❌ Gagal: URL Webhook belum disetting di Railway.");
        }
    } catch (error) {
        console.error('❌ Gagal kirim teks:', error.message);
        ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
        ctx.reply('❌ Gagal mengirim laporan ke server n8n.');
    }
});

// --- START BOT ---
bot.launch();
console.log('🤖 Bot Update Aslap SIAP!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
