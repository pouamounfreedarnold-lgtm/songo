const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Route GET pour tester l'API
app.get('/api/room', (req, res) => {
    res.json({ message: "API Songo'O est opérationnelle" });
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'distant.html'));
});

// ============================================
// GESTION DES SALLES (version simplifiée et fonctionnelle)
// ============================================
const rooms = new Map();

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.post('/api/room', (req, res) => {
    const { playerName, playerAvatar } = req.body;
    const roomId = generateRoomId();
    rooms.set(roomId, {
        players: [{ name: playerName, avatar: playerAvatar, player: "south" }],
        gameState: {
            board: { north: [5,5,5,5,5,5,5], south: [5,5,5,5,5,5,5] },
            scores: { north: 0, south: 0 },
            currentPlayer: "south",
            status: "playing"
        },
        gameStarted: false,
        createdAt: Date.now()
    });
    res.json({ roomId, player: "south" });
});

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

app.get('/api/room/:roomId/state', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room || !room.gameState) return res.json({ error: "Partie non démarrée" });
    res.json(room.gameState);
});

app.post('/api/room/:roomId/move', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room || !room.gameState) return res.json({ error: "Partie non démarrée" });
    const { player, pitIndex } = req.body;
    const state = room.gameState;
    
    if (state.status !== "playing") return res.json({ ok: false });
    if (state.currentPlayer !== player) return res.json({ ok: false });
    if (state.board[player][pitIndex] === 0) return res.json({ ok: false });
    
    const seeds = state.board[player][pitIndex];
    state.board[player][pitIndex] = 0;
    let currentPlayer = player;
    let currentIndex = pitIndex;
    
    for (let i = 0; i < seeds; i++) {
        if (currentPlayer === "south") {
            if (currentIndex < 6) {
                currentIndex++;
            } else {
                currentPlayer = "north";
                currentIndex = 0;
            }
        } else {
            if (currentIndex < 6) {
                currentIndex++;
            } else {
                currentPlayer = "south";
                currentIndex = 0;
            }
        }
        state.board[currentPlayer][currentIndex]++;
    }
    
    // Vérifier capture simplifiée
    if (currentPlayer !== player) {
        const lastCount = state.board[currentPlayer][currentIndex];
        if (lastCount === 2 || lastCount === 3 || lastCount === 4) {
            state.scores[player] += lastCount;
            state.board[currentPlayer][currentIndex] = 0;
        }
    }
    
    // Vérifier victoire
    if (state.scores[player] >= 40) {
        state.status = "ended";
        state.winner = player;
    } else {
        state.currentPlayer = player === "south" ? "north" : "south";
    }
    
    res.json({ ok: true });
});

app.post('/api/room/:roomId/reset', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.json({ error: "Salle introuvable" });
    room.gameState = {
        board: { north: [5,5,5,5,5,5,5], south: [5,5,5,5,5,5,5] },
        scores: { north: 0, south: 0 },
        currentPlayer: "south",
        status: "playing"
    };
    res.json({ ok: true });
});

setInterval(() => {
    for (const [id, room] of rooms) {
        if (!room.gameStarted && Date.now() - room.createdAt > 300000) {
            rooms.delete(id);
        }
    }
}, 300000);

app.listen(port, () => {
    console.log(`✅ Serveur Songo'O - http://localhost:${port}`);
});
