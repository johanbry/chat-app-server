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
        origin: '*',
    },
});
app.use((0, cors_1.default)());
const usersMap = new Map();
const defaultRoom = 'Lobby';
const getPublicRooms = () => {
    // Hämta alla rum, skapa en tom array som ska innehålla publika rum
    const allRooms = io.sockets.adapter.rooms;
    let publicRooms = [];
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
    // kolla om defaultRoom (lobby) finns i publicRooms lista och kopiera objektet
    const lobby = publicRooms.find((room) => room.room === defaultRoom);
    // Om lobby finns, filtrera ut defaultRoom (lobby) och lägg först i publicRooms lista
    if (lobby) {
        publicRooms = publicRooms.filter(room => room.room !== defaultRoom);
        publicRooms.unshift(lobby);
    }
    return publicRooms;
};
const createMessageObj = (from, message) => {
    return {
        from,
        message,
        date: new Date(),
    };
};
io.on('connection', socket => {
    socket.on('username_connected', username => {
        socket.join(defaultRoom);
        usersMap.set(socket.id, username);
        io.emit('send_public_rooms', getPublicRooms());
        socket
            .in(defaultRoom)
            .emit('received_message', createMessageObj('system', `${username} has joined ${defaultRoom}!`));
        socket.emit('received_message', createMessageObj('system', `Welcome to ${defaultRoom}, ${username}!`));
    });
    socket.on('create_join_chatroom', newRoomName => {
        socket.join(newRoomName);
        io.emit('send_public_rooms', getPublicRooms());
        // send message to room except socket that user has joined room
        socket
            .in(newRoomName)
            .emit('received_message', createMessageObj('system', `${usersMap.get(socket.id)} has joined ${newRoomName}!`));
        socket.emit('received_message', createMessageObj('system', `Welcome to ${newRoomName}, ${usersMap.get(socket.id)}!`));
    });
    socket.on('leave_room', room => {
        socket.leave(room);
        io.emit('send_public_rooms', getPublicRooms());
        socket
            .in(room)
            .emit('received_message', createMessageObj('system', `${usersMap.get(socket.id)} has left ${room}!`));
        socket.in(room).emit('send_typing_stop', socket.id);
    });
    socket.on('message_from_client', message => {
        io.in(message.currentRoom).emit('received_message', createMessageObj(message.user.username, message.message));
    });
    socket.on('user_typing_start', (username, room) => {
        socket.in(room).emit('send_typing_start', username, socket.id);
    });
    socket.on('user_typing_stop', room => {
        io.emit('send_typing_stop', socket.id);
    });
    socket.on('disconnect', () => {
        io.emit('send_public_rooms', getPublicRooms());
        usersMap.delete(socket.id);
    });
});
server.listen(process.env.PORT || 3000, () => console.log(`Server up and listening on port ${process.env.PORT}`));
