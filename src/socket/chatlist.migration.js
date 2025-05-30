const mongoose = require("mongoose");
const ChatList = require("./chatlist.model"); // sesuaikan path sesuai lokasi file migrasi dan model

async function migrateChatList() {
  try {
    await mongoose.connect(
      "mongodb+srv://mjksehat:admin123@mjksehat.5rpyw.mongodb.net/mjksehat?retryWrites=true&w=majority"
    );

    console.log("Database connected");

    const chatlists = await ChatList.find();

    for (const chat of chatlists) {
      let changed = false;

      // Periksa participants
      if (
        !Array.isArray(chat.participants) ||
        chat.participants.length !== 2 ||
        !chat.participants.every((p) => p.user && p.role)
      ) {
        console.log(
          `⚠️ ChatList ${chat._id} participants invalid or incomplete, fixing...`
        );

        // Buat dummy participants, ganti sesuai data valid kamu
        chat.participants = [
          { user: new mongoose.Types.ObjectId(), role: "Dokter" },
          { user: new mongoose.Types.ObjectId(), role: "Masyarakat" },
        ];
        changed = true;
      }

      if (!chat.jadwal) {
        chat.jadwal = new mongoose.Types.ObjectId();
        changed = true;
      }

      if (!chat.status) {
        chat.status = "berlangsung";
        changed = true;
      }

      if (changed) {
        await chat.save();
        console.log(`Updated chatlist ${chat._id}`);
      }
    }

    console.log("Migration complete");
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Database disconnected");
    process.exit(0);
  }
}

migrateChatList();
