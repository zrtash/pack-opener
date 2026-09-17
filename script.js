import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
// 🔥 Исправили версию 10.12.2 на 12.19.0 вот в этой строке:
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAhsV-ukcTQJsHNww1mme34kz5qfaE2Hxk",
  authDomain: "football-cards-game-21af2.firebaseapp.com",
  projectId: "football-cards-game-21af2",
  storageBucket: "football-cards-game-21af2.firebasestorage.app",
  messagingSenderId: "244547134478",
  appId: "1:244547134478:web:c078e6933845eb011b485f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
let userClub = { name: "Real Madrid", img: "./real.png" };
let currentUserUid = null;
let currentSort = null;

const players = [
  // --- ИКОНЫ (ДЖЕКПОТ) ---
  {
    id: "maradona",
    name: "Maradona (ICON)",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://images.fotmob.com/image_resources/playerimages/158546.png",
  },
  {
    id: "pele",
    name: "Pele (ICON)",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/237067.png?fm=png&ixlib=java-2.1.0&verzion=2&w=324&s=22102a1903bfc0271a823f3a78443f56",
  },
  {
    id: "ronaldinho",
    name: "Ronaldinho (ICON)",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://images.fotmob.com/image_resources/playerimages/30743.png",
  },

  // --- 91 ---
  {
    id: "haaland",
    name: "E. Haaland",
    raiting: 91,
    club: "Man City",
    league: "Premier League",
    pos: "ST",
    price: 1800,
    photo: "https://images.fotmob.com/image_resources/playerimages/737066.png",
  },
  {
    id: "mbappe",
    name: "K. Mbappe",
    raiting: 91,
    club: "Real Madrid",
    league: "La Liga",
    pos: "ST",
    price: 1800,
    photo: "https://images.fotmob.com/image_resources/playerimages/701154.png",
  },

  // --- 90 ---
  {
    id: "bellingham",
    name: "J. Bellingham",
    raiting: 90,
    club: "Real Madrid",
    league: "La Liga",
    pos: "CAM",
    price: 1200,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/252371.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=43c11216f91c947bd4187b5d7c37c8c8",
  },
  {
    id: "courtois",
    name: "T. Courtois",
    raiting: 90,
    club: "Real Madrid",
    league: "La Liga",
    pos: "GK",
    price: 1200,
    photo: "https://images.fotmob.com/image_resources/playerimages/170323.png",
  },
  {
    id: "yamal",
    name: "L. Yamal",
    raiting: 90,
    club: "Barcelona",
    league: "La Liga",
    pos: "RW",
    price: 1200,
    photo: "https://images.fotmob.com/image_resources/playerimages/1467236.png",
  },

  {
    id: "kane",
    name: "H. Kane",
    raiting: 90,
    club: "Bayern Munich",
    league: "Bundesliga",
    pos: "ST",
    price: 1200,
    photo: "https://images.fotmob.com/image_resources/playerimages/194165.png",
  },
  {
    id: "rodri",
    name: "Rodri",
    raiting: 90,
    club: "Barcelona",
    league: "La Liga",
    pos: "CDM",
    price: 1200,
    photo: "https://images.fotmob.com/image_resources/playerimages/675088.png",
  },
  {
    id: "messi",
    name: "L. Messi",
    raiting: 89,
    club: "Inter Miami",
    league: "MLS",
    pos: "RW",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/30981.png",
  },
  {
    id: "debruyne",
    name: "K. De Bruyne",
    raiting: 85,
    club: "Man City",
    league: "Premier League",
    pos: "CM",
    price: 250,
    photo: "https://images.fotmob.com/image_resources/playerimages/169200.png",
  },
  {
    id: "alisson",
    name: "Alisson",
    raiting: 87,
    club: "Liverpool",
    league: "Premier League",
    pos: "GK",
    price: 450,
    photo: "https://images.fotmob.com/image_resources/playerimages/319784.png",
  },

  // --- 89 ---
  {
    id: "lautaro",
    name: "Lautaro Martínez",
    raiting: 89,
    club: "Inter",
    league: "Seria A",
    pos: "ST",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/690230.png",
  },
  {
    id: "saka",
    name: "B. Saka",
    raiting: 89,
    club: "Arsenal",
    league: "Premier League",
    pos: "RW",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/961995.png",
  },
  {
    id: "vini",
    name: "Vinicius JR",
    raiting: 89,
    club: "Real Madrid",
    league: "La Liga",
    pos: "LW",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/846033.png",
  },
  {
    id: "ødegaard",
    name: "M. Ødegaard",
    raiting: 89,
    club: "Arsenal",
    league: "Premier League",
    pos: "CM",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/534670.png",
  },

  // --- 88 ---
  {
    id: "griezmann",
    name: "A. Griezmann",
    raiting: 88,
    club: "Orlando City",
    league: "USA",
    pos: "ST",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/184138.png",
  },
  {
    id: "kimmich",
    name: "J. Kimmich",
    raiting: 88,
    club: "Bayern Munich",
    league: "Bundesliga",
    pos: "CDM",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/460632.png",
  },
  {
    id: "obak",
    name: "J. Oblak",
    raiting: 88,
    club: "Atletico Madrid",
    league: "La Liga",
    pos: "GK",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/177126.png",
  },
  {
    id: "raphinha",
    name: "Raphinha",
    raiting: 88,
    club: "Barcelona",
    league: "La Liga",
    pos: "LW",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/696679.png",
  },

  // --- 87 (Окупают элитный пак) ---
  {
    id: "bastoni",
    name: "A. Bastoni",
    raiting: 87,
    club: "Inter",
    league: "Seria A",
    pos: "CB",
    price: 450,
    photo: "https://images.fotmob.com/image_resources/playerimages/805451.png",
  },
  {
    id: "salah",
    name: "M. Salah",
    raiting: 87,
    club: "Liverpool",
    league: "Premier League",
    pos: "RCM",
    price: 450,
    photo: "https://images.fotmob.com/image_resources/playerimages/292462.png",
  },
  {
    id: "saliba",
    name: "W. Saliba",
    raiting: 87,
    club: "Arsenal",
    league: "Premier League",
    pos: "CB",
    price: 450,
    photo: "https://images.fotmob.com/image_resources/playerimages/955406.png",
  },
  {
    id: "valverde",
    name: "F. Valverde",
    raiting: 87,
    club: "Real Madrid",
    league: "La Liga",
    pos: "CM",
    price: 450,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/239053.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=a851591e5fc080f9bff55712bf22eb43",
  },

  // --- 86 ---
  {
    id: "barella",
    name: "N. Barella",
    raiting: 86,
    club: "Inter",
    league: "Seria A",
    pos: "CM",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/541820.png",
  },
  {
    id: "garcia",
    name: "J. García",
    raiting: 86,
    club: "Barcelona",
    league: "La Liga",
    pos: "GK",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/1167220.png",
  },
  {
    id: "leao",
    name: "R. Leão",
    raiting: 86,
    club: "Galatasaray",
    league: "Super Liga",
    pos: "LW",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/848844.png",
  },
  {
    id: "cubarsi",
    name: "P. Cubarsí",
    raiting: 86,
    club: "Barcelona",
    league: "La Liga",
    pos: "CB",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/1532137.png",
  },

  // --- 85 ---
  {
    id: "modric",
    name: "L. Modric",
    raiting: 85,
    club: "Milan",
    league: "Seria A",
    pos: "CM",
    price: 250,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/177003.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=215405a00706549bf537e0f1078e0a64",
  },
  {
    id: "kounde",
    name: "J. Koundé",
    raiting: 85,
    club: "Barcelona",
    league: "La Liga",
    pos: "RB",
    price: 250,
    photo: "https://images.fotmob.com/image_resources/playerimages/705450.png",
  },

  // --- 84 ---
  {
    id: "foden",
    name: "P. Foden",
    raiting: 84,
    club: "Man City",
    league: "Premier League",
    pos: "CAM",
    price: 200,
    photo: "https://images.fotmob.com/image_resources/playerimages/815006.png",
  },
  {
    id: "rodrygo",
    name: "Rodrygo",
    raiting: 84,
    club: "Real Madrid",
    league: "La Liga",
    pos: "LW",
    price: 200,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/243812.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=15da1322318a8283a0cb4b8de5871780",
  },
  {
    id: "ronaldo",
    name: "Cristiano Ronaldo",
    raiting: 84,
    club: "Al-Nasr",
    league: "Saudi Pro League",
    pos: "ST",
    price: 200,
    photo: "https://images.fotmob.com/image_resources/playerimages/30893.png",
  },
  {
    id: "tchouameni",
    name: "A. Tchouameni",
    raiting: 84,
    club: "Real Madrid",
    league: "La Liga",
    pos: "CDM",
    price: 200,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/241637.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=9c6ddd81b016f5c964e6d06e8765fd3f",
  },

  // --- 83 ---
  {
    id: "guler",
    name: "A. Guler",
    raiting: 83,
    club: "Real Madrid",
    league: "La Liga",
    pos: "CM",
    price: 150,
    photo: "https://images.fotmob.com/image_resources/playerimages/1253890.png",
  },
  {
    id: "rudiger",
    name: "A. Rudiger",
    raiting: 83,
    club: "Real Madrid",
    league: "La Liga",
    pos: "CB",
    price: 150,
    photo: "https://images.fotmob.com/image_resources/playerimages/276738.png",
  },
  {
    id: "сancelo",
    name: "J. Cancelo",
    raiting: 83,
    club: "Barcelona",
    league: "La Liga",
    pos: "LB",
    price: 150,
    photo: "https://images.fotmob.com/image_resources/playerimages/361757.png",
  },

  // --- 81 и ниже ---
  {
    id: "camavinga",
    name: "E. Camavinga",
    raiting: 81,
    club: "Real Madrid",
    league: "La Liga",
    pos: "CM",
    price: 100,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/248243.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=503a41e502b5397215284abe7b3b6c50",
  },
  {
    id: "walker",
    name: "K. Walker",
    raiting: 76,
    club: "Burnley",
    league: "Premier League",
    pos: "RB",
    price: 50,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/188377.png?fm=png&ixlib=java-2.1.0&verzion=1&w=324&s=85c22a8ec93bad8cc1fdd98190140a2b",
  },
];

function getShortName(fullName) {
  if (fullName.includes(".")) return fullName.split(". ")[1];
  if (fullName.includes("(")) return fullName.split(" ")[0];
  return fullName;
}

const packTypes = {
  standard: {
    cost: 200,
    weights: {
      walker: 60,
      camavinga: 50,
      guler: 40,
      rudiger: 40,
      сancelo: 40,
      tchouameni: 30,
      rodrygo: 30,
      foden: 30,
      ronaldo: 30,
      modric: 20,
      kounde: 20,
      debruyne: 20,
      alisson: 8,
      messi: 3,
      kane: 1,
      rodri: 1,
      barella: 15,
      garcia: 15,
      leao: 15,
      cubarsi: 15,
      valverde: 8,
      salah: 8,
      saliba: 8,
      bastoni: 8,
      raphinha: 5,
      obak: 5,
      griezmann: 5,
      kimmich: 5,
      vini: 3,
      saka: 3,
      ødegaard: 3,
      lautaro: 3,
      yamal: 1,
      courtois: 1,
      bellingham: 1,
      mbappe: 0.5,
      haaland: 0.5,
      maradona: 0.1,
      pele: 0.1,
      ronaldinho: 0.1,
    },
  },
  elite: {
    cost: 450,
    weights: {
      // Мусор убираем или делаем очень редким
      walker: 0,
      camavinga: 0,
      guler: 0,
      rudiger: 0,
      сancelo: 0,

      // 84 рейтинг (падает, но редко)
      tchouameni: 5,
      rodrygo: 5,
      foden: 5,
      ronaldo: 5,

      // 85 рейтинг
      modric: 15,
      kounde: 15,
      debruyne: 15,
      alisson: 25,
      messi: 15,
      kane: 15,
      rodri: 15,

      // 86-88 (Основной костяк элитного пака)
      barella: 20,
      garcia: 20,
      leao: 20,
      cubarsi: 20,
      valverde: 25,
      salah: 25,
      saliba: 25,
      bastoni: 25,
      raphinha: 20,
      obak: 20,
      griezmann: 20,
      kimmich: 20,

      // 89 (Часто окупают пак в огромный плюс)
      vini: 15,
      saka: 15,
      ødegaard: 15,
      lautaro: 15,

      // 90 (Фиолетовые Walkouts - Заметно увеличен шанс!)
      yamal: 15,
      courtois: 15,
      bellingham: 15,

      // 91 (Супер-топы)
      mbappe: 8,
      haaland: 8,

      // ИКОНЫ (Золотое свечение - теперь их реально выбить!)
      maradona: 3,
      pele: 3,
      ronaldinho: 3,
    },
  },
};

// 🔊 Менеджер звуков (только клик)
const sounds = {
  click: new Audio("./click2.mp3"),
};

// Делаем клик тихим и приятным
sounds.click.volume = 0.3;

function playSound(type) {
  if (sounds[type]) {
    sounds[type].currentTime = 0;
    sounds[type].play().catch((error) => {
      console.log("Браузер заблокировал звук до первого клика", error);
    });
  }
}

async function loadPlayersFromDB() {
  try {
    const querySnapshot = await getDocs(collection(db, "players"));
    querySnapshot.forEach((doc) => {
      const customPlayer = doc.data();
      if (!players.find((p) => p.id === customPlayer.id)) {
        players.push(customPlayer);
        packTypes.standard.weights[customPlayer.id] =
          customPlayer.weightStandard !== undefined
            ? customPlayer.weightStandard
            : 5;
        packTypes.elite.weights[customPlayer.id] =
          customPlayer.weightElite !== undefined ? customPlayer.weightElite : 5;
      }
    });
    console.log("✅ Игроки из базы успешно загружены!");
    updateUI();
  } catch (error) {
    console.error("❌ Ошибка при загрузке игроков из базы:", error);
  }
}

loadPlayersFromDB();

const questDefinitions = [
  {
    id: "open_3",
    title: "Новичок",
    desc: "Открой 3 пака",
    target: 3,
    type: "packs",
    reward: 150,
  },
  {
    id: "open_10",
    title: "Опытный кейсер",
    desc: "Открой 10 паков",
    target: 10,
    type: "packs",
    reward: 350,
  },
  {
    id: "elite_5",
    title: "Элитный риск",
    desc: "Открой 5 элитных паков подряд",
    target: 5,
    type: "elite_streak",
    reward: 1000,
  },
  {
    id: "collect_10",
    title: "Коллекционер",
    desc: "Собери 10 уникальных игроков",
    target: 10,
    type: "unique_players",
    reward: 600,
  },
  {
    id: "collect_madrid",
    title: "Мадридский снайпер",
    desc: "Выбей 3 игроков Реал Мадрид",
    target: 3,
    type: "madrid",
    reward: 400,
  },
  {
    id: "stars_90",
    title: "Легендарный улов",
    desc: "Выбей игрока с рейтингом 90+",
    target: 1,
    type: "stars",
    reward: 800,
  },
  {
    id: "rich_club",
    title: "Клуб миллионеров",
    desc: "Накопи 5 000$ на балансе",
    target: 5000,
    type: "coins",
    reward: 600,
  },
];

let coins = parseInt(localStorage.getItem("cards_coins")) || 1000;
let totalOpened = parseInt(localStorage.getItem("cards_totalOpened")) || 0;
let eliteStreak = parseInt(localStorage.getItem("cards_eliteStreak")) || 0;
let inventory = JSON.parse(localStorage.getItem("cards_inventory")) || {};
let squad = JSON.parse(localStorage.getItem("cards_squad")) || {
  LW: null,
  ST: null,
  RW: null,
  LCM: null,
  CM: null,
  RCM: null,
  LB: null,
  LCB: null,
  RCB: null,
  RB: null,
  GK: null,
};
let completedQuests =
  JSON.parse(localStorage.getItem("cards_completed_quests")) || [];
let leaderboard = JSON.parse(localStorage.getItem("cards_leaderboard")) || [
  { name: "Cristiano7", score: 42 },
  { name: "PackKing", score: 35 },
];
let sbcBurnList = [];

let currentPackType = "standard";
let lastDroppedPlayer = null;
let selectedPitchPos = null;
let activeFilter = "all";

function checkDailyBonus() {
  const lastBonusTime = parseInt(localStorage.getItem("cards_last_bonus")) || 0;
  const now = Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;

  if (now - lastBonusTime > twelveHours) {
    coins += 500;
    localStorage.setItem("cards_last_bonus", now);
    
    // Вместо скучного стандартного alert используем тост
    showToast("🎁 Ежедневный бонус! Начислено +500$!");
    
    saveState();
    if (typeof updateUI === "function") updateUI();
  }
}
checkDailyBonus();

// Красивое всплывающее уведомление вместо alert
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "game-toast";
  if (type === "error") {
    toast.style.borderLeftColor = "#ef4444";
  }
  toast.textContent = message;

  container.appendChild(toast);

  // Удаляем элемент из DOM через 3 секунды после окончания анимации
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Сохраняем и локально (для скорости), и в облако Firebase!
async function saveState() {
  localStorage.setItem("cards_coins", coins);
  // ... твои остальные строки локалсторадж ...

  if (currentUserUid) {
    try {
      await setDoc(
        doc(db, "users", currentUserUid),
        {
          nickname: document.getElementById("top-nickname").textContent,
          coins: coins,
          totalOpened: totalOpened,
          eliteStreak: eliteStreak,
          inventory: inventory,
          squad: squad,
          completedQuests: completedQuests,
          userClub: userClub, // <--- Добавили сохранение клуба!
          lastUpdated: Date.now(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Ошибка сохранения в облако:", error);
    }
  }
}

function updateUI() {
  document.getElementById("coins-count").textContent = coins;
  document.getElementById("pack-count").textContent = totalOpened;
  document.getElementById("btn").textContent =
    `Открыть (${packTypes[currentPackType].cost}$)`;
  document.getElementById("btn").disabled =
    coins < packTypes[currentPackType].cost;

  const collectedCount = players.filter(
    (p) => inventory[p.id]?.count > 0,
  ).length;
  document.getElementById("collection-count").textContent = collectedCount;
  document.getElementById("collection-total").textContent = players.length;
}

function checkBankruptcy() {
  const minCost = packTypes.standard.cost;
  const totalCardsValue = players.reduce(
    (sum, p) => sum + (inventory[p.id]?.count || 0) * p.price,
    0,
  );
  if (coins + totalCardsValue < minCost) {
    document.getElementById("final-pack-score").textContent = totalOpened;
    document.getElementById("gameover-modal").style.display = "flex";
  }
}

function initSlots() {
  const grid = document.getElementById("collection-grid");
  grid.innerHTML = "";

  // 1. Фильтрация по лиге или позициям
  let filtered = players.filter((p) => {
    if (activeFilter === "all") return true;

    // Приводим позицию игрока и фильтр к верхнему регистру, чтобы избежать ошибок с буквой "gk" / "GK"
    const playerPos = (p.pos || "").trim().toUpperCase();
    const filter = (activeFilter || "").trim().toUpperCase();

    if (filter === "GK") {
      return playerPos === "GK"; // Строго ищем вратарей
    }
    if (filter === "ST") {
      return ["ST", "LW", "RW", "CAM"].includes(playerPos);
    }
    if (filter === "CM") {
      return ["CM", "CDM"].includes(playerPos);
    }
    if (filter === "CB") {
      return ["CB", "LB", "RB"].includes(playerPos);
    }

    return p.league === activeFilter || p.club === activeFilter;
  });

  // 2. Сортировка по рейтингу (если она выбрана)
  if (currentSort === "desc") {
    filtered.sort((a, b) => b.raiting - a.raiting); // Сначала топ (от 99 до 70)
  } else if (currentSort === "asc") {
    filtered.sort((a, b) => a.raiting - b.raiting); // Сначала слабые (от 70 до 99)
  }

  // 3. Рендер отфильтрованного и отсортированного списка
  filtered.forEach((player) => {
    if (!inventory[player.id]) inventory[player.id] = { count: 0 };
    const slot = document.createElement("div");
    slot.id = `slot-${player.id}`;
    grid.appendChild(slot);
    renderSlot(player);
  });
}

function renderSlot(player) {
  const item = inventory[player.id];
  const slot = document.getElementById(`slot-${player.id}`);
  if (!slot) return;

  if (item.count > 0) {
    // 1. Определяем класс редкости для коллекции
    let rarityClass = "card-bronze";

    // Сначала проверяем, Икона ли это (чтобы дать ИМБА-фон)
    if (player.league === "Icon" || player.league === "Legend") {
      rarityClass = "card-icon-style";
    }
    // Если не Икона, то смотрим на рейтинг
    else if (player.raiting >= 90) {
      rarityClass = "card-legend"; // Фиолетовый Walkout
    } else if (player.raiting >= 85) {
      rarityClass = "card-elite"; // Синяя элита
    } else if (player.raiting >= 75) {
      rarityClass = "card-gold";
    } else if (player.raiting >= 65) {
      rarityClass = "card-silver";
    } else {
      rarityClass = "card-bronze";
    }

    // 2. Присваиваем класс карточке
    slot.className = `mini-card ${rarityClass}`;

    slot.innerHTML = `
      <span class="mini-card-rating">${player.raiting}</span>
      ${item.count > 1 ? `<span class="mini-card-count">x${item.count}</span>` : ""}
      <img class="mini-card-photo" src="${player.photo}">
      <span class="mini-card-name">${player.name}</span>
      <button class="mini-card-sell-btn" onclick="sellFromCollection('${player.id}')">Продать (+${player.price}$)</button>
    `;
  } else {
    slot.className = "mini-card slot-locked";
    slot.innerHTML = `<div class="mini-placeholder-icon">🔒</div><div class="mini-placeholder-text">Не открыт</div>`;
  }
}

window.sellFromCollection = function (playerId) {
  const player = players.find((p) => p.id === playerId);
  if (!player || !inventory[playerId] || inventory[playerId].count <= 0) return;
  if (inventory[playerId].count === 1) {
    for (const pos in squad) {
      if (squad[pos] === playerId) squad[pos] = null;
    }
    renderSquad();
  }
  inventory[playerId].count--;
  coins += player.price;
  renderSlot(player);
  saveState();
  updateUI();
  renderSquadPicker();
  checkBankruptcy();
};

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    initSlots();
  });
});

function renderQuests() {
  const list = document.getElementById("quests-list");
  list.innerHTML = "";
  questDefinitions.forEach((q) => {
    const isCompleted = completedQuests.includes(q.id);
    let progress = 0;
    if (q.type === "packs") progress = totalOpened;
    if (q.type === "elite_streak") progress = eliteStreak;
    if (q.type === "unique_players")
      progress = players.filter((p) => inventory[p.id]?.count > 0).length;
    if (q.type === "madrid")
      progress = players
        .filter((p) => p.club === "Real Madrid")
        .reduce((sum, p) => sum + (inventory[p.id]?.count || 0), 0);
    if (q.type === "stars")
      progress = players
        .filter((p) => p.raiting >= 90)
        .reduce((sum, p) => sum + (inventory[p.id]?.count || 0), 0);
    if (q.type === "coins") progress = coins;

    const canClaim = !isCompleted && progress >= q.target;
    const div = document.createElement("div");
    div.className = "quest-item";
    div.innerHTML = `
      <div class="quest-info">
        <h4>${q.title}</h4>
        <p>${q.desc} (${Math.min(progress, q.target)}/${q.target})</p>
        <div style="color: #34d399; font-weight: bold; font-size: 12px;">+${q.reward}$</div>
      </div>
      <button class="claim-btn" ${canClaim ? "" : "disabled"} onclick="claimQuest('${q.id}', ${q.reward})">
        ${isCompleted ? "Получено" : "Забрать"}
      </button>
    `;
    list.appendChild(div);
  });
}

window.claimQuest = function (id, reward) {
  completedQuests.push(id);
  coins += reward;
  saveState();
  updateUI();
  renderQuests();
};

function renderLeaderboard() {
  const list = document.getElementById("leaderboard-list");
  list.innerHTML = "";
  leaderboard.forEach((item, index) => {
    list.innerHTML += `<div class="leader-row"><span class="leader-rank">#${index + 1}</span><span style="flex:1; color:#fff;">${item.name}</span><span style="color:#38bdf8; font-weight:bold;">${item.score} паков</span></div>`;
  });
}

window.removeFromSquad = function (event, pos) {
  event.stopPropagation();
  squad[pos] = null;
  saveState();
  renderSquad();
  renderSquadPicker();
};

function renderSquad() {
  playSound("click");
  let squadPlayers = []; // Массив для сбора всех игроков на поле

  Object.keys(squad).forEach((pos) => {
    const slotEl = document.getElementById(`slot-${pos}`);
    if (!slotEl) return;
    const p = players.find((x) => x.id === squad[pos]);

    if (selectedPitchPos === pos) slotEl.classList.add("active-slot");
    else slotEl.classList.remove("active-slot");

    if (p) {
      slotEl.classList.add("occupied");
      slotEl.innerHTML = `<div style="font-size:8px;">${pos}</div><div>${getShortName(p.name)}</div><div>${p.raiting}</div><button class="slot-remove-btn" onclick="removeFromSquad(event, '${pos}')">✕</button>`;

      squadPlayers.push(p); // Добавляем игрока в массив для умного подсчета
    } else {
      slotEl.classList.remove("occupied");
      slotEl.innerHTML = pos;
    }

    slotEl.onclick = () => {
      selectedPitchPos = pos;
      document.getElementById("selected-pos-label").textContent =
        `Выбираем: ${pos}`;
      renderSquad();
      renderSquadPicker();
    };
  });

  // --- НОВЫЙ УМНЫЙ ПОДСЧЕТ РЕЙТИНГА (Как в FIFA) ---
  let finalOVR = 0;
  if (squadPlayers.length > 0) {
    // 1. Базовое среднее
    let sum = squadPlayers.reduce((acc, player) => acc + player.raiting, 0);
    let baseAvg = Math.floor(sum / squadPlayers.length);

    // 2. Считаем бонус от звездных игроков (кто выше среднего)
    let starBonus = 0;
    squadPlayers.forEach((player) => {
      if (player.raiting > baseAvg) {
        starBonus += player.raiting - baseAvg;
      }
    });

    // 3. Итоговый рейтинг с бонусом (делим на 8, чтобы бонус был ощутимым)
    finalOVR = baseAvg + Math.round(starBonus / 8);
    finalOVR = Math.min(finalOVR, 99); // Максимум 99
  }

  // Обновляем цифру на экране
  document.getElementById("squad-ovr").textContent = finalOVR;
}

function renderSquadPicker() {
  const el = document.getElementById("squad-inventory");
  el.innerHTML = "";
  const occupied = Object.values(squad).filter(Boolean);
  const avail = players.filter(
    (p) => inventory[p.id]?.count > 0 && !occupied.includes(p.id),
  );

  avail.forEach((p) => {
    const div = document.createElement("div");
    div.className = "squad-picker-card";
    div.innerHTML = `<b>${getShortName(p.name)}</b> (${p.raiting})<br><small>${p.pos}</small>`;
    div.onclick = () => {
      if (!selectedPitchPos) {
        // Используем красивый тост вместо старого alert
        showToast("Сначала нажми на позицию на поле!", "error");
        return;
      }
      squad[selectedPitchPos] = p.id;
      selectedPitchPos = null;
      document.getElementById("selected-pos-label").textContent = "Нажми на позицию";
      saveState();
      renderSquad();
      renderSquadPicker();
    };
    el.appendChild(div);
  });
}

function renderMarket() {
  const grid = document.getElementById("market-grid");
  grid.innerHTML = "";

  players
    // Фильтруем сразу всю лигу Икон (Пеле, Марадона, Роналдиньо и будущие)
    .filter((p) => p.league !== "Icon" && p.league !== "Legend")
    .forEach((p) => {
      const cost = p.price * 5;

      // Определяем правильный класс для фона
      let rarityClass = "card-bronze";
      if (p.raiting >= 90) {
        rarityClass = "card-legend"; // Фиолетовые
      } else if (p.raiting >= 85) {
        rarityClass = "card-elite"; // Синие
      } else if (p.raiting >= 75) {
        rarityClass = "card-gold"; // Золотые
      } else if (p.raiting >= 65) {
        rarityClass = "card-silver"; // Серебро
      }

      const div = document.createElement("div");
      div.className = `mini-card ${rarityClass}`;

      div.innerHTML = `
      <span class="mini-card-rating">${p.raiting}</span>
      <img class="mini-card-photo" src="${p.photo}">
      <span class="mini-card-name">${p.name}</span>
      <button id="buy-btn-${p.id}" class="market-buy-btn" ${coins < cost ? "disabled" : ""} onclick="buyMarket('${p.id}', ${cost})">Купить ${cost}$</button>
    `;
      grid.appendChild(div);
    });
}

window.buyMarket = function (id, cost) {
  if (coins < cost) return alert("Недостаточно денег!");

  coins -= cost;
  if (!inventory[id]) inventory[id] = { count: 0 };
  inventory[id].count++;

  saveState();
  updateUI();

  players
    // Здесь тоже используем фильтрацию по лиге, чтобы избежать ошибок
    .filter((p) => p.league !== "Icon" && p.league !== "Legend")
    .forEach((p) => {
      const btn = document.getElementById(`buy-btn-${p.id}`);
      if (btn) {
        btn.disabled = coins < p.price * 5;
      }
    });
};

function renderSBC() {
  const container = document.getElementById("sbc-slots");
  container.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const slot = document.createElement("div");
    slot.className = "sbc-slot";
    const pId = sbcBurnList[i];
    if (pId) {
      const p = players.find((x) => x.id === pId);
      slot.classList.add("filled");
      slot.innerHTML = `
        <img src="${p.photo}" style="width: 55px; height: 55px; object-fit: contain; margin-bottom: 5px;">
        <div style="font-size: 18px; font-weight: 900; color: #fff;">${p.raiting}</div>
      `;
      slot.onclick = () => {
        sbcBurnList.splice(i, 1);
        renderSBC();
        renderSBCPicker();
      };
    } else {
      slot.innerHTML = "+";
    }
    container.appendChild(slot);
  }
  document.getElementById("sbc-submit-btn").disabled = sbcBurnList.length < 3;
}

function renderSBCPicker() {
  const el = document.getElementById("sbc-inventory");
  el.innerHTML = "";
  const avail = players.filter(
    (p) =>
      inventory[p.id]?.count > 0 &&
      !sbcBurnList.includes(p.id) &&
      p.id !== "pele" &&
      p.id !== "maradona",
  );
  avail.forEach((p) => {
    const div = document.createElement("div");
    div.className = "squad-picker-card";
    div.innerHTML = `<b>${getShortName(p.name)}</b> (${p.raiting})`;
    div.onclick = () => {
      if (sbcBurnList.length < 3) {
        sbcBurnList.push(p.id);
        renderSBC();
        renderSBCPicker();
      }
    };
    el.appendChild(div);
  });
}

document.getElementById("sbc-submit-btn").onclick = () => {
  // Находим трех игроков, которых игрок положил в слоты сжигания
  const burnedPlayers = sbcBurnList
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean);

  // Если вдруг в слотах меньше 3 игроков, прерываемся
  if (burnedPlayers.length < 3) return;

  // Считаем средний рейтинг сдаваемых игроков
  const avgRating = Math.round(
    burnedPlayers.reduce((sum, p) => sum + p.raiting, 0) / burnedPlayers.length,
  );

  // Сжигаем карточки
  sbcBurnList.forEach((id) => {
    inventory[id].count--;
  });
  sbcBurnList = [];
  document.getElementById("sbc-modal").style.display = "none";
  saveState();
  updateUI();

  const rand = Math.random();
  let reward;

  // Маленький шанс на легенд (сохраняем твою ультра-редкую механику)
  if (rand < 0.005) {
    reward = players.find((p) => p.id === "maradona");
  } else if (rand < 0.015) {
    reward = players.find((p) => p.id === "pele");
  } else {
    // В зависимости от среднего рейтинга (avgRating) формируем пул наград:
    let minRewardRating = avgRating + 1; // Награда гарантированно выше среднего на 1 и более

    if (avgRating >= 90) {
      minRewardRating = 91; // Если сдали топ, то награда будет от 91+
    }

    // Ищем всех игроков, чей рейтинг подходит под новую планку
    let eligiblePlayers = players.filter(
      (p) =>
        p.raiting >= minRewardRating && p.id !== "maradona" && p.id !== "pele",
    );

    // Если таких не нашлось (например, уперлись в потолок), берем просто топ-игроков
    if (eligiblePlayers.length === 0) {
      eligiblePlayers = players.filter(
        (p) => p.raiting >= 88 && p.id !== "maradona" && p.id !== "pele",
      );
    }

    reward =
      eligiblePlayers[Math.floor(Math.random() * eligiblePlayers.length)];

    if (!reward) reward = players.find((p) => p.id === "mbappe") || players[0];
  }

  revealCard(reward, true);
};

const btn = document.getElementById("btn");
const pack = document.getElementById("pack");
const card = document.getElementById("card");
const sellBtn = document.getElementById("sell-btn");

sellBtn.addEventListener("click", () => {
  playSound("click");
});

document.querySelectorAll(".pack-tab").forEach((tab) => {
  tab.onclick = () => {
    document
      .querySelectorAll(".pack-tab")
      .forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentPackType = tab.dataset.pack;
    document.getElementById("pack").className =
      currentPackType === "elite" ? "pack-box elite-pack" : "pack-box";
    document.getElementById("pack-icon").textContent =
      currentPackType === "elite" ? "⭐" : "📦";
    document.getElementById("pack-name").textContent =
      currentPackType === "elite" ? "Элитный пак" : "Обычный пак";
    updateUI();
  };
});

btn.onclick = () => {
  playSound("click");
  if (coins < packTypes[currentPackType].cost) return;

  if (currentPackType === "elite") {
    eliteStreak++;
  } else {
    eliteStreak = 0;
  }

  coins -= packTypes[currentPackType].cost;
  updateUI();
  saveState();

  btn.disabled = true;
  sellBtn.style.display = "none";
  card.style.display = "none";
  pack.style.display = "flex";
  pack.classList.add("shake");

  setTimeout(() => {
    pack.classList.remove("shake");
    let rand =
      Math.random() *
      Object.values(packTypes[currentPackType].weights).reduce(
        (a, b) => a + b,
        0,
      );
    let dropped = players[0];
    for (const [id, w] of Object.entries(packTypes[currentPackType].weights)) {
      if (rand < w) {
        dropped = players.find((p) => p.id === id);
        break;
      }
      rand -= w;
    }
    revealCard(dropped, dropped.raiting >= 90 || dropped.league === "Icon");
  }, 900);
};

function revealCard(player, isWalkout) {
  pack.style.display = "none";
  lastDroppedPlayer = player;

  const finishReveal = () => {
    // 1. Определяем класс редкости по рейтингу и лиге
    let rarityClass = "card-bronze";

    if (player.league === "Icon" || player.raiting >= 90) {
      rarityClass = "card-legend"; // 90+ Фиолетовый
    } else if (player.raiting >= 86) {
      rarityClass = "card-elite"; // 86-89 Синий
    } else if (player.raiting >= 75) {
      rarityClass = "card-gold";
    } else if (player.raiting >= 65) {
      rarityClass = "card-silver";
    }

    // 2. Применяем класс к карточке
    card.className = `card card-popup ${rarityClass}`;

    // Вставляем данные игрока
    card.innerHTML = `
  <div class="card-top">
    <div class="card-rating">${player.raiting}</div>
  </div>
  <img class="card-photo" src="${player.photo}">
  <div class="card-bottom">
    <div class="card-name">${player.name}</div>
    <div class="card-details">
      <span class="card-pos-badge">${player.pos}</span>
      <span class="card-club-text">${player.club}</span>
    </div>
  </div>
`;
    card.style.display = "flex";

    totalOpened++;
    if (!inventory[player.id]) inventory[player.id] = { count: 0 };
    inventory[player.id].count++;

    sellBtn.textContent = `Продать (+${player.price}$)`;
    sellBtn.style.display = "inline-block";

    saveState();
    updateUI();
    checkBankruptcy();
  };

  if (isWalkout) {
    document.getElementById("walkout-overlay").style.display = "flex";
    setTimeout(() => {
      document.getElementById("walkout-overlay").style.display = "none";
      finishReveal();
    }, 1100);
  } else {
    finishReveal();
  }
}

sellBtn.onclick = () => {
  if (!lastDroppedPlayer || inventory[lastDroppedPlayer.id].count <= 0) return;
  inventory[lastDroppedPlayer.id].count--;
  coins += lastDroppedPlayer.price;
  saveState();
  updateUI();
  sellBtn.style.display = "none";
  card.style.display = "none";
  pack.style.display = "flex";
  checkBankruptcy();
};

// --- ПРИВЯЗКА КНОПОК И МОДАЛОК (ГЛАВНЫЙ ИСПРАВЛЕННЫЙ БЛОК) ---

// Находим все кнопки фильтров и вешаем на них клик и звук

// const closeBtn = document.getElementById('close-btn')

// closeBtn.addEventListener('click', () => {
//         playSound('click')

// })

// const closeBtn = document.getElementById('close-btn')

// closeBtn.addEventListener('click', () => {
//         playSound('click')

// })

// 1. Открытие коллекции
document.getElementById("open-collection-btn").onclick = () => {
  initSlots();
  document.getElementById("collection-modal").style.display = "flex";
};

// 2. Кнопки фильтров (живут отдельно!)
document.querySelectorAll(".filter-btn").forEach((button) => {
  button.onclick = () => {
    // document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    // button.classList.add("active");
    // let filterValue = button.dataset.filter;
    // ... логика сортировки коллекции ...
  };
});

document.getElementById("open-quests-btn").onclick = () => {
  renderQuests();
  document.getElementById("quests-modal").style.display = "flex";
};

document.getElementById("open-leaderboard-btn").onclick = () => {
  renderLeaderboard();
  document.getElementById("leaderboard-modal").style.display = "flex";
};

document.getElementById("open-squad-btn").onclick = () => {
  // playSound('click')
  renderSquad();
  renderSquadPicker();
  document.getElementById("squad-modal").style.display = "flex";
};

document.getElementById("open-market-btn").onclick = () => {
  renderMarket();
  document.getElementById("market-modal").style.display = "flex";
};

document.getElementById("open-sbc-btn").onclick = () => {
  sbcBurnList = [];
  renderSBC();
  renderSBCPicker();
  document.getElementById("sbc-modal").style.display = "flex";
};

// Функция скачивания Топа из облака
async function loadLeaderboard(sortBy = "totalOpened") {
  const list = document.getElementById("leaderboard-list");
  list.innerHTML =
    '<div style="text-align:center; padding:20px;">Загрузка... ⏳</div>';

  try {
    // Берем топ 10 игроков, сортируя по убыванию
    const q = query(
      collection(db, "users"),
      orderBy(sortBy, "desc"),
      limit(10),
    );
    const querySnapshot = await getDocs(q);

    list.innerHTML = "";
    let rank = 1;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const score =
        sortBy === "totalOpened" ? data.totalOpened || 0 : data.cups || 0;
      const icon = sortBy === "totalOpened" ? "📦" : "🏆";

      list.innerHTML += `
        <div style="display: flex; justify-content: space-between; background: #0f172a; padding: 12px; margin-bottom: 8px; border-radius: 8px; border: 1px solid #334155;">
          <span style="color: #fff;"><b>#${rank}</b> ${data.nickname || "Аноним"}</span>
          <span style="color: #38bdf8; font-weight: bold;">${score} ${icon}</span>
        </div>
      `;
      rank++;
    });
  } catch (error) {
    console.error("Ошибка загрузки топа:", error);
    list.innerHTML =
      '<div style="color:#ef4444; text-align:center;">Ошибка сервера ❌</div>';
  }
}

// Открытие окна и переключение вкладок
document.getElementById("open-leaderboard-btn").onclick = () => {
  document.getElementById("leaderboard-modal").style.display = "flex";
  loadLeaderboard("totalOpened"); // По умолчанию грузим паки
};

document.getElementById("tab-packs").onclick = (e) => {
  document
    .querySelectorAll(".pack-tab")
    .forEach((b) => b.classList.remove("active"));
  e.target.classList.add("active");
  loadLeaderboard("totalOpened");
};

document.getElementById("tab-cups").onclick = (e) => {
  document
    .querySelectorAll(".pack-tab")
    .forEach((b) => b.classList.remove("active"));
  e.target.classList.add("active");
  loadLeaderboard("cups");
};

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.onclick = () =>
    (document.getElementById(btn.dataset.close).style.display = "none");
});

document.getElementById("save-score-btn").onclick = () => {
  // playSound('click')
  leaderboard.push({
    // Берем никнейм прямо из верхней панели (где мы его вывели при авторизации через Firebase)
    name: document.getElementById("top-nickname")?.textContent || "Игрок",
    score: totalOpened,
  });
  leaderboard.sort((a, b) => b.score - a.score);
  localStorage.setItem(
    "cards_leaderboard",
    JSON.stringify(leaderboard.slice(0, 10)),
  );
  localStorage.clear();
  location.reload();
};

const resetModal = document.getElementById("reset-modal");
document.getElementById("reset-btn").onclick = () => {
  resetModal.style.display = "flex";
  // playSound('click')
};
document.getElementById("cancel-reset-btn").onclick = () => {
  resetModal.style.display = "none";
  // playSound('click')
};
resetModal.onclick = (e) => {
  if (e.target === resetModal) resetModal.style.display = "none";
};

// Универсальная функция сброса прогресса (и локально, и в облаке)
async function resetAllProgress() {
  const user = auth.currentUser;

  if (user) {
    try {
      console.log("Удаляем данные из облака Firestore...");

      await setDoc(doc(db, "users", user.uid), {
        coins: 1000, // Твой стартовый капитал
        totalOpened: 0,
        eliteStreak: 0,
        inventory: {},
        squad: {
          LW: null,
          ST: null,
          RW: null,
          LCM: null,
          CM: null,
          RCM: null,
          LB: null,
          LCB: null,
          RCB: null,
          RB: null,
          GK: null,
        },
        completedQuests: [],
        userClub: { name: "Real Madrid", icon: "👑" },
      });

      clearLocalData(); // Вызываем очистку
    } catch (error) {
      console.error("❌ Ошибка при сбросе в Firestore:", error);
      alert("Ошибка при сбросе! Посмотри консоль.");
    }
  } else {
    clearLocalData();
  }
}

// Вспомогательная функция, чтобы не писать удаление по сто раз
function clearLocalData() {
  localStorage.removeItem("cards_coins");
  localStorage.removeItem("cards_totalOpened");
  localStorage.removeItem("cards_eliteStreak");
  localStorage.removeItem("cards_inventory");
  localStorage.removeItem("cards_squad");
  localStorage.removeItem("cards_completed_quests");
  localStorage.removeItem("cards_last_bonus");
  location.reload();
  document.getElementById("save-score-btn").onclick = resetAllProgress;
}

const confirmResetBtn = document.getElementById("confirm-reset-btn");
if (confirmResetBtn) {
  confirmResetBtn.onclick = () => {
    // playSound('click');   // Сначала воспроизводим звук
    resetAllProgress(); // Затем запускаем сам сброс прогресса
  };
}
// 1. Привязываем к кнопке в модалке (которую мы уже чинили):
// 2. Привязываем к кнопке банкротства

// --- АДМИНКА И КНОПКИ БАЗЫ ---

document.getElementById("admin-submit-btn").onclick = async () => {
  const weightStandard =
    parseFloat(document.getElementById("admin-weight-standard").value) || 0;
  const weightElite =
    parseFloat(document.getElementById("admin-weight-elite").value) || 0;
  const name = document.getElementById("admin-name").value;
  const raiting = parseInt(document.getElementById("admin-raiting").value);
  const club = document.getElementById("admin-club").value;
  const league = document.getElementById("admin-league").value;
  const pos = document.getElementById("admin-pos").value;
  const price = parseInt(document.getElementById("admin-price").value);
  const photo = document.getElementById("admin-photo").value;

  if (!name || !raiting || !photo) {
    return alert("Заполни как минимум Имя, Рейтинг и Фото!");
  }

  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "");

  try {
    const { setDoc, doc } =
      await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
    await setDoc(doc(db, "players", id), {
      id,
      name,
      raiting,
      club,
      league,
      pos,
      price,
      photo,
      weightStandard,
      weightElite,
    });
    alert("✅ Карточка успешно отправлена в общую базу данных!");
    document.getElementById("admin-modal").style.display = "none";
    document
      .querySelectorAll("#admin-modal input")
      .forEach((input) => (input.value = ""));
  } catch (error) {
    console.error("Ошибка:", error);
    alert("❌ Произошла ошибка. Проверь консоль браузера.");
  }
};

document.getElementById("admin-delete-btn").onclick = async () => {
  const nameInput = document.getElementById("admin-delete-name").value;
  if (!nameInput) return alert("Введи имя карточки, которую хочешь удалить!");

  const idToDelete = nameInput.toLowerCase().replace(/[^a-z0-9]/g, "");

  if (
    confirm(
      `Ты уверен, что хочешь удалить игрока "${nameInput}" из глобальной базы?`,
    )
  ) {
    try {
      const { deleteDoc, doc } =
        await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js");
      await deleteDoc(doc(db, "players", idToDelete));
      alert("🗑️ Карточка успешно удалена из базы!");
      document.getElementById("admin-delete-name").value = "";
      location.reload();
    } catch (error) {
      console.error("Ошибка при удалении:", error);
      alert("❌ Произошла ошибка. Карточка не удалена.");
    }
  }
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("admin-login-section").style.display = "none";
    document.getElementById("admin-dashboard-section").style.display = "flex";
  } else {
    document.getElementById("admin-login-section").style.display = "flex";
    document.getElementById("admin-dashboard-section").style.display = "none";
  }
});

document.getElementById("admin-login-btn").onclick = async () => {
  const email = document.getElementById("admin-email").value;
  const pass = document.getElementById("admin-password").value;

  if (!email || !pass) return alert("Введи почту и пароль!");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    alert("✅ Успешный вход! Права администратора получены.");
  } catch (error) {
    console.error("Ошибка входа:", error);
    alert("❌ Неверный логин или пароль!");
  }
};

document.getElementById("admin-logout-btn").onclick = async () => {
  await signOut(auth);
  alert("🚪 Вы вышли из аккаунта.");
};

// --- ЧИТ-КОДЫ И 5 КЛИКОВ ---
let secretPackClicks = 0;
let secretPackTimer = null;
const packIconEl = document.getElementById("pack");

packIconEl.addEventListener("click", () => {
  secretPackClicks++;

  if (secretPackClicks >= 5) {
    const cheatCode = prompt("Секретная консоль. Введи чит-код:");

    if (cheatCode === "zrtash sila") {
      coins += 10000;
      players.forEach((p) => {
        if (!inventory[p.id]) inventory[p.id] = { count: 0 };
        inventory[p.id].count++;
      });
      alert(
        "🔥 Чит-код принят: +10,000 монет и полная коллекция карточек разблокирована!",
      );
    } else if (cheatCode === "pele") {
      if (!inventory["pele"]) inventory["pele"] = { count: 0 };
      inventory["pele"].count++;
      alert("👑 Чит-код принят: Эксклюзивный Пеле добавлен в коллекцию!");
    } else if (cheatCode === "5g4car3ar") {
      document.getElementById("admin-modal").style.display = "flex";
    } else if (cheatCode !== null) {
      alert("❌ Неверный код!");
    }

    saveState();
    updateUI();
    secretPackClicks = 0;
  }

  clearTimeout(secretPackTimer);
  secretPackTimer = setTimeout(() => (secretPackClicks = 0), 2000);
});

// --- ЛОГИКА АВТОРИЗАЦИИ ИГРОКОВ (ВЕРСИЯ 1.5) ---

const authModal = document.getElementById("auth-modal");
const authBtn = document.getElementById("auth-login-btn");

authBtn.onclick = async () => {
  // playSound('click');
  const nickname = document
    .getElementById("auth-nickname")
    .value.trim()
    .toLowerCase();
  const pass = document.getElementById("auth-password").value;

  if (nickname.length < 3 || pass.length < 6) {
    showToast("Никнейм от 3 символов, пароль от 6!", "error");
    return;
  }

  const email = `${nickname}@fbcards.game`;
  authBtn.textContent = "Загрузка...";

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast(`С возвращением, ${nickname}!`);
  } catch (error) {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      showToast(`Добро пожаловать, ${nickname}! Аккаунт создан.`);
    } catch (regError) {
      console.error(regError);
      showToast("❌ Ошибка! Ник занят или пароль не подходит.", "error");
    }
  }
  authBtn.textContent = "Войти / Зарегистрироваться";
};

// Следим за тем, вошел игрок или нет
// Следим за входом и ЗАГРУЖАЕМ сохранения из облака
// Следим за входом и УМНО ЗАГРУЖАЕМ сохранения из облака
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUserUid = user.uid; // Запоминаем ID игрока
    authModal.style.display = "none";

    const nickname = user.email.split("@")[0];
    document.getElementById("top-nickname").textContent = nickname;
    document.getElementById("profile-nickname-display").textContent = nickname;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${nickname}`;
    document.getElementById("top-avatar").src = avatarUrl;
    document.getElementById("profile-avatar-preview").src = avatarUrl;
    // Стандартные аватарки (я добавил пару вариаций твоей текущей из Dicebear)
    const defaultAvatars = [
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
      "https://cdn-icons-png.flaticon.com/512/147/147144.png",
      "https://api.dicebear.com/7.x/adventurer/svg?seed=128",
    ];

    // Загружаем сохраненный аватар
    let userAvatar =
      localStorage.getItem("footpacks_avatar") || defaultAvatars[0];

    // Функция применения картинки к элементам
    // Функция применения картинки к элементам
    function updateAvatarDisplay(url) {
      const profilePreview = document.getElementById("profile-avatar-preview");
      if (profilePreview) profilePreview.src = url;

      // Меняем "header-avatar" на правильный ID — "top-avatar"
      const topAvatar = document.getElementById("top-avatar");
      if (topAvatar) topAvatar.src = url;
    }

    // Применяем сразу при загрузке страницы
    updateAvatarDisplay(userAvatar);

    function renderAvatarPresets() {
      const container = document.getElementById("avatar-presets");
      if (!container) return;
      container.innerHTML = "";

      defaultAvatars.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.className = `preset-img ${url === userAvatar ? "active" : ""}`;
        img.onclick = () => setAvatar(url);
        container.appendChild(img);
      });
    }

    function setAvatar(url) {
      userAvatar = url;
      localStorage.setItem("footpacks_avatar", url);
      updateAvatarDisplay(url);
      renderAvatarPresets(); // Обновляем рамку активного выбора
    }

    window.saveCustomAvatar = function () {
      const input = document.getElementById("custom-avatar-input");
      const url = input.value.trim();
      if (url) {
        setAvatar(url);
        input.value = "";
        showToast("Аватар успешно изменен!");
      } else {
        showToast("Вставьте ссылку на картинку!", "error");
      }
    };

    // Отрисовываем сетку картинок в профиле
    renderAvatarPresets();

    // Скачиваем сохранение из базы данных
    try {
      const userDoc = await getDoc(doc(db, "users", currentUserUid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        userClub = data.userClub || { name: "Real Madrid", icon: "👑" };
        document.getElementById("club-name-display").textContent =
          userClub.name;
        const badgeImg = document.getElementById("club-badge-img");
        if (badgeImg && userClub.img) {
          badgeImg.src = userClub.img;
        }

        const cloudCoins = data.coins !== undefined ? data.coins : 1000;
        const cloudTotalOpened = data.totalOpened || 0;

        // 🔥 УМНАЯ ПРОВЕРКА: Если локальных монет или паков больше, заливаем их в облако!
        if (coins > cloudCoins || totalOpened > cloudTotalOpened) {
          console.log("⬆️ Локальный прогресс круче, отправляем его в облако!");
          await saveState();
        } else {
          // Если в облаке прогресс больше (зашли с нового устройства), скачиваем его
          coins = cloudCoins;
          totalOpened = cloudTotalOpened;
          eliteStreak = data.eliteStreak || 0;
          inventory = data.inventory || {};
          squad = data.squad || {
            LW: null,
            ST: null,
            RW: null,
            LCM: null,
            CM: null,
            RCM: null,
            LB: null,
            LCB: null,
            RCB: null,
            RB: null,
            GK: null,
          };
          completedQuests = data.completedQuests || [];

          // Сохраняем скачанное локально, чтобы браузер запомнил
          saveState();
          console.log("☁️ Облачное сохранение успешно загружено!");
        }
      } else {
        // Если это абсолютно новый игрок в базе, заливаем ему текущий прогресс
        await saveState();
      }
    } catch (error) {
      console.error("❌ Ошибка загрузки сохранения:", error);
    }

    updateUI();
    renderSquad(); // Отрисовываем скачанный состав
  } else {
    currentUserUid = null;
    authModal.style.display = "flex";
  }
});

// --- ЛОГИКА ПРОФИЛЯ ---

// 1. Открытие кабинета (профиля)
document.getElementById("open-profile-btn").onclick = () => {
  document.getElementById("profile-modal").style.display = "flex";

  // Обновляем статистику
  document.getElementById("profile-total-packs").textContent = totalOpened;
  document.getElementById("profile-total-coins").textContent = coins;

  // Звук клика
  // playSound('click');
};

// 2. Закрытие кабинета (профиля)
// ВАЖНО: Убедись, что в HTML у крестика/кнопки закрытия стоит id="close-profile-btn"
const closeProfileBtn = document.getElementById("close-btnn");
if (closeProfileBtn) {
  closeProfileBtn.onclick = () => {
    document.getElementById("profile-modal").style.display = "none";
    // playSound('click');
  };
} else {
  console.log("⚠️ Кнопка закрытия профиля не найдена, проверь HTML!");
}

// Кнопка Выхода из аккаунта
document.getElementById("logout-btn").onclick = async () => {
  await signOut(auth);
  document.getElementById("profile-modal").style.display = "none";
  location.reload(); // Перезагружаем страницу, чтобы всё сбросилось
  // playSound('click')
};

// Открытие модалки выбора клуба
document.getElementById("open-club-picker").onclick = () => {
  document.getElementById("club-modal").style.display = "flex";
};

// Выбор конкретного клуба из списка
document.querySelectorAll(".club-option-btn").forEach((btn) => {
  btn.onclick = (e) => {
    const clubName = btn.getAttribute("data-club");
    const clubImg = btn.getAttribute("data-img");

    userClub = { name: clubName, img: clubImg };

    // Меняем название и картинку в шапке состава
    document.getElementById("club-name-display").textContent = clubName;
    document.getElementById("club-badge-img").src = clubImg;

    // Закрываем модалку
    document.getElementById("club-modal").style.display = "none";

    // Сохраняем в облако
    saveState();
  };
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.onclick = (e) => {
    // Убираем активный класс у всех и ставим на нажатую
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    e.target.classList.add("active");

    const filter = e.target.getAttribute("data-filter");
    const sort = e.target.getAttribute("data-sort");

    if (filter) {
      activeFilter = filter;
      currentSort = null; // Сбрасываем сортировку при выборе лиги/позиции
    } else if (sort) {
      currentSort = sort; // 'desc' или 'asc'
    }

    initSlots();
  };
});

// Открытие и закрытие плавающего окна техподдержки
window.toggleSupportWindow = function() {
  const win = document.getElementById("support-float-window");
  win.style.display = (win.style.display === "none" || win.style.display === "") ? "block" : "none";
};

// Отправка сообщения в Firebase
window.sendSupportMessage = async function() {
  const textInput = document.getElementById("support-text");
  const message = textInput.value.trim();

  if (!message) {
    showToast("Напишите хоть что-нибудь!", "error");
    return;
  }

  // Получаем никнейм игрока
  const nicknameEl = document.getElementById("top-nickname");
  const nickname = nicknameEl ? nicknameEl.textContent : "Игрок";

  // Твои данные Telegram бота
  const BOT_TOKEN = "8710200554:AAFMB7FZesjyFjTb4iEnCtk0Jw7SghSEOms";
  const CHAT_ID = "1440765650";

  // Обычный текст без строгой разметки Markdown, чтобы избежать ошибок 400
  const text = `🚨 Новое сообщение в техподдержку!\n\n👤 От: ${nickname}\n💬 Текст: ${message}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: text
        // Убрали parse_mode, теперь отправка защищена от багов с символами
      })
    });

    if (response.ok) {
      showToast("Сообщение успешно отправлено разработчику!");
      textInput.value = ""; 
      toggleSupportWindow(); // Закрываем окошко
    } else {
      const errData = await response.json();
      console.error("Telegram error:", errData);
      throw new Error("Ошибка сервера Telegram");
    }

  } catch (error) {
    console.error("Ошибка при отправке в Telegram: ", error);
    showToast("Не удалось отправить сообщение. Попробуйте позже.", "error");
  }
};

updateUI();
