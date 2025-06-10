const cron = require("node-cron");
const Jadwal = require("../jadwal/jadwal.model");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");

const startCronJob = (io) => {
  console.log("✅ File cron job dimuat");

  cron.schedule("* * * * *", async () => {
    const now = new Date();
    console.log("⏰ [CRON] Cek jadwal pada:", now.toLocaleString());

    // Kirim pesan otomatis & set status menjadi 'berlangsung'
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
          console.log("⚠️ Jadwal tidak lengkap, dilewati:", jadwal._id);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const konsultasiTime = new Date(tgl_konsul);
        konsultasiTime.setHours(hour);
        konsultasiTime.setMinutes(minute);
        konsultasiTime.setSeconds(0);

        const endTime = new Date(konsultasiTime);
        endTime.setMinutes(endTime.getMinutes() + 1); // Konsultasi 30 menit

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
            // jadwal: jadwal._id,
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
              unreadCount: {
                [dokterId.toString()]: 0,
                [masyarakatId.toString()]: 1,
              },
            });
          } else {
            chatlist.lastMessage = pesanTemplate;
            chatlist.lastMessageDate = now;
            chatlist.status = "berlangsung";
            chatlist.jadwal = jadwal._id;
            const currentUnread =
              chatlist.unreadCount.get(masyarakatId.toString()) || 0;
            chatlist.unreadCount.set(
              masyarakatId.toString(),
              currentUnread + 1
            );
            await chatlist.save();
          }

          // Tandai pesan otomatis sudah dikirim & ubah status konsul
          jadwal.autoMessageSent = true;
          jadwal.status_konsul = "berlangsung";
          await jadwal.save();

          console.log(
            `✅ Pesan otomatis dikirim & status jadi 'berlangsung' untuk jadwal ${jadwal._id}`
          );
        } else {
          console.log(
            `⏳ Jadwal ${jadwal._id} belum waktunya atau sudah selesai.`
          );
        }
      }
    } catch (error) {
      console.error("❌ Error kirim pesan otomatis:", error);
    }

    // Ubah status menjadi 'selesai' jika sudah 30 menit lewat
    // Cek waktu sekarang di awal
    // const now = new Date();
    console.log("⏰ Cek sekarang:", now.toISOString());

    /* =========================
   🔁 UTAMA: ChatList.status = 'berlangsung'
========================= */
    try {
      const chatLists = await ChatList.find({ status: "berlangsung" }).populate(
        "jadwal"
      );

      for (const chat of chatLists) {
        const jadwal = chat.jadwal;

        if (!jadwal) {
          // console.log(`⚠️ Jadwal tidak ditemukan untuk ChatList ${chat._id}`);
          continue;
        }

        const { tgl_konsul, jam_konsul } = jadwal;

        if (!tgl_konsul || !jam_konsul || !jam_konsul.includes(":")) {
          console.log(`⚠️ Jadwal tidak lengkap/salah format: ${jadwal._id}`);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const startTime = new Date(tgl_konsul);
        startTime.setHours(hour);
        startTime.setMinutes(minute);
        startTime.setSeconds(0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // ganti ke 30 * 60 * 1000 untuk real

        if (now >= endTime) {
          chat.status = "selesai";
          await chat.save();

          if (jadwal.status_konsul !== "selesai") {
            jadwal.status_konsul = "selesai";
            await jadwal.save();
            console.log(
              `✅ Status Jadwal ${jadwal._id} berhasil diubah ke 'selesai'`
            );
          }

          console.log(
            `⏹️ Jadwal ${jadwal._id} & ChatList ${chat._id} otomatis jadi 'selesai'`
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai (ChatList):", err);
    }
    /* =========================
   🔁 UTAMA: ChatList.status = 'berlangsung'
========================= */
    try {
      // ChatList yang statusnya "selesai", cek apakah waktunya sudah masuk, maka ubah ke "berlangsung"
      const selesaiChats = await ChatList.find({ status: "selesai" }).populate(
        "jadwal"
      );

      for (const chat of selesaiChats) {
        const jadwal = chat.jadwal;
        if (!jadwal) continue;

        const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
        const startTime = new Date(jadwal.tgl_konsul);
        startTime.setHours(hour);
        startTime.setMinutes(minute);
        startTime.setSeconds(0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 30 menit

        if (startTime <= now && now <= endTime) {
          // waktunya sedang berlangsung
          if (chat.status === "selesai") {
            chat.status = "berlangsung";
            await chat.save();

            if (jadwal.status_konsul !== "berlangsung") {
              jadwal.status_konsul = "berlangsung";
              await jadwal.save();
            }

            console.log(
              `✅ ChatList ${chat._id} diubah ke 'berlangsung' karena waktunya tiba`
            );
          }
        } else {
          console.log(
            `⏳ Jadwal ${jadwal._id} belum waktunya atau sudah selesai.`
          );
        }
        
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai (ChatList):", err);
    }

    /* =========================
   🛡️ FALLBACK: Semua Jadwal.status_konsul = 'berlangsung'
========================= */
    try {
      const allJadwalBerlangsung = await Jadwal.find({
        status_konsul: "berlangsung",
      });

      for (const jadwal of allJadwalBerlangsung) {
        const { tgl_konsul, jam_konsul } = jadwal;

        if (!tgl_konsul || !jam_konsul || !jam_konsul.includes(":")) {
          console.log(`⚠️ Jadwal tidak lengkap (fallback): ${jadwal._id}`);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const startTime = new Date(tgl_konsul);
        startTime.setHours(hour);
        startTime.setMinutes(minute);
        startTime.setSeconds(0);

        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000);

        if (now >= endTime) {
          jadwal.status_konsul = "selesai";
          await jadwal.save();
          console.log(
            `⏹️ Jadwal ${jadwal._id} otomatis jadi 'selesai' [fallback]`
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai (fallback):", err);
    }
  });
};

module.exports = startCronJob;
