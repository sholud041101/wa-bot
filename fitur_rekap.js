const { Markup } = require('telegraf');
const axios = require('axios');

// --- Helper: Tanggal Indo ---
function getIndonesianDate() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const now = new Date();
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

// --- Template Form ---
const templateLaporan = `/lapor
KB_JURANG=0
KB_MAWADDAH=0
TPA_ALHIDAYAH=0
RA_TLOGOREJO=0
RA_JOHO=0
RA_JURANG=0
TK_PERMATA=0
SD_TLOGOREJO=0
SD_2_SIDOREJO=0
SMP_4_TMG=0
MTSS_ALHUDLORI=0
SMP_ALKAUTSAR=0
SMK_HKTI=0
PKBM_CENDIKIA=0
BALITA=0
BUMIL=0
BUSUI=0`;

module.exports = function (bot) {
    console.log("--> ✅ Modul Rekapitulasi (Final Update) SIAP");

    // 1. HANDLE TOMBOL MENU 'pilih_RekapPM'
    bot.action('pilih_RekapPM', async (ctx) => {
        try {
            await ctx.answerCbQuery();
            if (ctx.session) ctx.session.waitingForUpload = false;

            await ctx.reply(
                "📋 <b>FORMULIR LAPORAN HARIAN</b>\n\n" +
                "Silakan <b>Copy</b> template di bawah, <b>Isi Angkanya</b>, lalu <b>Kirim</b>.\n" +
                "<i>(Nanti akan ada fitur pengecekan sebelum final)</i>",
                { parse_mode: 'HTML' }
            );
            await ctx.reply(`<pre>${templateLaporan}</pre>`, { parse_mode: 'HTML' });
        } catch (error) {
            console.error("❌ Error tombol rekap:", error);
        }
    });

    // 2. PROSES INPUT & TAMPILKAN PREVIEW (DRAFT)
    bot.hears(/^\/lapor/i, async (ctx) => {
        try {
            ctx.session = ctx.session || {};

            const text = ctx.message.text;
            const lines = text.split('\n');
            let data = {};

            // Parsing Data
            lines.forEach(line => {
                if (line.includes('=')) {
                    const parts = line.split('=');
                    const key = (parts[0] || '').trim();
                    const val = parseInt((parts[1] || '').trim(), 10);
                    data[key] = Number.isFinite(val) ? val : 0;
                }
            });

            // --- Rumus Hitung ---
            const totalA = (data['KB_JURANG'] || 0) + (data['KB_MAWADDAH'] || 0) + (data['TPA_ALHIDAYAH'] || 0);
            const totalB = (data['RA_TLOGOREJO'] || 0) + (data['RA_JOHO'] || 0) + (data['RA_JURANG'] || 0) + (data['TK_PERMATA'] || 0);
            const totalC = (data['SD_TLOGOREJO'] || 0) + (data['SD_2_SIDOREJO'] || 0);
            const totalD = (data['SMP_4_TMG'] || 0) + (data['MTSS_ALHUDLORI'] || 0) + (data['SMP_ALKAUTSAR'] || 0);
            const totalE = (data['SMK_HKTI'] || 0);
            const totalF = (data['PKBM_CENDIKIA'] || 0);

            const totalSiswa = totalA + totalB + totalC + totalD + totalE + totalF;
            const totalB3 = (data['BALITA'] || 0) + (data['BUMIL'] || 0) + (data['BUSUI'] || 0);
            const grandTotal = totalSiswa + totalB3;

            // --- Susun Laporan ---
            const reportContent = `
<b>${getIndonesianDate()}</b>

<b>SPPG Mitra Mandiri Temanggung (Tlogorejo)</b>
Melayani penerima manfaat sebanyak <b>${grandTotal.toLocaleString('id-ID')}</b> (Siswa dan B3)

<b>I. Jumlah Siswa ${totalSiswa.toLocaleString('id-ID')} yang dilayani, terdiri dari :</b>

<b>A. KB/PAUD : ${totalA}</b>
- KB MASYITOH JURANG – ${data['KB_JURANG'] || 0} Siswa
- KB MAWADDAH – ${data['KB_MAWADDAH'] || 0} Siswa
- TPA AL HIDAYAH – ${data['TPA_ALHIDAYAH'] || 0} Siswa

<b>B. TK/RA : ${totalB}</b>
- RA MASYITHOH AL IMAN TLOGOREJO – ${data['RA_TLOGOREJO'] || 0} Siswa
- RA MASYITHOH NURUL IMAN JOHO – ${data['RA_JOHO'] || 0} Siswa
- RA MASYITHOH JURANG – ${data['RA_JURANG'] || 0} Siswa
- TK TAHFIDZ DAN SAIN PERMATA INSAN – ${data['TK_PERMATA'] || 0} Siswa

<b>C. SD/MI : ${totalC}</b>
- SD NEGERI TLOGOREJO – ${data['SD_TLOGOREJO'] || 0} Siswa
- SD NEGERI 2 SIDOREJO – ${data['SD_2_SIDOREJO'] || 0} Siswa

<b>D. SMP/MTs : ${totalD}</b>
- SMP NEGERI 4 TEMANGGUNG – ${data['SMP_4_TMG'] || 0} Siswa
- MTSS INTEGRASI AL HUDLORI – ${data['MTSS_ALHUDLORI'] || 0} Siswa
- SMP ALKAUTSAR TEMANGGUNG – ${data['SMP_ALKAUTSAR'] || 0} Siswa

<b>E. SMA/SMK : ${totalE}</b>
- SMK HKTI TEMANGGUNG – ${data['SMK_HKTI'] || 0} Siswa

<b>F. PKBM : ${totalF}</b>
- PKBM CENDIKIA MANDIRI – ${data['PKBM_CENDIKIA'] || 0} Siswa

-------------------------------------

<b>II. Jumlah B3 (Bumil, Busui, dan Balita): ${totalB3}</b>
Terdiri dari :
- Balita : ${data['BALITA'] || 0}
- Bumil : ${data['BUMIL'] || 0}
- Busui : ${data['BUSUI'] || 0}

<b>III. Kegiatan berjalan lancar dan dokumentasi terlampir</b>`;

            // SIMPAN KE SESSION (PENTING UNTUK KIRIM KE N8N)
            ctx.session.draftLaporan = reportContent;
            ctx.session.pmData = {
                date_indo: getIndonesianDate(),
                date_iso: new Date().toISOString(),
                sender: ctx.from?.first_name || '',
                telegram_user_id: ctx.from?.id || '',
                totals: {
                    totalA, totalB, totalC, totalD, totalE, totalF,
                    totalSiswa,
                    totalB3,
                    grandTotal,
                },
                detail: {
                    KB_JURANG: data['KB_JURANG'] || 0,
                    KB_MAWADDAH: data['KB_MAWADDAH'] || 0,
                    TPA_ALHIDAYAH: data['TPA_ALHIDAYAH'] || 0,
                    RA_TLOGOREJO: data['RA_TLOGOREJO'] || 0,
                    RA_JOHO: data['RA_JOHO'] || 0,
                    RA_JURANG: data['RA_JURANG'] || 0,
                    TK_PERMATA: data['TK_PERMATA'] || 0,
                    SD_TLOGOREJO: data['SD_TLOGOREJO'] || 0,
                    SD_2_SIDOREJO: data['SD_2_SIDOREJO'] || 0,
                    SMP_4_TMG: data['SMP_4_TMG'] || 0,
                    MTSS_ALHUDLORI: data['MTSS_ALHUDLORI'] || 0,
                    SMP_ALKAUTSAR: data['SMP_ALKAUTSAR'] || 0,
                    SMK_HKTI: data['SMK_HKTI'] || 0,
                    PKBM_CENDIKIA: data['PKBM_CENDIKIA'] || 0,
                    BALITA: data['BALITA'] || 0,
                    BUMIL: data['BUMIL'] || 0,
                    BUSUI: data['BUSUI'] || 0,
                }
            };

            // Tampilkan Preview
            await ctx.reply(
                "⚠️ <b>KONFIRMASI DATA</b>\n\n" +
                "Berikut adalah tampilan laporan Anda. Apakah sudah benar?\n\n" +
                "---------------------------------" +
                reportContent +
                "\n---------------------------------",
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('✅ Benar, Kirim Laporan', 'act_kirim_final')],
                        [Markup.button.callback('✏️ Salah, Ingin Edit', 'act_edit_ulang')]
                    ])
                }
            );

        } catch (error) {
            console.error("❌ Error hitung lapor:", error);
            ctx.reply("Format data salah. Pastikan copy-paste template dengan benar.");
        }
    });

    // 3. ACTION: JIKA TOMBOL 'KIRIM' DITEKAN
    bot.action('act_kirim_final', async (ctx) => {
        try {
            const finalReport = ctx.session?.draftLaporan;
            const pmData = ctx.session?.pmData;

            if (!finalReport || !pmData) {
                return ctx.reply("⚠️ Sesi kadaluarsa. Silakan input ulang /lapor");
            }

            // (Opsional) Beri tanda proses
            const loading = await ctx.reply("⏳ Mengirim data ke Google Sheet...");

            // A. KIRIM KE N8N (INI YANG MEMBUAT SHEET TERISI)
            const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
            if (!N8N_WEBHOOK_URL) {
                await ctx.reply("❌ N8N_WEBHOOK_URL belum diisi di Railway. Hubungi admin.");
                return;
            }

            const res = await axios.post(N8N_WEBHOOK_URL, {
                type: 'pm_harian',
                reportHtml: finalReport,   // untuk arsip / preview
                ...pmData                 // data angka terstruktur untuk sheet
            });

            // Hapus pesan loading
            try { await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id); } catch (e) {}

            // Validasi respon n8n
            if (!res.data || res.data.success !== true) {
                throw new Error(res.data?.error || 'Respon n8n tidak success');
            }

            // B. Hapus menu preview lama (yang ada tombol)
            await ctx.deleteMessage();

            // C. Kirim Laporan FINAL (Laporan Utama)
            await ctx.reply(finalReport, { parse_mode: 'HTML' });

            // D. Kirim Ucapan Terima Kasih (Pesan Tambahan)
            await ctx.reply(
                "✅ <b>DATA DITERIMA</b>\n\n" +
                "Terima kasih telah melakukan pelaporan Penerima Manfaat Harian, data sudah tersimpan di Google Sheet.",
                { parse_mode: 'HTML' }
            );

            // E. Popup kecil
            await ctx.answerCbQuery("✅ Terkirim!");

            // Bersihkan session hanya jika sukses
            ctx.session.draftLaporan = null;
            ctx.session.pmData = null;

        } catch (error) {
            console.error("Error kirim final (n8n/sheet):", error?.message || error);

            // Jangan hapus draft kalau gagal, supaya user bisa coba lagi tanpa isi ulang
            try { await ctx.answerCbQuery("❌ Gagal"); } catch (e) {}

            await ctx.reply(
                "❌ <b>Gagal menyimpan ke Google Sheet</b>\n\n" +
                "Silakan coba tekan <b>✅ Benar, Kirim Laporan</b> lagi.\n" +
                "Jika masih gagal, kemungkinan masalah ada di n8n (credential / mapping / respond).",
                { parse_mode: 'HTML' }
            );
        }
    });

    // 4. ACTION: JIKA TOMBOL 'EDIT' DITEKAN
    bot.action('act_edit_ulang', async (ctx) => {
        await ctx.answerCbQuery("✏️ Mode Edit");
        await ctx.reply(
            "🛠 <b>CARA EDIT:</b>\n\n" +
            "1. <b>Salin (Copy)</b> pesan formulir Anda di atas yang salah.\n" +
            "2. <b>Tempel (Paste)</b> di kolom ketik.\n" +
            "3. <b>Perbaiki</b> angkanya.\n" +
            "4. <b>Kirim</b> ulang.",
            { parse_mode: 'HTML' }
        );
    });
};
