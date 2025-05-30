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
        endTime.setMinutes(endTime.getMinutes() + 3); // Konsultasi 30 menit

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
              unreadCount: {
                [dokterId.toString()]: 0,
                [masyarakatId.toString()]: 1,
              },
            });
          } else {
            chatlist.lastMessage = pesanTemplate;
            chatlist.lastMessageDate = now;
            chatlist.status = "berlangsung";
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
    try {
      const chatLists = await ChatList.find({ status: "berlangsung" }).populate(
        "jadwal"
      );

      for (const chat of chatLists) {
        if (!chat.jadwal) continue;

        const { tgl_konsul, jam_konsul } = chat.jadwal;

        if (!tgl_konsul || !jam_konsul) {
          console.log(`⚠️ Jadwal di ChatList ${chat._id} tidak lengkap`);
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const endTime = new Date(tgl_konsul);
        endTime.setHours(hour);
        endTime.setMinutes(minute + 30); // Konsultasi 30 menit
        endTime.setSeconds(0);

        if (now >= endTime) {
          chat.status = "selesai";
          await chat.save();

          const jadwal = await Jadwal.findById(chat.jadwal._id);
          if (jadwal && jadwal.status_konsul !== "selesai") {
            jadwal.status_konsul = "selesai";
            await jadwal.save();
          }

          console.log(
            `⏹️ Jadwal ${jadwal?._id} & ChatList ${chat._id} otomatis jadi 'selesai'`
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai:", err);
    }
  });
};

module.exports = startCronJob;
