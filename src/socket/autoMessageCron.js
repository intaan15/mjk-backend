// cron.js
const cron = require("node-cron");
const Jadwal = require("../jadwal/jadwal.model");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");

const startCronJob = (io) => {
  console.log("✅ File cron job dimuat");
  

  cron.schedule("* * * * *", async () => {
    const now = new Date();
    console.log("⏰ [CRON] Cek jadwal pada:", now.toLocaleString());

  // PESAN OTOMATIS UNTUK JADWAL DITERIMA
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

        console.log(jadwal._id);

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const konsultasiTime = new Date(tgl_konsul);
        konsultasiTime.setHours(hour);
        konsultasiTime.setMinutes(minute);
        konsultasiTime.setSeconds(0);

        if (now >= konsultasiTime) {
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

          // Emit pesan ke socket.io (biar realtime)
          io.to(masyarakatId.toString()).emit("chat message", newChat);
          io.to(dokterId.toString()).emit("chat message", newChat);
          console.log("📡 Pesan otomatis di-emit via socket.io");
          console.log(jadwal._id);

          // Update ChatList
          let chatlist = await ChatList.findOne({
            "participants.user": { $all: [dokterId, masyarakatId] },
          });

          console.log("INI JADWAL ID", jadwal._id);

          if (!chatlist) {
            chatlist = await ChatList.create({
              participants: [
                { user: dokterId, role: "Dokter" },
                { user: masyarakatId, role: "Masyarakat" },
              ],
              jadwal: jadwal._id, // ✅ tambahkan ini
              lastMessage: pesanTemplate,
              lastMessageDate: now,
              unreadCount: {
                [dokterId.toString()]: 0,
                [masyarakatId.toString()]: 1,
              },
            });
            console.log(jadwal._id);
          } else {
            chatlist.lastMessage = pesanTemplate;
            chatlist.lastMessageDate = now;
            const currentUnread =
              chatlist.unreadCount.get(masyarakatId.toString()) || 0;
            chatlist.unreadCount.set(
              masyarakatId.toString(),
              currentUnread + 1
            );
            await chatlist.save();
          }

          // Tandai bahwa pesan otomatis sudah dikirim
          jadwal.autoMessageSent = true;
          await jadwal.save();

          console.log(`✅ Pesan otomatis dikirim untuk jadwal ${jadwal._id}`);
        } else {
          console.log(`⏳ Jadwal ${jadwal._id} belum waktunya. Lewatkan.`);
        }
      }
    } catch (error) {
      console.error("❌ Error dalam cron job pesan otomatis:", error);
    }

    // UBAH STATUS OTOMATIS CHATLIST 
    try {
      const chatLists = await ChatList.find({ status: "berlangsung" }).populate(
        "jadwal"
      );

      for (const chat of chatLists) {
        if (!chat.jadwal) continue;

        // Asumsikan jadwal punya tgl_konsul dan jam_konsul
        const { tgl_konsul, jam_konsul } = chat.jadwal;

        if (!tgl_konsul || !jam_konsul) {
          console.log(
            `⚠️ Jadwal di ChatList ${chat._id} tidak lengkap, dilewati.`
          );
          continue;
        }

        // Buat Date dari jadwal
        const [hour, minute] = jam_konsul.split(":").map(Number);
        const endTime = new Date(tgl_konsul);
        endTime.setHours(hour);
        endTime.setMinutes(minute + 3); // +3 menit, sesuaikan durasi sesimu
        endTime.setSeconds(0);

        if (now >= endTime) {
          chat.status = "selesai";
          await chat.save();
          console.log(
            `⏹️ ChatList ${chat._id} otomatis ditandai sebagai 'selesai'`
          );
        }
      }

    } catch (err) {
      console.error("❌ Gagal mengupdate status chatlist:", err);
    }


  });
};

module.exports = startCronJob;
