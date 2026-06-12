# SONGO'O - L'HÉRITAGE 🎮

Jeu de stratégie africain multijoueur en ligne.

## 📁 Structure du projet

```
/
├── index.html      ← Interface du jeu
├── server.js       ← Serveur Node.js (API + Keep-alive)
├── package.json    ← Dépendances
└── README.md
```

## 🚀 Déploiement sur Render

1. **Push sur GitHub** : mets ces 4 fichiers dans un repo GitHub
2. **Render** → New → Web Service → connecte ton repo
3. **Paramètres Render** :
   - Environment : `Node`
   - Build Command : `npm install`
   - Start Command : `node server.js`
4. **Variable d'environnement** : Render ajoute automatiquement `RENDER_EXTERNAL_URL`
5. Clique **Deploy** ✅

## ✨ Fonctionnalités

- 🎲 Créer une salle multijoueur
- 🔑 Rejoindre via code
- 👤 Choix de pseudo et avatar (6 animaux africains)
- ⚔️ Plateau Songo'o 7 cases × 2 joueurs
- 🌱 5 graines par case au départ
- 📦 Capture de graines (2, 3 ou 4)
- 🏆 Victoire à 40 graines capturées
- 🔄 Nouvelle partie sans quitter la salle
- ♻️ Keep-alive automatique (pas de sommeil sur Render Free)

## 🎯 Comment jouer

1. **Joueur 1** : Crée une partie, choisit son avatar, partage le code
2. **Joueur 2** : Entre le code, choisit son avatar, rejoint
3. Le Camp Sud joue en premier
4. Clique sur une de tes cases pour distribuer les graines
5. Si la dernière graine tombe chez l'adversaire sur 2, 3 ou 4 → capture !
6. Premier à 40 graines gagne 🏆
