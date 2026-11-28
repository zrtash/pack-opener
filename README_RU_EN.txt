FOOTPACKS — RU/EN SOURCE PACKAGE

WHAT CHANGED
- Added a visible RU / EN switch in the top bar.
- Russian remains the default language.
- The selected language is saved in browser localStorage.
- Added English translations for the main static interface, navigation, filters, profile labels, quests, season labels, common notifications and many Firebase/server error messages.
- Added a MutationObserver so newly rendered game UI is translated when supported by the dictionary.
- The original game logic (script.js), Firebase configuration, Firestore rules and Cloud Functions source were not modified for localisation.

HOW TO OPEN THE PROJECT
1. Extract the ZIP archive fully.
2. Open the extracted FootballersCard folder in VS Code.
3. Open index.html with VS Code Live Server, or run a local HTTP server from this folder:
   python -m http.server 5500
4. Open http://localhost:5500 in your browser.

Do not open index.html directly as file://. The game imports Firebase ES modules and should be served over HTTP/HTTPS.

IMPORTANT
- This is a development/source package, not a final GamePush submission archive.
- The functions/node_modules folder is intentionally excluded to keep the archive small. If you need to deploy Cloud Functions, open a terminal in FootballersCard/functions and run: npm install
- The English localisation is an initial implementation. A small number of rare generated messages, custom user-entered text, player/club data, and text drawn directly onto canvas/profile images may remain in Russian. Review all game sections before marking English as a supported language in GamePush.
- This package does not add the GamePush SDK or change the game's Firebase backend integration.
