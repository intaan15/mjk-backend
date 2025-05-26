const cron = require("node-cron");
const Jadwal = require("../jadwal/jadwal.model");
const Chat = require("./socket/chat.model");
const ChatList = require("./socket/chatlist.model");
// tes push 

cron.schedule("*/30 * * * *", async () => {
  const now = new Date();

  try {
    // Ambil jadwal yang waktunya sudah tiba, status diterima, tapi belum kirim pesan
    const jadwals = await Jadwal.find({
      status_konsul: "diterima",
      autoMessageSent: { $ne: true },
    })
      .populate("dokter_id")
      .populate("masyarakat_id");

    for (const jadwal of jadwals) {
      const {
        dokter_id: dokter,
        masyarakat_id: masyarakat,
        tgl_konsul,
        jam_konsul,
      } = jadwal;
      if (!dokter || !masyarakat) continue;

      const [hour, minute] = jadwal.jam_konsul.split(":").map(Number);
      const konsultasiTime = new Date(tgl_konsul);
      konsultasiTime.setHours(hour);
      konsultasiTime.setMinutes(minute);
      konsultasiTime.setSeconds(0);

      // Kirim pesan hanya jika waktunya sudah tiba
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
        } else {
          chatlist.lastMessage = pesanTemplate;
          chatlist.lastMessageDate = now;

          const currentUnread =
            chatlist.unreadCount.get(masyarakatId.toString()) || 0;
          chatlist.unreadCount.set(masyarakatId.toString(), currentUnread + 1);

          await chatlist.save();
        }

        // Tandai bahwa pesan otomatis sudah dikirim
        jadwal.autoMessageSent = true;
        await jadwal.save();

        console.log(`Pesan otomatis dikirim untuk jadwal ${jadwal._id}`);
      }
    }
  } catch (error) {
    console.error("Error dalam cron job pesan otomatis:", error);
  }
});
