// FILE: fitur_rekap.js

// 1. Fungsi Helper Tanggal (Hanya dipakai di file ini)
function getIndonesianDate() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const monthName = months[now.getMonth()];
    const year = now.getFullYear();
    return `${dayName}, ${date} ${monthName} ${year}`;
}

// 2. Template Form Input
const templateLaporan = `
/lapor
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
BUSUI=0
`;

// 3. Fungsi Utama yang akan diexport ke index.js
module.exports = function(bot) {

    // --- LOGIC 1: RESPON TOMBOL MENU ---
    // Pastikan teks 'Rekapitulasi PM Harian' SESUAI PERSIS dengan tombol di keyboard bot Anda
    bot.hears('Rekapitulasi PM Harian', (ctx) => {
        ctx.reply(
            "📋 **FORMULIR LAPORAN HARIAN**\n\n" +
            "Silakan **Copy** teks di bawah ini, **Isi Angkanya**, lalu **Kirim** kembali di sini.\n" +
            "_(Bot akan menghitung total & tanggal secara otomatis)_",
            { parse_mode: 'Markdown' }
        );
        // Kirim template agar mudah di-copy
        ctx.reply(`\`\`\`${templateLaporan}\`\`\``, { parse_mode: 'MarkdownV2' });
    });

    // --- LOGIC 2: PROSES HITUNG LAPORAN ---
    bot.hears(/^\/lapor/i, (ctx) => {
        const text = ctx.message.text;
        const lines = text.split('\n');
        let data = {};
        
        // Ambil angka dari setiap baris
        lines.forEach(line => {
            if(line.includes('=')) {
                const parts = line.split('=');
                const key = parts[0].trim();
                const val = parseInt(parts[1].trim()) || 0;
                data[key] = val;
            }
        });

        // Hitung Sub-Total
        const totalA = (data['KB_JURANG']||0) + (data['KB_MAWADDAH']||0) + (data['TPA_ALHIDAYAH']||0);
        const totalB = (data['RA_TLOGOREJO']||0) + (data['RA_JOHO']||0) + (data['RA_JURANG']||0) + (data['TK_PERMATA']||0);
        const totalC = (data['SD_TLOGOREJO']||0) + (data['SD_2_SIDOREJO']||0);
        const totalD = (data['SMP_4_TMG']||0) + (data['MTSS_ALHUDLORI']||0) + (data['SMP_ALKAUTSAR']||0);
        const totalE = (data['SMK_HKTI']||0);
        const totalF = (data['PKBM_CENDIKIA']||0);

        const totalSiswa = totalA + totalB + totalC + totalD + totalE + totalF;
        const totalB3 = (data['BALITA']||0) + (data['BUMIL']||0) + (data['BUSUI']||0);
        const grandTotal = totalSiswa + totalB3;

        // Susun Teks Laporan Akhir
        const finalReport = `
*${getIndonesianDate()}*

*SPPG Mitra Mandiri Temanggung (Tlogorejo)*
*Melayani penerima manfaat sebanyak ${grandTotal.toLocaleString('id-ID')} (Siswa dan B3)*

*I. Jumlah Siswa ${totalSiswa.toLocaleString('id-ID')} yang dilayani, terdiri dari :*

*A. KB/PAUD : ${totalA}*
- KB MASYITOH JURANG – ${data['KB_JURANG']||0} Siswa
- KB MAWADDAH – ${data['KB_MAWADDAH']||0} Siswa
- TPA AL HIDAYAH – ${data['TPA_ALHIDAYAH']||0} Siswa

*B. TK/RA : ${totalB}*
- RA MASYITHOH AL IMAN TLOGOREJO – ${data['RA_TLOGOREJO']||0} Siswa
- RA MASYITHOH NURUL IMAN JOHO – ${data['RA_JOHO']||0} Siswa
- RA MASYITHOH JURANG – ${data['RA_JURANG']||0} Siswa
- TK TAHFIDZ DAN SAIN PERMATA INSAN – ${data['TK_PERMATA']||0} Siswa

*C. SD/MI : ${totalC}*
- SD NEGERI TLOGOREJO – ${data['SD_TLOGOREJO']||0} Siswa
- SD NEGERI 2 SIDOREJO – ${data['SD_2_SIDOREJO']||0} Siswa

*D. SMP/MTs : ${totalD}*
- SMP NEGERI 4 TEMANGGUNG – ${data['SMP_4_TMG']||0} Siswa
- MTSS INTEGRASI AL HUDLORI – ${data['MTSS_ALHUDLORI']||0} Siswa
- SMP ALKAUTSAR TEMANGGUNG – ${data['SMP_ALKAUTSAR']||0} Siswa

*E. SMA/SMK : ${totalE}*
- SMK HKTI TEMANGGUNG – ${data['SMK_HKTI']||0} Siswa

*F. PKBM : ${totalF}*
- PKBM CENDIKIA MANDIRI – ${data['PKBM_CENDIKIA']||0} Siswa

-------------------------------------

*II. Jumlah B3 (Bumil, Busui, dan Balita): ${totalB3}*
Terdiri dari :
- Balita : ${data['BALITA']||0}
- Bumil : ${data['BUMIL']||0}
- Busui : ${data['BUSUI']||0}

*III. Kegiatan berjalan lancar dan dokumentasi terlampir*
`;
        
        ctx.reply(finalReport, { parse_mode: 'Markdown' });
    });

    console.log("--> Modul Rekapitulasi Berhasil Dimuat");
};
