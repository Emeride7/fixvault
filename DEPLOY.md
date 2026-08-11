# FixVault – Déploiement PWA (GitHub Pages)

## ⚡ Déploiement rapide

1. **Dézippe** ce fichier sur ton PC
2. **Modifie** `js/supabaseClient.js` avec tes vraies clés
3. **Upload** tous les fichiers sur GitHub (remplace l'ancien repo)
4. **Attends 2-3 minutes** que GitHub Pages se mette à jour
5. **Vide le cache** de ton navigateur (Ctrl+F5 sur le site)
6. **Teste** sur https://emeride7.github.io/fixvault/

## ✅ Vérification PWA

Ouvre le site, puis dans la console (F12) tape :
```javascript
// Vérifier le manifest
JSON.stringify(await (await fetch('/fixvault/manifest.json')).json(), null, 2)

// Vérifier le Service Worker
navigator.serviceWorker.ready.then(r => console.log('SW ready:', r.scope))
```

Si les deux marchent, retourne sur **PWA Builder** et ça devrait être vert.

## 🔧 Si PWA Builder dit toujours "not store ready"

Les causes les plus fréquentes :

| Problème | Vérification |
|---|---|
| Manifest pas trouvé | Ouvre `https://emeride7.github.io/fixvault/manifest.json` dans un nouvel onglet |
| SW pas détecté | Dans la console : `navigator.serviceWorker.controller` doit retourner un objet |
| Icône 512 manquante | Vérifie que `icons/icon-512x512.png` existe bien dans le repo |
| Screenshot manquant | Vérifie que `screenshots/screen1.png` et `screen2.png` existent |

## 📱 Une fois PWA Builder vert

1. Sur PWA Builder, clique **"Package for stores"**
2. Choisis **Android**
3. Clique **Generate**
4. Télécharge le ZIP contenant l'APK
