const cron = require("node-cron");
const Jadwal = require("../jadwal/jadwal.model");
const Chat = require("./chat.model");
const ChatList = require("./chatlist.model");
const Dokter = require("../dokter/dokter.model");

const startCronJob = (io) => {
  console.log("✅ File cron job dimuat");

  // Fungsi untuk mendapatkan waktu Jakarta yang akurat
  const getJakartaTime = () => {
    const now = new Date();
    // Konversi ke Jakarta timezone (UTC+7)
    const jakartaTime = new Date(
      now.toLocaleString("en-US", {
        timeZone: "Asia/Jakarta",
      })
    );
    return jakartaTime;
  };

  // Fungsi untuk membuat Date object dengan timezone Jakarta
  const createJakartaDate = (date, hour = 0, minute = 0, second = 0) => {
    // Buat date object dengan parameter yang diberikan
    const targetDate = new Date(date);
    targetDate.setHours(hour, minute, second, 0);

    // Return sebagai waktu Jakarta
    return targetDate;
  };

  cron.schedule("* * * * *", async () => {
    const jakartaTime = getJakartaTime();
    console.log(
      "⏰ [CRON] Cek jadwal pada:",
      jakartaTime.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
    );

    /* =========================
       ⏰ AUTO DISABLE AVAILABLE: Jam yang sudah lewat waktu
       ========================= */
    try {
      const doctors = await Dokter.find({});
      let totalUpdatedSlots = 0;

      for (const doctor of doctors) {
        let doctorUpdated = false;

        for (const jadwalItem of doctor.jadwal) {
          const jadwalDate = new Date(jadwalItem.tanggal);

          // Buat tanggal untuk hari ini dalam Jakarta timezone
          const todayJakarta = new Date(
            jakartaTime.getFullYear(),
            jakartaTime.getMonth(),
            jakartaTime.getDate()
          );

          // Buat tanggal jadwal dalam Jakarta timezone
          const jadwalDay = new Date(
            jadwalDate.getFullYear(),
            jadwalDate.getMonth(),
            jadwalDate.getDate()
          );

          for (const jamItem of jadwalItem.jam) {
            if (
              jamItem.available &&
              jamItem.time &&
              jamItem.time.includes(":")
            ) {
              const [hour, minute] = jamItem.time.split(":").map(Number);
              const appointmentDateTime = createJakartaDate(
                jadwalDay,
                hour,
                minute
              );

              console.log(
                `🕐 Comparing appointment: ${appointmentDateTime.toLocaleString(
                  "id-ID",
                  { timeZone: "Asia/Jakarta" }
                )} vs now: ${jakartaTime.toLocaleString("id-ID", {
                  timeZone: "Asia/Jakarta",
                })}`
              );

              if (jakartaTime >= appointmentDateTime) {
                jamItem.available = false;
                doctorUpdated = true;
                totalUpdatedSlots++;

                console.log(
                  `⏰ Jam ${jamItem.time} pada ${jadwalDay.toLocaleDateString(
                    "id-ID"
                  )} untuk dokter ${doctor.nama_dokter} diset unavailable`
                );
              }
            }
          }
        }

        if (doctorUpdated) {
          await doctor.save();
          console.log(`💾 Saved changes for doctor: ${doctor.nama_dokter}`);
        }
      }

      if (totalUpdatedSlots > 0) {
        console.log(
          `✅ Total ${totalUpdatedSlots} slot waktu diupdate menjadi unavailable`
        );
      } else {
        console.log(`ℹ️ Tidak ada slot waktu yang perlu diupdate`);
      }
    } catch (error) {
      console.error("❌ Error auto disable available time:", error);
    }

    /* =========================
    🚫 AUTO REJECT: Jadwal yang sudah lewat waktu tapi masih 'menunggu'
    ========================= */
    try {
      const menunggujadwals = await Jadwal.find({
        status_konsul: "menunggu",
      })
        .populate("dokter_id")
        .populate("masyarakat_id");

      console.log(
        `🕒 Ditemukan ${menunggujadwals.length} jadwal yang masih menunggu persetujuan`
      );

      for (const jadwal of menunggujadwals) {
        const { tgl_konsul, jam_konsul } = jadwal;

        if (!tgl_konsul || !jam_konsul || !jam_konsul.includes(":")) {
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const konsultasiTime = createJakartaDate(tgl_konsul, hour, minute);

        console.log(
          `🕒 Jadwal menunggu: ${konsultasiTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })} vs now: ${jakartaTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}`
        );

        // Hanya tolak jika waktu sekarang sudah melewati waktu konsultasi
        if (jakartaTime > konsultasiTime) {
          // Auto reject jadwal
          jadwal.status_konsul = "ditolak";
          jadwal.alasan_tolak =
            "Otomatis ditolak karena dokter tidak merespons sebelum jadwal konsultasi";
          await jadwal.save();

          console.log(
            `❌ Jadwal ${jadwal._id} otomatis ditolak karena dokter tidak merespons sebelum jam ${jam_konsul}`
          );

          // Kirim notifikasi ke masyarakat bahwa jadwalnya ditolak
          if (jadwal.masyarakat_id) {
            io.to(jadwal.masyarakat_id.toString()).emit("jadwalDitolak", {
              jadwalId: jadwal._id,
              message:
                "Maaf, jadwal konsultasi Anda otomatis dibatalkan karena dokter tidak merespons sebelum waktu konsultasi.",
              alasan: jadwal.alasan_tolak,
              waktu_konsul: `${tgl_konsul.toLocaleDateString(
                "id-ID"
              )} ${jam_konsul}`,
            });
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
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const konsultasiTime = createJakartaDate(tgl_konsul, hour, minute);
        const endTime = new Date(konsultasiTime.getTime() + 3 * 60 * 1000); // Konsultasi 3 menit (2 jam)

        console.log(
          `📨 Cek pesan otomatis - Konsultasi: ${konsultasiTime.toLocaleString(
            "id-ID",
            { timeZone: "Asia/Jakarta" }
          )} - ${endTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })} vs now: ${jakartaTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}`
        );

        if (jakartaTime >= konsultasiTime && jakartaTime < endTime) {
          const dokterId = dokter._id;
          const masyarakatId = masyarakat._id;
          const pesanTemplate = "Halo, ada yang bisa dibantu?";

          // Simpan pesan pertama dengan waktu Jakarta
          const newChat = await Chat.create({
            senderId: dokterId,
            receiverId: masyarakatId,
            text: pesanTemplate,
            type: "text",
            role: "dokter",
            waktu: getJakartaTime(),
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
              lastMessageDate: getJakartaTime(),
              status: "berlangsung",
            });
          } else {
            chatlist.lastMessage = pesanTemplate;
            chatlist.lastMessageDate = getJakartaTime();
            chatlist.status = "berlangsung";
            chatlist.jadwal = jadwal._id;
            await chatlist.save();
          }

          // Tandai pesan otomatis sudah dikirim & ubah status konsul
          jadwal.autoMessageSent = true;
          jadwal.status_konsul = "berlangsung";
          await jadwal.save();

          console.log(
            `✅ Pesan otomatis dikirim & status jadi 'berlangsung' untuk jadwal ${
              jadwal._id
            } pada ${jakartaTime.toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })}`
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

    /* =========================
    ⏹️ AUTO SELESAI: ChatList yang sudah lewat 3 menit (2 jam)
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
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const startTime = createJakartaDate(tgl_konsul, hour, minute);
        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit (2 jam)

        console.log(
          `⏹️ Cek auto selesai - Start: ${startTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}, End: ${endTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}, Now: ${jakartaTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}`
        );

        if (jakartaTime >= endTime) {
          chat.status = "selesai";
          await chat.save();

          if (jadwal.status_konsul !== "selesai") {
            jadwal.status_konsul = "selesai";
            await jadwal.save();
            console.log(
              `✅ Status Jadwal ${
                jadwal._id
              } berhasil diubah ke 'selesai' pada ${jakartaTime.toLocaleString(
                "id-ID",
                { timeZone: "Asia/Jakarta" }
              )}`
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
            `⏹️ Jadwal ${jadwal._id} & ChatList ${
              chat._id
            } otomatis jadi 'selesai' pada ${jakartaTime.toLocaleString(
              "id-ID",
              { timeZone: "Asia/Jakarta" }
            )}`
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
        const startTime = createJakartaDate(jadwal.tgl_konsul, hour, minute);
        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit (2 jam)

        console.log(
          `🔄 Cek reactive - Start: ${startTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}, End: ${endTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}, Now: ${jakartaTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}`
        );

        if (
          startTime <= jakartaTime &&
          jakartaTime <= endTime &&
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
              `✅ ChatList ${
                chat._id
              } diubah ke 'berlangsung' karena waktunya tiba pada ${jakartaTime.toLocaleString(
                "id-ID",
                { timeZone: "Asia/Jakarta" }
              )}`
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
          continue;
        }

        const [hour, minute] = jam_konsul.split(":").map(Number);
        const startTime = createJakartaDate(tgl_konsul, hour, minute);
        const endTime = new Date(startTime.getTime() + 3 * 60 * 1000); // 3 menit (2 jam)

        console.log(
          `🛡️ Fallback check - End: ${endTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}, Now: ${jakartaTime.toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })}`
        );

        if (jakartaTime >= endTime) {
          jadwal.status_konsul = "selesai";
          await jadwal.save();
          console.log(
            `⏹️ Jadwal ${
              jadwal._id
            } otomatis jadi 'selesai' [fallback] pada ${jakartaTime.toLocaleString(
              "id-ID",
              { timeZone: "Asia/Jakarta" }
            )}`
          );
        }
      }
    } catch (err) {
      console.error("❌ Gagal update status selesai (fallback):", err);
    }
  });
};

module.exports = startCronJob;
