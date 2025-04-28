const { Server } = require("socket.io");

const createSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  let messages = [];

  io.on("connection", (socket) => {
    console.log("Client connected");

    // ini yang perlu ada
    socket.emit("connected", { message: "Successfully connected to backend" });

    socket.emit("chat history", messages);

    socket.on("chat message", (msg) => {
      const newMsg = {
        id: Date.now().toString(),
        ...msg,
      };
      messages.push(newMsg);
      io.emit("chat message", newMsg);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected");
    });
  });



  return io;
};

module.exports = createSocketServer;
