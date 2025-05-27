const cron = require("node-cron");
const Jadwal = require("../jadwal/jadwal.model");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");

console.log("✅ File cron job dimuat");
cron.schedule("* * * * *", async () => {
  const now = new Date();
  console.log("⏰ [CRON] Cek jadwal pada:", now.toLocaleString());

  try {
    // Ambil semua jadwal yang status diterima & belum dikirimi pesan otomatis
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

      // Gabungkan tanggal dan jam konsultasi
      const [hour, minute] = jam_konsul.split(":").map(Number);
      const konsultasiTime = new Date(tgl_konsul);
      konsultasiTime.setHours(hour);
      konsultasiTime.setMinutes(minute);
      konsultasiTime.setSeconds(0);

      console.log(
        `🕒 Jadwal: ${
          jadwal._id
        } waktu konsultasi: ${konsultasiTime.toLocaleString()}`
      );

      // Kirim pesan hanya jika waktunya sudah lewat atau sama
      if (now >= konsultasiTime) {
        const dokterId = dokter._id;
        const masyarakatId = masyarakat._id;
        const pesanTemplate = "Halo, ada yang bisa dibantu?";

        // Simpan pesan pertama
        await Chat.create({
          senderId: dokterId,
          receiverId: masyarakatId,
          text: pesanTemplate,
          type: "text",
          role: "dokter",
          waktu: now,
        });

        // Update ChatList
        const participantQuery = [
          { user: dokterId, role: "Dokter" },
          { user: masyarakatId, role: "Masyarakat" },
        ];

        let chatlist = await ChatList.findOne({
          "participants.user": { $all: [dokterId, masyarakatId] },
        });

        if (!chatlist) {
          chatlist = await ChatList.create({
            participants: participantQuery,
            lastMessage: pesanTemplate,
            lastMessageDate: now,
            unreadCount: {
              [dokterId.toString()]: 0,
              [masyarakatId.toString()]: 1,
            },
          });
          console.log(`📥 ChatList baru dibuat untuk: ${jadwal._id}`);
        } else {
          chatlist.lastMessage = pesanTemplate;
          chatlist.lastMessageDate = now;

          const currentUnread =
            chatlist.unreadCount.get(masyarakatId.toString()) || 0;
          chatlist.unreadCount.set(masyarakatId.toString(), currentUnread + 1);

          await chatlist.save();
          console.log(`📥 ChatList diupdate untuk: ${jadwal._id}`);
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
});
