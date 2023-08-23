import express, { Express } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app: Express = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

app.use(cors());

interface IMessage {
  date: string;
  from: string;
  message: string;
}

const usersMap = new Map();
const defaultRoom = "Lobby";
//let publicRooms: any = new Map();

const getPublicRooms = () => {
  // Hämta alla rum, skapa en tom array som ska innehålla publika rum
  const allRooms = io.sockets.adapter.rooms;
  const publicRooms: any = [];

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

const createMessageObj = (from: string, message: string): IMessage => {
  return {
    from,
    message,
    date: Date.now().toString(),
  };
};

io.on("connection", (socket) => {
  //console.log("RUM: ", io.sockets.adapter.rooms);
  //console.log("SOCKETS: ", io.sockets.adapter.sids);

  //console.log("Socket connected:", socket.id);

  socket.on("username_connected", (username) => {
    socket.join(defaultRoom);
    usersMap.set(socket.id, username);
    // console.log("usersmap", usersMap);

    //  console.log("publika rum", getPublicRooms());
    io.emit("send_public_rooms", getPublicRooms());
    socket
      .in(defaultRoom)
      .emit(
        "received_message",
        createMessageObj("system", `${username} has joined ${defaultRoom}!`)
      );
    socket.emit(
      "received_message",
      createMessageObj("system", `Welcome to ${defaultRoom}, ${username}!`)
    );
  });

  //!FIXME:
  socket.on("create_chatroom", (newRoomName) => {
    socket.join(newRoomName);
    io.emit("send_public_rooms", getPublicRooms());
    // send message to room except socket that user has joined room
    socket
      .in(newRoomName)
      .emit(
        "received_message",
        createMessageObj(
          "system",
          `${usersMap.get(socket.id)} has joined ${newRoomName}!`
        )
      );
    socket.emit(
      "received_message",
      createMessageObj(
        "system",
        `Welcome to ${newRoomName}, ${usersMap.get(socket.id)}!`
      )
    );

    //console.log("RUM JOIN: ", io.sockets.adapter.rooms);
    //console.log("SOCKETS JOIN: ", io.sockets.adapter.sids);
  });

  socket.on("leave_room", (room) => {
    socket.leave(room);
    io.emit("send_public_rooms", getPublicRooms());

    socket
      .in(room)
      .emit(
        "received_message",
        createMessageObj(
          "system",
          `${usersMap.get(socket.id)} has left ${room}!`
        )
      );
  });

  socket.on("message_from_client", (message) => {
    //console.log("Client message:", message);
    io.in(message.currentRoom).emit(
      "received_message",
      createMessageObj(message.user.username, message.message)
    );
    //console.log("UsersMap:", usersMap);
  });

  socket.on("user_typing_start", (username, room) => {
    console.log("typing start info username: ", username);
    console.log("typing start info room: ", room);

    io.in(room).emit("send_typing_start", username, socket.id);
  });

  socket.on("user_typing_stop", (username, room) => {
    console.log("typing stop info username: ", username);
    console.log("typing stop info room: ", room);

    io.in(room).emit("send_typing_stop", username);
  });

  socket.on("disconnect", () => {
    io.emit("send_public_rooms", getPublicRooms());
    /// Emit to user in room that user has left
    usersMap.delete(socket.id);
    // console.log("Socket disconnected", socket.id);
    // console.log("All connected sockets: ", io.sockets.adapter.sids);
    // console.log("usersMap: ", usersMap);
  });
});

server.listen(process.env.PORT || 3000, () =>
  console.log(`Server up and listening on port ${process.env.PORT}`)
);
