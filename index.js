const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const Alliance = require("./models/alliance");
const Attack = require("./models/attack");
const Player = require("./models/player");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://datak.vercel.app",
    methods: ["GET", "POST"],
    transports: ['websocket', 'polling'],
    credentials: true
},
allowEIO3: true
});

app.use(cors());
app.use(express.json());

const alliances = {}; // Stockage des alliances { allianceId: Alliance }
const players = {}; // Stockage des joueurs { socketId: Player }

io.on("connection", (socket) => {
  console.log("Nouvelle connexion :", socket.id);

  socket.on("createAlliance", (data) => {
    const newAlliance = new Alliance(data.name);
    alliances[newAlliance.id] = newAlliance;
    console.log("Alliance créée:", newAlliance);
    socket.emit("allianceCreated", newAlliance);
  });

  // Exemple dans server.js
  socket.on("joinAlliance", ({ allianceId, pseudo, playerId }) => {
    if (!alliances[allianceId]) {
      return socket.emit("error", "Alliance inexistante");
    }

    let player;

    // Si un playerId est fourni, on cherche dans l'alliance le joueur existant
    if (playerId) {
      player = alliances[allianceId].players.find(p => p.id === playerId);
    }

    // Si le joueur n'existe pas, on le crée
    if (!player) {
      player = new Player(pseudo);
      alliances[allianceId].players.push(player);
    }

    // Mettre à jour le socket id courant du joueur
    player.currentSocketId = socket.id;

    // Optionnel : Supprimer toute association précédente du même joueur (s'il existe déjà avec un autre socket id)
    for (const sId in players) {
      if (players[sId].id === player.id && sId !== socket.id) {
        delete players[sId];
      }
    }

    // Associer le nouveau socket id au joueur dans la table globale
    players[socket.id] = player;

    socket.join(allianceId);
    console.log(`${player.id} a rejoint l'alliance`);

    // Renvoie la session existante avec le joueur et la liste des attaques
    socket.emit("joinedAlliance", { player, attacks: alliances[allianceId].attacks, alliance: alliances[allianceId] });
  });



  socket.on("disconnect", () => {
    console.log("Utilisateur déconnecté:", socket.id);
    delete players[socket.id];
  });


  socket.on("createAttack", ({ name, location, allianceId, playerId }) => {
    if (!alliances[allianceId]) return socket.emit("error", "Alliance inexistante");
    const newAttack = new Attack(name, location, allianceId, playerId);
    alliances[allianceId].attacks.push(newAttack);

    io.to(allianceId).emit("attackListUpdated", alliances[allianceId].attacks);
    console.log("Nouvelle attaque créée:", newAttack);
  });

  socket.on("deleteAttack", ({ attackId, allianceId }) => {
    if (!alliances[allianceId]) return socket.emit("error", "Alliance inexistante");

    alliances[allianceId].attacks = alliances[allianceId].attacks.filter(a => a.id !== attackId);

    io.to(allianceId).emit("attackListUpdated", alliances[allianceId].attacks);
    console.log(`Attaque ${attackId} supprimée`);
  });


  socket.on("startAttack", ({ attackId, allianceId }) => {
    const attack = alliances[allianceId]?.attacks.find((a) => a.id === attackId);
    if (!attack) return socket.emit("error", "Attaque inexistante");

    attack.status = "ongoing";
    attack.startTime = Date.now();

    io.to(allianceId).emit("attackListUpdated", alliances[allianceId].attacks);
  });

  socket.on("endAttack", ({ attackId, allianceId }) => {
    const attack = alliances[allianceId]?.attacks.find((a) => a.id === attackId);
    if (!attack) return socket.emit("error", "Attaque inexistante");

    attack.duration = Math.floor((Date.now() - attack.startTime) / 1000); // Stocke la durée en secondes
    attack.status = "finished";

    io.to(allianceId).emit("attackListUpdated", alliances[allianceId].attacks);
  });

  socket.on("joinAttack", ({ attackId, allianceId, playerId }) => {
    console.log("playerId: " + playerId)
    console.log(alliances[allianceId].players)
    const player = alliances[allianceId].players.find(m=>m.id == playerId);
    if (!player) return;

    // Retirer le joueur de son ancienne attaque
    for (let attack of alliances[allianceId].attacks) {
      attack.players = attack.players.filter(p => p.id !== player.id);
    }

    // Ajouter le joueur à la nouvelle attaque
    const attack = alliances[allianceId].attacks.find(a => a.id === attackId);
    if (attack) {
      attack.players.push(player);
      player.attackId = attackId;

      // Envoyer la mise à jour à tous les membres de l'alliance
      io.to(allianceId).emit("attackListUpdated", alliances[allianceId].attacks);
    }

    console.log(`${player.id} a rejoint l'attaque ${attackId}`);
  });

  socket.on("leaveAttack", ({ allianceId, playerId }) => {
    const player = alliances[allianceId].players.find(m=>m.id == playerId);
    if (!player) return;

    // Retirer le joueur de l'attaque
    for (let attack of alliances[allianceId].attacks) {
      console.log(attack.players);
      attack.players = attack.players.filter(p => p.id !== player.id);
      console.log(attack.players);
    }

    player.attackId = null;

    // Envoyer la mise à jour à tous les membres de l'alliance
    io.to(allianceId).emit("attackListUpdated", alliances[allianceId].attacks);
    console.log(`${player.id} a quitté son attaque`);
  });

  socket.on("leaveGame", ({ playerId, allianceId }) => {
    // Vérifier que l'alliance existe
    if (!alliances[allianceId]) return;
  
    const alliance = alliances[allianceId];
  
    // 1. Retirer le joueur de toutes les attaques où il est présent
    alliance.attacks.forEach((attack) => {
      if (attack.players && Array.isArray(attack.players)) {
        attack.players = attack.players.filter((player) => player.id !== playerId);
      }
    });

    console.log(alliance.attacks)
  
    // 2. Retirer le joueur de la liste des joueurs de l'alliance
    alliance.players = alliance.players.filter((player) => player.id !== playerId);
  
    // 3. Optionnel : Nettoyer la table globale qui associe le socket au joueur
    for (let socketId in players) {
      if (players[socketId].id === playerId) {
        delete players[socketId];
      }
    }
  
    // 4. Informer tous les clients de l'alliance que les attaques et la liste des joueurs ont été mises à jour
    io.to(allianceId).emit("attackListUpdated", alliance.attacks);
    io.to(allianceId).emit("playerListUpdated", alliance.players);

  });

  socket.on("checkAlliance", (allianceId, callback) => {
    const exists = !!alliances[allianceId]; // Vérifie si l'alliance existe
    console.log(exists);
    callback(exists);
  });

  socket.on("getPlayerByPseudo", ({ pseudo, allianceId }, callback) => {
    if (!alliances[allianceId]) return callback(null);
    if (alliances[allianceId].players == null) return callback(null);
    const player = alliances[allianceId].players.find(p => p.pseudo === pseudo);
    callback(player ? player.id : null);
  });

  socket.on("pingServer", (callback) => {
    callback(true); // Réponse positive si le serveur fonctionne
  });

});

server.listen(3000, () => {
  console.log("Serveur démarré sur http://localhost:3000");
});