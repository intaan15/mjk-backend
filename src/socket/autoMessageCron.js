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

          // Update ChatList
          let chatlist = await ChatList.findOne({
            "participants.user": { $all: [dokterId, masyarakatId] },
          });

          if (!chatlist) {
            chatlist = await ChatList.create({
              participants: [
                { user: dokterId, role: "Dokter" },
                { user: masyarakatId, role: "Masyarakat" },
              ],
              lastMessage: pesanTemplate,
              lastMessageDate: now,
              unreadCount: {
                [dokterId.toString()]: 0,
                [masyarakatId.toString()]: 1,
              },
            });
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
      const chatLists = await ChatList.find({ status: "berlangsung" });
  
      for (const chat of chatLists) {
        if (!chat.jadwal) continue;
  
        const endTime = new Date(chat.jadwal);
        endTime.setMinutes(endTime.getMinutes() + 30);
  
        if (now >= endTime) {
          chat.status = "selesai";
          await chat.save();
          console.log(`⏹️ ChatList ${chat._id} otomatis ditandai sebagai 'selesai'`);
        }
      }
    } catch (err) {
      console.error("❌ Gagal mengupdate status chatlist:", err);
    }


  });
};

module.exports = startCronJob;
