const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ============================================
// ROUTE DE TEST POUR VÉRIFIER QUE L'API FONCTIONNE
// ============================================
app.get('/api/room', (req, res) => {
    res.json({ message: "API Songo'O est opérationnelle" });
});

// ============================================
// ROUTE PRINCIPALE - RENVOIE LE FICHIER HTML
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'distant.html'));
});

// ============================================
// CONSTANTES DU JEU
// ============================================
const RULES = {
    pitsPerPlayer: 7,
    initialSeedsPerPit: 5,
    victoryScore: 40
};

const CYCLE = [
    { player: "north", pitIndex: 0 }, { player: "north", pitIndex: 1 },
    { player: "north", pitIndex: 2 }, { player: "north", pitIndex: 3 },
    { player: "north", pitIndex: 4 }, { player: "north", pitIndex: 5 },
    { player: "north", pitIndex: 6 }, { player: "south", pitIndex: 6 },
    { player: "south", pitIndex: 5 }, { player: "south", pitIndex: 4 },
    { player: "south", pitIndex: 3 }, { player: "south", pitIndex: 2 },
    { player: "south", pitIndex: 1 }, { player: "south", pitIndex: 0 }
];

function other(player) { return player === "north" ? "south" : "north"; }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function boardSeeds(state) { return sum(state.board.north) + sum(state.board.south); }
function samePosition(a, b) { return a.player === b.player && a.pitIndex === b.pitIndex; }
function attackPit(player) { return player === "north" ? { player: "north", pitIndex: 6 } : { player: "south", pitIndex: 0 }; }
function opponentFirstPit(player) { return player === "north" ? { player: "south", pitIndex: 6 } : { player: "north", pitIndex: 0 }; }
function isOpponentPit(player, position) { return position.player === other(player); }
function isCaptureValue(count) { return [2, 3, 4].includes(count); }

function opponentPath(player) {
    if (player === "north") {
        return [
            { player: "south", pitIndex: 6 }, { player: "south", pitIndex: 5 },
            { player: "south", pitIndex: 4 }, { player: "south", pitIndex: 3 },
            { player: "south", pitIndex: 2 }, { player: "south", pitIndex: 1 },
            { player: "south", pitIndex: 0 }
        ];
    } else {
        return [
            { player: "north", pitIndex: 0 }, { player: "north", pitIndex: 1 },
            { player: "north", pitIndex: 2 }, { player: "north", pitIndex: 3 },
            { player: "north", pitIndex: 4 }, { player: "north", pitIndex: 5 },
            { player: "north", pitIndex: 6 }
        ];
    }
}

function nextPositionsAfter(source) {
    const startIndex = CYCLE.findIndex(pos => samePosition(pos, source));
    const positions = [];
    for (let step = 1; step <= 13; step++) {
        const idx = (startIndex + step) % CYCLE.length;
        positions.push(CYCLE[idx]);
    }
    return positions;
}

function createGame() {
    return {
        board: {
            north: Array(RULES.pitsPerPlayer).fill(RULES.initialSeedsPerPit),
            south: Array(RULES.pitsPerPlayer).fill(RULES.initialSeedsPerPit)
        },
        scores: { north: 0, south: 0 },
        currentPlayer: "south",
        status: "playing",
        winner: null,
        moveNumber: 0
    };
}

function sowNormal(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    const source = { player, pitIndex };
    state.board[player][pitIndex] = 0;
    const path = nextPositionsAfter(source);
    for (let i = 0; i < seeds; i++) {
        const pos = path[i % path.length];
        state.board[pos.player][pos.pitIndex] += 1;
    }
    return { lastPosition: path[seeds - 1] };
}

function sowGranary(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    const source = { player, pitIndex };
    let remaining = seeds;
    let specialCapture = 0;
    state.board[player][pitIndex] = 0;
    for (const pos of nextPositionsAfter(source)) {
        state.board[pos.player][pos.pitIndex] += 1;
        remaining--;
    }
    const path = opponentPath(player);
    for (let i = 0; i < remaining; i++) {
        const pos = path[i % path.length];
        const isLastSeed = (i === remaining - 1);
        const isProtectedFirst = samePosition(pos, opponentFirstPit(player));
        if (isLastSeed && isProtectedFirst) {
            specialCapture += 1;
            continue;
        }
        state.board[pos.player][pos.pitIndex] += 1;
    }
    return { lastPosition: path[(remaining - 1) % path.length], specialCapture };
}

function sow(state, player, pitIndex) {
    const seeds = state.board[player][pitIndex];
    if (seeds <= 13) return sowNormal(state, player, pitIndex);
    return sowGranary(state, player, pitIndex);
}

function captureChain(state, player, lastPosition) {
    const path = opponentPath(player);
    const lastIndex = path.findIndex(pos => samePosition(pos, lastPosition));
    if (lastIndex < 0) return 0;
    let harvested = 0;
    for (let idx = lastIndex; idx >= 0; idx--) {
        const pos = path[idx];
        const count = state.board[pos.player][pos.pitIndex];
        if (!isCaptureValue(count)) break;
        harvested += count;
        state.board[pos.player][pos.pitIndex] = 0;
    }
    return harvested;
}

function wouldEmptyOpponent(state, player, lastPosition) {
    const testState = JSON.parse(JSON.stringify(state));
    const path = opponentPath(player);
    const lastIndex = path.findIndex(pos => samePosition(pos, lastPosition));
    if (lastIndex < 0) return false;
    for (let idx = lastIndex; idx >= 0; idx--) {
        const pos = path[idx];
        const count = testState.board[pos.player][pos.pitIndex];
        if (!isCaptureValue(count)) break;
        testState.board[pos.player][pos.pitIndex] = 0;
    }
    return sum(testState.board[other(player)]) === 0;
}

function resolveCaptures(state, player, sowingResult) {
    if (sowingResult.specialCapture > 0) {
        state.scores[player] += sowingResult.specialCapture;
        return;
    }
    const last = sowingResult.lastPosition;
    if (!last) return;
    if (!isOpponentPit(player, last)) return;
    if (samePosition(last, opponentFirstPit(player))) return;
    if (wouldEmptyOpponent(state, player, last)) return;
    const harvested = captureChain(state, player, last);
    if (harvested > 0) state.scores[player] += harvested;
}

function isAttackPitMove(player, pitIndex) {
    const attack = attackPit(player);
    return attack.player === player && attack.pitIndex === pitIndex;
}

function wouldMoveCapture(state, player, pitIndex) {
    const testState = JSON.parse(JSON.stringify(state));
    const sowing = sow(testState, player, pitIndex);
    if (sowing.specialCapture > 0) return true;
    const last = sowing.lastPosition;
    if (!last) return false;
    if (!isOpponentPit(player, last)) return false;
    if (samePosition(last, opponentFirstPit(player))) return false;
    if (wouldEmptyOpponent(testState, player, last)) return false;
    return true;
}

function isForbiddenAttackMove(state, player, pitIndex) {
    if (!isAttackPitMove(player, pitIndex)) return false;
    const seeds = state.board[player][pitIndex];
    if (seeds === 1) return true;
    if (seeds === 2) return !wouldMoveCapture(state, player, pitIndex);
    return false;
}

function opponentCampIsEmpty(state, player) {
    return sum(state.board[other(player)]) === 0;
}

function getLegalMoves(state) {
    if (state.status !== "playing") return [];
    const player = state.currentPlayer;
    const moves = [];
    for (let i = 0; i < RULES.pitsPerPlayer; i++) {
        if (state.board[player][i] > 0 && !isForbiddenAttackMove(state, player, i)) {
            moves.push({ player, pitIndex: i });
        }
    }
    if (opponentCampIsEmpty(state, player)) {
        const solidarityMoves = moves.filter(m => {
            const testState = JSON.parse(JSON.stringify(state));
            const before = sum(testState.board[other(player)]);
            sow(testState, player, m.pitIndex);
            const after = sum(testState.board[other(player)]);
            return after - before >= 7;
        });
        if (solidarityMoves.length > 0) return solidarityMoves;
    }
    return moves;
}

function applyMove(state, move) {
    const legalMoves = getLegalMoves(state);
    const isLegal = legalMoves.some(m => m.player === move.player && m.pitIndex === move.pitIndex);
    if (!isLegal) return { state, ok: false };
    
    const sowing = sow(state, move.player, move.pitIndex);
    resolveCaptures(state, move.player, sowing);
    
    if (state.scores[move.player] >= RULES.victoryScore) {
        state.status = "ended";
        state.winner = move.player;
    }
    
    const totalSeeds = boardSeeds(state);
    if (totalSeeds < 10 && state.status === "playing") {
        state.status = "ended";
        if (state.scores.north > state.scores.south) state.winner = "north";
        else if (state.scores.south > state.scores.north) state.winner = "south";
        else state.winner = "draw";
    }
    
    if (state.status === "playing") {
        state.currentPlayer = other(state.currentPlayer);
    }
    
    return { state, ok: true };
}

// ============================================
// GESTION DES SALLES MULTIJOUEUR
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
        gameState: null,
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
    room.gameState = createGame();
    
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
    const result = applyMove(room.gameState, { player, pitIndex });
    res.json({ ok: result.ok });
});

app.post('/api/room/:roomId/reset', (req, res) => {
    const room = rooms.get(req.params.roomId);
    if (!room) return res.json({ error: "Salle introuvable" });
    room.gameState = createGame();
    res.json({ ok: true });
});

setInterval(() => {
    for (const [id, room] of rooms) {
        if (!room.gameStarted && Date.now() - room.createdAt > 300000) {
            rooms.delete(id);
        }
    }
}, 300000);

// DÉMARRAGE DU SERVEUR
app.listen(port, () => {
    console.log(`✅ Serveur Songo'O - http://localhost:${port}`);
});
