const Chat = require("../models/chat");
const User = require("../models/User");
const Partner = require("../models/Partner");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const Booking = require("../models/booking");



module.exports = (io) => {
    io.on("connection", (socket) => {
      console.log("User connected:", socket.id);
  
      socket.on("joinChat", async ({ bookingId, userId }) => {
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.status !== "Accepted") {
          socket.emit("error", "Chat is only available for accepted bookings.");
          return;
        }
  
        socket.join(bookingId);
        console.log(`User ${userId} joined chat for booking ${bookingId}`);
      });
  
      socket.on("sendMessage", async ({ bookingId, senderId, receiverId, message }) => {
        const booking = await Booking.findById(bookingId);
        if (!booking || booking.status !== "Accepted") {
          socket.emit("error", "Chat is only available for accepted bookings.");
          return;
        }
  
        let chat = await Chat.findOne({ bookingId });
  
        if (!chat) {
          chat = new Chat({ bookingId, messages: [] });
        }
  
        chat.messages.push({ senderId, receiverId, text: message });
        await chat.save();
  
        io.to(bookingId).emit("receiveMessage", chat.messages);
      });
  
      socket.on("getMessages", async (bookingId) => {
        const chat = await Chat.findOne({ bookingId });
        socket.emit("receiveMessage", chat ? chat.messages : []);
      });
  
      socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
      });
    });
  };
  
  
