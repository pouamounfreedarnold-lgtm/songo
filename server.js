const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// KEEP-ALIVE : évite que Render endorme le serveur
// ============================================
const APP_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
setInterval(() => {
    const http = require('http');
    const https = require('https');
    const client = APP_URL.startsWith('https') ? https : http;
    client.get(`${APP_URL}/ping`, (res) => {
        console.log(`♻️  Keep-alive ping - status: ${res.statusCode}`);
    }).on('error', (e) => {
        console.log(`⚠️  Keep-alive erreur: ${e.message}`);
    });
}, 14 * 60 * 1000); // toutes les 14 minutes

app.get('/ping', (req, res) => res.json({ ok: true, time: Date.now() }));

// Route test API
app.get('/api/room', (req, res) => {
    res.json({ message: "API Songo'O est opérationnelle" });
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// GESTION DES SALLES
// ============================================
const rooms = new Map();

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Créer une salle
app.post('/api/room', (req, res) => {
    const { playerName, playerAvatar } = req.body;
    const roomId = generateRoomId();
    rooms.set(roomId, {
        players: [{ name: playerName, avatar: playerAvatar, player: "south" }],
        gameState: {
            board: { north: [5,5,5,5,5,5,5], south: [5,5,5,5,5,5,5] },
            scores: { north: 0, south: 0 },
            currentPlayer: "south",
            status: "playing",
            winner: null,
            lastMove: null
        },
        gameStarted: false,
        createdAt: Date.now()
    });
    res.json({ roomId, player: "south" });
});

// Rejoindre une salle
app.post('/api/room/:roomId/join', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.json({ error: "Salle introuvable" });
    if (room.players.length >= 2) return res.json({ error: "Salle pleine" });

    const { playerName, playerAvatar } = req.body;
    room.players.push({ name: playerName, avatar: playerAvatar, player: "north" });
    room.gameStarted = true;

    const opponent = room.players.find(p => p.player === "south");
    res.json({
        player: "north",
        opponentName: opponent?.name,
        opponentAvatar: opponent?.avatar
    });
});

// Statut de la salle (attente adversaire)
app.get('/api/room/:roomId/status', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.json({ error: "Salle introuvable" });
    if (room.gameStarted && room.players.length === 2) {
        const opponent = room.players.find(p => p.player === "north");
        res.json({ ready: true, opponentName: opponent?.name, opponentAvatar: opponent?.avatar });
    } else {
        res.json({ ready: false });
    }
});

// État du jeu
app.get('/api/room/:roomId/state', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room || !room.gameState) return res.json({ error: "Partie non démarrée" });
    res.json(room.gameState);
});

// Jouer un coup
app.post('/api/room/:roomId/move', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room || !room.gameState) return res.json({ error: "Partie non démarrée" });
    const { player, pitIndex } = req.body;
    const state = room.gameState;

    if (state.status !== "playing") return res.json({ ok: false, reason: "partie_terminee" });
    if (state.currentPlayer !== player) return res.json({ ok: false, reason: "pas_ton_tour" });
    if (state.board[player][pitIndex] === 0) return res.json({ ok: false, reason: "case_vide" });

    const seeds = state.board[player][pitIndex];
    state.board[player][pitIndex] = 0;
    let currentSide = player;
    let currentIndex = pitIndex;

    // Distribution des graines
    for (let i = 0; i < seeds; i++) {
        if (currentSide === "south") {
            if (currentIndex < 6) {
                currentIndex++;
            } else {
                currentSide = "north";
                currentIndex = 0;
            }
        } else {
            if (currentIndex < 6) {
                currentIndex++;
            } else {
                currentSide = "south";
                currentIndex = 0;
            }
        }
        state.board[currentSide][currentIndex]++;
    }

    // Capture : si la dernière graine tombe chez l'adversaire et fait 2, 3 ou 4
    if (currentSide !== player) {
        let captureIndex = currentIndex;
        let captureSide = currentSide;
        // Capture en chaîne tant que la condition est remplie
        while (captureSide !== player) {
            const count = state.board[captureSide][captureIndex];
            if (count === 2 || count === 3 || count === 4) {
                state.scores[player] += count;
                state.board[captureSide][captureIndex] = 0;
                // Reculer d'une case pour vérifier la précédente
                if (captureIndex > 0) {
                    captureIndex--;
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    // Vérifier si l'adversaire a encore des graines (sinon on lui donne les restantes)
    const opponent = player === "south" ? "north" : "south";
    const opponentSeeds = state.board[opponent].reduce((a, b) => a + b, 0);
    if (opponentSeeds === 0) {
        const mySeeds = state.board[player].reduce((a, b) => a + b, 0);
        state.scores[player] += mySeeds;
        state.board[player] = [0,0,0,0,0,0,0];
        state.status = "ended";
        state.winner = state.scores[player] > state.scores[opponent] ? player :
                       state.scores[opponent] > state.scores[player] ? opponent : "draw";
    }
    // Vérifier victoire par score
    else if (state.scores[player] >= 40) {
        state.status = "ended";
        state.winner = player;
    } else if (state.scores[opponent] >= 40) {
        state.status = "ended";
        state.winner = opponent;
    } else {
        state.currentPlayer = opponent;
    }

    state.lastMove = { player, pitIndex, timestamp: Date.now() };
    res.json({ ok: true, gameState: state });
});

// Réinitialiser la partie
app.post('/api/room/:roomId/reset', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.json({ error: "Salle introuvable" });
    room.gameState = {
        board: { north: [5,5,5,5,5,5,5], south: [5,5,5,5,5,5,5] },
        scores: { north: 0, south: 0 },
        currentPlayer: "south",
        status: "playing",
        winner: null,
        lastMove: null
    };
    res.json({ ok: true });
});

// Nettoyage des salles inactives toutes les 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
        const age = now - room.createdAt;
        // Supprimer si pas démarrée après 5min ou terminée depuis 30min
        if ((!room.gameStarted && age > 5 * 60 * 1000) ||
            (room.gameState?.status === 'ended' && age > 30 * 60 * 1000) ||
            age > 2 * 60 * 60 * 1000) {
            rooms.delete(id);
            console.log(`🗑️  Salle ${id} supprimée`);
        }
    }
}, 10 * 60 * 1000);

app.listen(port, () => {
    console.log(`✅ Serveur Songo'O démarré - http://localhost:${port}`);
    console.log(`📡 Keep-alive activé - ping toutes les 14 minutes`);
});
