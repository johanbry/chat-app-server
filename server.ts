import express, { Express } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(cors());

interface IMessage {
  date: Date;
  from: string;
  message: string;
}

interface IUser {
  username: string;
  id: string;
}
interface IRoom {
  room: string;
  users: IUser[];
}

const usersMap = new Map();
const defaultRoom = 'Lobby';

const getPublicRooms = () => {
  // Hämta alla rum, skapa en tom array som ska innehålla publika rum
  const allRooms = io.sockets.adapter.rooms;
  let publicRooms: IRoom[] = [];

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
  const lobby: IRoom | undefined = publicRooms.find(
    (room: IRoom) => room.room === defaultRoom
  );

  // Om lobby finns, filtrera ut defaultRoom (lobby) och lägg först i publicRooms lista
  if (lobby) {
    publicRooms = publicRooms.filter(room => room.room !== defaultRoom);
    publicRooms.unshift(lobby);
  }

  return publicRooms;
};

const createMessageObj = (from: string, message: string): IMessage => {
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
      .emit(
        'received_message',
        createMessageObj('system', `${username} has joined ${defaultRoom}!`)
      );
    socket.emit(
      'received_message',
      createMessageObj('system', `Welcome to ${defaultRoom}, ${username}!`)
    );
  });

  socket.on('create_join_chatroom', newRoomName => {
    socket.join(newRoomName);
    io.emit('send_public_rooms', getPublicRooms());
    // send message to room except socket that user has joined room
    socket
      .in(newRoomName)
      .emit(
        'received_message',
        createMessageObj(
          'system',
          `${usersMap.get(socket.id)} has joined ${newRoomName}!`
        )
      );
    socket.emit(
      'received_message',
      createMessageObj(
        'system',
        `Welcome to ${newRoomName}, ${usersMap.get(socket.id)}!`
      )
    );
  });

  socket.on('leave_room', room => {
    socket.leave(room);
    io.emit('send_public_rooms', getPublicRooms());

    socket
      .in(room)
      .emit(
        'received_message',
        createMessageObj(
          'system',
          `${usersMap.get(socket.id)} has left ${room}!`
        )
      );

    socket.in(room).emit('send_typing_stop', socket.id);
  });

  socket.on('message_from_client', message => {
    io.in(message.currentRoom).emit(
      'received_message',
      createMessageObj(message.user.username, message.message)
    );
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

server.listen(process.env.PORT || 3000, () =>
  console.log(`Server up and listening on port ${process.env.PORT}`)
);
