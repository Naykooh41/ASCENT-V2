# ASCENT — L'ascension de soi 🏔

Application de développement personnel (corps + esprit), PWA mobile-first en français.
Direction "Nuit d'altitude" : deck de cartes 3D swipable, fil d'ascension gravi par ton compagnon, ambiances qui suivent l'heure.

## Lancer en local
```bash
npm install
npm run dev
```
(En local, l'IA ne répond pas sans la fonction serverless — utilise `vercel dev` avec la clé, ou déploie.)

## Déployer sur Vercel
1. Pousse ce dossier sur un repo GitHub.
2. Sur vercel.com → "Add New Project" → importe le repo (Vite est détecté automatiquement).
3. Dans **Settings → Environment Variables**, ajoute :
   - `ANTHROPIC_API_KEY` = ta clé API Anthropic
4. Deploy. La route `/api/claude` est servie automatiquement depuis `api/claude.js` — la clé ne quitte jamais le serveur.

## Installer sur iPhone
Ouvre l'URL Vercel dans Safari → Partager → **"Sur l'écran d'accueil"**. L'app se lance en plein écran avec son icône.

## Ce qui est branché
- **Persistance** : tout est sauvegardé en localStorage (clé `ascent-v2`), avec **bascule de journée** automatique au premier lancement du jour (streaks mis à jour, semaine glissante, remise à zéro douce du quotidien, tâches "demain" ramenées à aujourd'hui).
- **IA réelle** via `/api/claude` : bilan hebdo du coach (à partir de tes vraies données, jamais du journal), analyse de transformation (2 photos), fiches IA des exercices persos, **photo de repas → estimation calories** (Premium).
- **PWA** : manifest, icônes, service worker (réseau d'abord, cache en secours).
- **Historique quotidien réel** : chaque bascule de journée archive `{date, score, humeur, séance, habitudes %, eau}` (400 jours max). Il alimente les Statistiques (courbes 14 j, résumé 7 j, heatmap 52 semaines), les Insights de l'accueil et le bilan du Coach IA. Bouton « Semer 90 j d'historique » en mode développeur pour tester.

## Notes & pistes v2
- Les photos de progression sont persistées en localStorage : au-delà de ~4-5 Mo cumulés, le quota peut bloquer la sauvegarde → migrer photos/notes vocales vers IndexedDB.
- Les notes vocales ne persistent pas entre sessions (URLs blob) → IndexedDB également.
- Énigmes : les 5 questions sont fixes pour l'instant → brancher un pool avec rotation quotidienne.
- Paiement Premium : le bouton active le flag localement → brancher RevenueCat/Stripe avant lancement.
- Restent dans l'ancienne base à porter si souhaité : mondes 2.5D, bilingue FR/EN, plafonds anti-abus XP, fantôme volant du tutoriel, thème clair.

Fait avec soin — le sommet, c'est toi. ⛰️
