"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
    },
});
app.use((0, cors_1.default)());
const usersMap = new Map();
const defaultRoom = "Lobby";
//let publicRooms: any = new Map();
const getPublicRooms = () => {
    // Hämta alla rum, skapa en tom array som ska innehålla publika rum
    const allRooms = io.sockets.adapter.rooms;
    const publicRooms = [];
    if (!allRooms.has(defaultRoom)) {
        publicRooms.push({
            room: defaultRoom,
            users: [],
        });
    }
    for (const [roomName, socketIds] of allRooms) {
        if (!socketIds.has(roomName)) {
            const usernames = [];
            for (const id of socketIds) {
                usernames.push({
                    username: usersMap.get(id),
                    id,
                });
            }
            publicRooms.push({
                room: roomName,
                users: usernames,
            });
        }
    }
    return publicRooms;
};
const createMessageObj = (from, message) => {
    return {
        from,
        message,
        date: Date.now().toString(),
    };
};
io.on("connection", (socket) => {
    console.log("RUM: ", io.sockets.adapter.rooms);
    console.log("SOCKETS: ", io.sockets.adapter.sids);
    console.log("Socket connected:", socket.id);
    socket.on("username_connected", (username) => {
        socket.join(defaultRoom);
        usersMap.set(socket.id, username);
        // console.log("usersmap", usersMap);
        //  console.log("publika rum", getPublicRooms());
        io.emit("send_public_rooms", getPublicRooms());
        socket
            .in(defaultRoom)
            .emit("received_message", createMessageObj("system", `${username} has joined ${defaultRoom}!`));
        socket.emit("received_message", createMessageObj("system", `Welcome to ${defaultRoom}, ${username}!`));
    });
    socket.on("create_chatroom", (newRoomName) => {
        socket.join(newRoomName);
        io.emit("send_public_rooms", getPublicRooms());
        // send message to room except socket that user has joined room
        socket
            .in(newRoomName)
            .emit("received_message", createMessageObj("system", `${usersMap.get(socket.id)} has joined ${newRoomName}!`));
        socket.emit("received_message", createMessageObj("system", `Welcome to ${newRoomName}, ${usersMap.get(socket.id)}!`));
        console.log("RUM JOIN: ", io.sockets.adapter.rooms);
        console.log("SOCKETS JOIN: ", io.sockets.adapter.sids);
    });
    socket.on("leave_room", (room) => {
        socket.leave(room);
        io.emit("send_public_rooms", getPublicRooms());
        socket
            .in(room)
            .emit("received_message", createMessageObj("system", `${usersMap.get(socket.id)} has left ${room}!`));
    });
    socket.on("message_from_client", (message) => {
        console.log("Client message:", message);
        io.in(message.currentRoom).emit("received_message", createMessageObj(message.user.username, message.message));
        console.log("UsersMap:", usersMap);
    });
    socket.on("user_typing", (username, room) => {
        console.log("typing info username: ", username);
        console.log("typing info room: ", room);
        io.in(room).emit("send_typing_info", username);
    });
    socket.on("disconnect", () => {
        io.emit("send_public_rooms", getPublicRooms());
        /// Emit to user in room that user has left
        usersMap.delete(socket.id);
        console.log("Socket disconnected", socket.id);
        console.log("All connected sockets: ", io.sockets.adapter.sids);
        console.log("usersMap: ", usersMap);
    });
});
server.listen(process.env.PORT || 3000, () => console.log(`Server up and listening on port ${process.env.PORT}`));
