const cron = require("node-cron");
const Jadwal = require("../jadwal/jadwal.model");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");

const startCronJob = (io) => {
  console.log("✅ File cron job dimuat");

  cron.schedule("* * * * *", async () => {
    const now = new Date();
    console.log("⏰ [CRON] Cek jadwal pada:", now.toLocaleString());

    /* =========================
    🚫 AUTO REJECT: Jadwal yang sudah lewat waktu tapi masih 'menunggu'
    ========================= */
    try {
      const menunggujadwals = await Jadwal.find({
        status_konsul: "menunggu", // atau sesuaikan dengan status pending di sistem Anda
      })
        .populate("dokter_id")
        .populate("masyarakat_id");

      console.log(
        `🕒 Ditemukan ${menunggujadwals.length} jadwal yang masih menunggu persetujuan`
      );

      for (const jadwal of menunggujadwals) {
        const { tgl_konsul, jam_konsul } = jadwal;

        if (!tgl_konsul || !jam_konsul || !jam_konsul.includes(":")) {
          // console.log(`⚠️ Jadwal tidak lengkap, dilewati: ${jadwal._id}`);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        
        // ✅ PERBAIKAN: Buat objek Date yang tepat dengan timezone
        const konsultasiTime = new Date(tgl_konsul);
        konsultasiTime.setHours(hour, minute, 0, 0); // Set jam, menit, detik, milidetik
        
        // ✅ PERBAIKAN: Tambahkan buffer waktu (misalnya 5 menit) agar tidak langsung ditolak
        const bufferTime = new Date(konsultasiTime.getTime() - 5 * 60 * 1000); // 5 menit sebelum jadwal

        // ✅ PERBAIKAN: Bandingkan dengan waktu sekarang yang sudah melewati buffer
        // Hanya tolak jika waktu sekarang sudah melewati waktu konsultasi (bukan hanya jam)
        if (now > konsultasiTime) {
          console.log(`⏰ Evaluasi jadwal ${jadwal._id}:`);
          console.log(`   Waktu sekarang: ${now.toLocaleString('id-ID')}`);
          console.log(`   Waktu konsultasi: ${konsultasiTime.toLocaleString('id-ID')}`);
          console.log(`   Selisih: ${Math.round((now - konsultasiTime) / (1000 * 60))} menit`);
          
          // Auto reject jadwal
          jadwal.status_konsul = "ditolak";
          jadwal.alasan_tolak =
            "Otomatis ditolak karena dokter tidak merespons sebelum jadwal konsultasi";
          await jadwal.save();

          console.log(
            `❌ Jadwal ${jadwal._id} otomatis ditolak karena dokter tidak merespons sebelum ${konsultasiTime.toLocaleString('id-ID')}`
          );

          // Opsional: Kirim notifikasi ke masyarakat bahwa jadwalnya ditolak
          if (jadwal.masyarakat_id) {
            io.to(jadwal.masyarakat_id.toString()).emit("jadwalDitolak", {
              jadwalId: jadwal._id,
              message:
                "Maaf, jadwal konsultasi Anda otomatis dibatalkan karena dokter tidak merespons sebelum waktu konsultasi.",
              alasan: jadwal.alasan_tolak,
              waktu_konsul: `${konsultasiTime.toLocaleDateString(
                "id-ID"
              )} ${jam_konsul}`,
            });
          }
        } else {
          // ✅ TAMBAHAN: Log untuk debugging
          const minutesUntil = Math.round((konsultasiTime - now) / (1000 * 60));
          if (minutesUntil < 60) { // Log hanya jika kurang dari 1 jam
            console.log(`⏳ Jadwal ${jadwal._id} masih ${minutesUntil} menit lagi (${konsultasiTime.toLocaleString('id-ID')})`);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error auto reject jadwal menunggu:", error);
    }

    /* =========================
    📨 KIRIM PESAN OTOMATIS: Jadwal yang sudah diterima dan waktunya tiba
    ========================= */
    try {
      const jadwals = await Jadwal.find({
        status_konsul: "diterima",
        autoMessageSent: { $ne: true },
      })
        .populate("dokter_id")
        .populate("masyarakat_id");

      console.log(
        `📋 Ditemukan ${jadwals.length} jadwal yang belum dikirimi pesan`
      );

      for (const jadwal of jadwals) {
        const {
          dokter_id: dokter,
          masyarakat_id: masyarakat,
          tgl_konsul,
          jam_konsul,
        } = jadwal;

        if (!dokter || !masyarakat || !jam_konsul) {
          // console.log("⚠️ Jadwal tidak lengkap, dilewati:", jadwal._id);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        
        // ✅ PERBAIKAN: Konsisten dengan pembuatan waktu
        const konsultasiTime = new Date(tgl_konsul);
        konsultasiTime.setHours(hour, minute, 0, 0);

        const endTime = new Date(konsultasiTime);
        endTime.setMinutes(endTime.getMinutes() + 3); // Konsultasi 3 menit

        if (now >= konsultasiTime && now < endTime) {
          const dokterId = dokter._id;
          const masyarakatId = masyarakat._id;
          const pesanTemplate = "Halo, ada yang bisa dibantu?";

          // Simpan pesan pertama
          const newChat = await Chat.create({
            senderId: dokterId,
            receiverId: masyarakatId,
            text: pesanTemplate,
            type: "text",
            role: "dokter",
            waktu: now,
          });

          // Emit ke socket.io
          io.to(masyarakatId.toString()).emit("chat message", newChat);
          io.to(dokterId.toString()).emit("chat message", newChat);

          // Update atau buat ChatList
          let chatlist = await ChatList.findOne({
            "participants.user": { $all: [dokterId, masyarakatId] },
          });

          if (!chatlist) {
            chatlist = await ChatList.create({
              participants: [
                { user: dokterId, role: "Dokter" },
                { user: masyarakatId, role: "Masyarakat" },
              ],
              jadwal: jadwal._id,
              lastMessage: pesanTemplate,
              lastMessageDate: now,
              status: "berlangsung",
            });
          } else {
            chatlist.lastMessage = pesanTemplate;
            chatlist.lastMessageDate = now;
            chatlist.status = "berlangsung";
            chatlist.jadwal = jadwal._id;
            await chatlist.save();
          }

          // Tandai pesan otomatis sudah dikirim & ubah status konsul
          jadwal.autoMessageSent = true;
          jadwal.status_konsul = "berlangsung";
          await jadwal.save();

          console.log(
            `✅ Pesan otomatis dikirim & status jadi 'berlangsung' untuk jadwal ${jadwal._id} pada ${konsultasiTime.toLocaleString('id-ID')}`
          );
        } else {
          const minutesUntil = Math.round((konsultasiTime - now) / (1000 * 60));
          if (Math.abs(minutesUntil) < 60) { // Log jika dekat dengan waktu konsultasi
            console.log(
              `⏳ Jadwal ${jadwal._id}: ${minutesUntil > 0 ? `${minutesUntil} menit lagi` : `sudah lewat ${Math.abs(minutesUntil)} menit`} (${konsultasiTime.toLocaleString('id-ID')})`
            );
          }
        }
      }
    } catch (error) {
      console.error("❌ Error kirim pesan otomatis:", error);
    }

    /* =========================
    ⏹️ AUTO SELESAI: ChatList yang sudah lewat 3 menit
    ========================= */
    try {
      const chatLists = await ChatList.find({ status: "berlangsung" }).populate(
        "jadwal"
      );

      for (const chat of chatLists) {
        const jadwal = chat.jadwal;

        if (!jadwal) {
          continue;
        }

        const { tgl_konsul, jam_konsul } = jadwal;

        if (!tgl_konsul || !jam_konsul || !jam_konsul.includes(":")) {
          // console.log(`⚠️ Jadwal tidak lengkap/salah format: ${jadwal._id}`);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        
        // ✅ PERBAIKAN: Konsisten dengan pembuatan waktu
        const startTime = new Date(tgl_konsul);
        startTime.setHours(hour, minute, 0, 0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit

        if (now >= endTime) {
          chat.status = "selesai";
          await chat.save();

          if (jadwal.status_konsul !== "selesai") {
            jadwal.status_konsul = "selesai";
            await jadwal.save();
            console.log(
              `✅ Status Jadwal ${jadwal._id} berhasil diubah ke 'selesai' pada ${now.toLocaleString('id-ID')}`
            );
          }

          // Emit notifikasi bahwa konsultasi selesai
          chat.participants.forEach((participant) => {
            io.to(participant.user.toString()).emit("consultationEnded", {
              message:
                "⏰ Waktu konsultasi telah berakhir. Konsultasi otomatis ditutup.",
              jadwalId: jadwal._id,
            });
          });

          console.log(
            `⏹️ Jadwal ${jadwal._id} & ChatList ${chat._id} otomatis jadi 'selesai' setelah ${endTime.toLocaleString('id-ID')}`
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai (ChatList):", err);
    }

    /* =========================
    🔄 REACTIVE: ChatList selesai yang waktunya sedang berlangsung
    ========================= */
    try {
      const selesaiChats = await ChatList.find({ status: "selesai" }).populate(
        "jadwal"
      );

      for (const chat of selesaiChats) {
        const jadwal = chat.jadwal;
        if (!jadwal) continue;

        // Skip jadwal yang sudah ditolak
        if (jadwal.status_konsul === "ditolak") continue;

        const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
        
        // ✅ PERBAIKAN: Konsisten dengan pembuatan waktu
        const startTime = new Date(jadwal.tgl_konsul);
        startTime.setHours(hour, minute, 0, 0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit

        if (
          startTime <= now &&
          now <= endTime &&
          jadwal.status_konsul === "diterima"
        ) {
          // waktunya sedang berlangsung dan jadwal diterima
          if (chat.status === "selesai") {
            chat.status = "berlangsung";
            await chat.save();

            if (jadwal.status_konsul !== "berlangsung") {
              jadwal.status_konsul = "berlangsung";
              await jadwal.save();
            }

            console.log(
              `✅ ChatList ${chat._id} diubah ke 'berlangsung' karena waktunya tiba (${startTime.toLocaleString('id-ID')})`
            );
          }
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status berlangsung (ChatList):", err);
    }

    /* =========================
    🛡️ FALLBACK: Jadwal berlangsung yang sudah lewat waktu
    ========================= */
    try {
      const allJadwalBerlangsung = await Jadwal.find({
        status_konsul: "berlangsung",
      });

      for (const jadwal of allJadwalBerlangsung) {
        const { tgl_konsul, jam_konsul } = jadwal;

        if (!tgl_konsul || !jam_konsul || !jam_konsul.includes(":")) {
          // console.log(`⚠️ Jadwal tidak lengkap (fallback): ${jadwal._id}`);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        
        // ✅ PERBAIKAN: Konsisten dengan pembuatan waktu
        const startTime = new Date(tgl_konsul);
        startTime.setHours(hour, minute, 0, 0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit

        if (now >= endTime) {
          jadwal.status_konsul = "selesai";
          await jadwal.save();
          console.log(
            `⏹️ Jadwal ${jadwal._id} otomatis jadi 'selesai' [fallback] setelah ${endTime.toLocaleString('id-ID')}`
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai (fallback):", err);
    }
  });
};

module.exports = startCronJob;