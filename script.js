import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
// 🔥 Исправили версию 10.12.2 на 12.19.0 вот в этой строке:
import {
  getFirestore,
  doc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getDoc,
  documentId,
  startAfter,
  runTransaction,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
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
const DEFAULT_CLUB = {
  name: "Real Madrid",
  img: "https://images.fotmob.com/image_resources/logo/teamlogo/8633_large.png",
};
// Отдельная коллекционная карточка: доступна только аккаунту с серверным admin claim.
// Не добавлять в players или packTypes, чтобы тренер не выпадал, не продавался и не попадал в ИПК.
const EXCLUSIVE_COACHES = Object.freeze([
  Object.freeze({
    id: "pep-guardiola",
    name: "Pep Guardiola",
    title: "Тактический архитектор",
    country: "Испания",
    initials: "PG",
    portrait: "./pep-guardiola.jpg",
    searchTerms: "пеп гвардиола испания",
  }),
  Object.freeze({
    id: "alex-ferguson",
    name: "Sir Alex Ferguson",
    title: "Легенда «Манчестер Юнайтед»",
    country: "Шотландия",
    initials: "AF",
    portrait: "https://img.championat.com/news/big/f/w/aleks-fergjuson-v-mju-biografija-fakty-nasledie_15651893661662200423.jpg",
    photoCreditUrl: "https://commons.wikimedia.org/wiki/File:Alex_Ferguson.jpg",
    searchTerms: "сэр алекс фергюсон алекс ферги шотландия",
  }),
]);
let userClub = { ...DEFAULT_CLUB };
let currentUserUid = null;
let authStateRevision = 0;
let cloudGameSaveQueue = Promise.resolve();
let cloudGameSaveRevision = 0;
let cloudSaveErrorNotifiedUid = null;
const cloudPendingSaves = new Map();
let cloudAcknowledgedRevision = 0;
let gameStateLastUpdated = 0;
let gameStateLastActionId = "";
let playersCatalogComplete = false;
let cloudPendingConflictOnLoad = false;
let currentSort = null;
let packOpenInProgress = false;
let userAvatarUrl = "";
let hasExclusiveCoach = false;

function getClientNickname(user) {
  return String(user?.displayName || user?.email?.split("@")[0] || "Игрок")
    .replace(/[\r\n<>]/g, " ")
    .trim()
    .slice(0, 40) || "Игрок";
}

function createEmptyCloudState(user) {
  return {
    coins: 1000,
    totalOpened: 0,
    bestTotalOpened: 0,
    eliteStreak: 0,
    cups: 0,
    inventory: {},
    squad: createEmptySquad(),
    completedQuests: [],
    claimedCollectionRewards: [],
    userClub: { ...DEFAULT_CLUB },
    avatarUrl: "",
    lastBonusTime: 0,
    dailyChallengeClaimedDate: "",
    nickname: getClientNickname(user),
    lastUpdated: Date.now(),
    lastActionId: "",
  };
}

function normalizeClientCloudState(raw, user) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const state = createEmptyCloudState(user);
  const safeInteger = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
  };

  state.coins = safeInteger(source.coins, 1000);
  state.totalOpened = safeInteger(source.totalOpened);
  state.bestTotalOpened = Math.max(state.totalOpened, safeInteger(source.bestTotalOpened));
  state.eliteStreak = safeInteger(source.eliteStreak);
  state.cups = safeInteger(source.cups);
  state.inventory = {};
  let inventoryEntries = 0;
  if (source.inventory && typeof source.inventory === "object" && !Array.isArray(source.inventory)) {
    for (const [id, item] of Object.entries(source.inventory)) {
      if (inventoryEntries >= 500) break;
      const count = safeInteger(item?.count);
      if (
        count > 0 &&
        id.length > 0 && id.length <= 100 &&
        !["__proto__", "constructor", "prototype"].includes(id)
      ) {
        state.inventory[id] = { count };
        inventoryEntries += 1;
      }
    }
  }
  state.squad = createEmptySquad();
  if (source.squad && typeof source.squad === "object" && !Array.isArray(source.squad)) {
    for (const position of Object.keys(state.squad)) {
      const playerId = source.squad[position];
      state.squad[position] =
        typeof playerId === "string" && playerId.length > 0 && playerId.length <= 100
          ? playerId
          : null;
    }
  }
  state.completedQuests = Array.isArray(source.completedQuests)
    ? [...new Set(source.completedQuests)].filter((id) => questDefinitions.some((quest) => quest.id === id))
    : [];
  state.claimedCollectionRewards = Array.isArray(source.claimedCollectionRewards)
    ? [...new Set(source.claimedCollectionRewards)].filter((id) => collectionRewardDefinitions.some((reward) => reward.id === id))
    : [];
  state.userClub = {
    name: typeof source.userClub?.name === "string" && source.userClub.name.trim()
      ? source.userClub.name.trim().slice(0, 60)
      : DEFAULT_CLUB.name,
    img: getSafeImageUrl(source.userClub?.img) || DEFAULT_CLUB.img,
  };
  state.avatarUrl = getSafeImageUrl(source.avatarUrl) || "";
  state.lastBonusTime = safeInteger(source.lastBonusTime);
  state.dailyChallengeClaimedDate = typeof source.dailyChallengeClaimedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(source.dailyChallengeClaimedDate)
    ? source.dailyChallengeClaimedDate
    : "";
  state.nickname = typeof source.nickname === "string" && source.nickname.trim()
    ? source.nickname.replace(/[\r\n<>]/g, " ").trim().slice(0, 40)
    : getClientNickname(user);
  state.lastUpdated = safeInteger(source.lastUpdated, 0);
  state.lastActionId = typeof source.lastActionId === "string"
    ? source.lastActionId.slice(0, 100)
    : "";
  return state;
}

function snapshotCurrentGameState(user = auth.currentUser) {
  return {
    coins,
    totalOpened,
    bestTotalOpened: Math.max(bestTotalOpened, totalOpened),
    eliteStreak,
    cups,
    inventory: { ...inventory },
    squad: { ...squad },
    completedQuests: [...completedQuests],
    claimedCollectionRewards: [...claimedCollectionRewards],
    userClub: { ...userClub },
    avatarUrl: userAvatarUrl,
    lastBonusTime,
    dailyChallengeClaimedDate,
    nickname: getClientNickname(user),
    lastUpdated: gameStateLastUpdated,
    lastActionId: gameStateLastActionId,
  };
}

function makeActionError(code, message) {
  const error = new Error(message);
  error.code = `functions/${code}`;
  throw error;
}

function applyClientGameAction(state, action, payload, user) {
  const playerById = new Map(players.map((player) => [player.id, player]));
  const result = {};
  const countOf = (id) => Number(state.inventory[id]?.count) || 0;
  const addCard = (id) => {
    state.inventory[id] = { count: countOf(id) + 1 };
  };
  const removeCard = (id) => {
    if (countOf(id) < 1) makeActionError("failed-precondition", "У тебя нет этой карточки.");
    if (countOf(id) === 1) {
      delete state.inventory[id];
      Object.keys(state.squad).forEach((position) => {
        if (state.squad[position] === id) state.squad[position] = null;
      });
    } else {
      state.inventory[id] = { count: countOf(id) - 1 };
    }
  };
  const squadPlayers = () => {
    const used = new Set();
    return Object.values(state.squad)
      .map((id) => playerById.get(id))
      .filter((player) => {
        if (!player || used.has(player.id) || countOf(player.id) < 1) return false;
        used.add(player.id);
        return true;
      });
  };
  const questProgress = (quest) => {
    if (quest.type === "packs") return state.totalOpened;
    if (quest.type === "elite_streak") return state.eliteStreak;
    if (quest.type === "unique_players") return players.filter((player) => countOf(player.id) > 0).length;
    if (quest.type === "madrid") return players.filter((player) => player.club === "Real Madrid").reduce((sum, player) => sum + countOf(player.id), 0);
    if (quest.type === "stars") return players.filter((player) => player.raiting >= 90).reduce((sum, player) => sum + countOf(player.id), 0);
    if (quest.type === "coins") return state.coins;
    return 0;
  };

  if (action === "openPack") {
    const pack = packTypes[payload.packType];
    if (!pack) makeActionError("invalid-argument", "Неизвестный тип пака.");
    if (state.coins < pack.cost) makeActionError("failed-precondition", "Недостаточно монет.");
    const weighted = players.map((player) => ({
      player,
      weight: Number(pack.weights[player.id] ?? (payload.packType === "elite" ? player.weightElite : player.weightStandard) ?? 0),
    })).filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0);
    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (!weighted.length || !Number.isFinite(totalWeight)) makeActionError("failed-precondition", "В этом паке пока нет доступных карточек.");
    let roll = Math.random() * totalWeight;
    let selected = weighted[weighted.length - 1].player;
    for (const entry of weighted) {
      if (roll < entry.weight) {
        selected = entry.player;
        break;
      }
      roll -= entry.weight;
    }
    state.coins -= pack.cost;
    state.totalOpened += 1;
    state.bestTotalOpened = Math.max(state.totalOpened, state.bestTotalOpened);
    state.eliteStreak = payload.packType === "elite" ? state.eliteStreak + 1 : 0;
    addCard(selected.id);
    result.player = selected;
  } else if (action === "sellCard") {
    const player = playerById.get(payload.playerId);
    if (!player) makeActionError("not-found", "Карточка больше недоступна.");
    removeCard(player.id);
    state.coins += player.price;
    result.coinsEarned = player.price;
  } else if (action === "adminAddCoins") {
    const amount = Number(payload.amount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
      makeActionError("invalid-argument", "Можно начислить от 1 до 1 000 000 монет за раз.");
    }
    if (!Number.isSafeInteger(state.coins + amount)) {
      makeActionError("failed-precondition", "Баланс станет слишком большим.");
    }
    state.coins += amount;
    result.coinsAdded = amount;
  } else if (action === "adminCollectAllPlayers") {
    let addedCount = 0;
    players.forEach((player) => {
      if (countOf(player.id) < 1) {
        addCard(player.id);
        addedCount += 1;
      }
    });
    result.playersAdded = addedCount;
    result.playersTotal = players.length;
  } else if (action === "buyMarket") {
    const player = playerById.get(payload.playerId);
    if (!player || ["Icon", "Legend"].includes(player.league)) makeActionError("failed-precondition", "Эту карточку нельзя купить на рынке.");
    const cost = player.price * 5;
    if (!Number.isSafeInteger(cost) || state.coins < cost) makeActionError("failed-precondition", "Недостаточно монет.");
    state.coins -= cost;
    addCard(player.id);
    result.coinsSpent = cost;
    result.player = player;
  } else if (action === "exchangeSbc") {
    const ids = payload.playerIds;
    if (!Array.isArray(ids) || ids.length !== 3 || new Set(ids).size !== 3) makeActionError("invalid-argument", "Для обмена выбери три разные карточки.");
    const burned = ids.map((id) => playerById.get(id));
    if (burned.some((player) => !player || ["Icon", "Legend"].includes(player.league))) makeActionError("failed-precondition", "Эту карточку нельзя использовать в обмене.");
    if (ids.some((id) => countOf(id) < 1)) makeActionError("failed-precondition", "У тебя нет одной из выбранных карточек.");
    const averageRating = Math.round(burned.reduce((sum, player) => sum + player.raiting, 0) / 3);
    ids.forEach(removeCard);
    const roll = Math.random();
    let reward = roll < 0.005 ? playerById.get("maradona") : roll < 0.015 ? playerById.get("pele") : null;
    if (!reward) {
      let eligible = players.filter((player) => player.raiting >= (averageRating >= 90 ? 91 : averageRating + 1) && !["Icon", "Legend"].includes(player.league));
      if (!eligible.length) eligible = players.filter((player) => player.raiting >= 88 && !["Icon", "Legend"].includes(player.league));
      if (eligible.length) reward = eligible[Math.floor(Math.random() * eligible.length)];
    }
    reward ||= playerById.get("mbappe") || players[0];
    if (!reward) makeActionError("failed-precondition", "В базе нет карточек для награды.");
    addCard(reward.id);
    result.player = reward;
    result.averageRating = averageRating;
  } else if (action === "claimQuest") {
    const quest = questDefinitions.find((item) => item.id === payload.questId);
    if (!quest) makeActionError("invalid-argument", "Такого задания нет.");
    if (state.completedQuests.includes(quest.id)) makeActionError("already-exists", "Награда за это задание уже получена.");
    if (questProgress(quest) < quest.target) makeActionError("failed-precondition", "Задание ещё не выполнено.");
    state.completedQuests.push(quest.id);
    state.coins += quest.reward;
    state.cups += 1;
    result.reward = quest.reward;
  } else if (action === "claimDailyChallenge") {
    const challenge = getTodayDailyChallenge();
    if (state.dailyChallengeClaimedDate === challenge.dateKey) makeActionError("already-exists", "Награда за задание дня уже получена.");
    if (challenge.getProgress(squadPlayers()) < challenge.target) makeActionError("failed-precondition", "Задание дня ещё не выполнено.");
    state.dailyChallengeClaimedDate = challenge.dateKey;
    state.coins += challenge.reward;
    state.cups += 1;
    result.reward = challenge.reward;
    result.challengeId = challenge.id;
    result.dateKey = challenge.dateKey;
  } else if (action === "claimCollectionReward") {
    const reward = collectionRewardDefinitions.find((item) => item.id === payload.rewardId);
    if (!reward) makeActionError("invalid-argument", "Такой награды за коллекцию нет.");
    if (state.claimedCollectionRewards.includes(reward.id)) makeActionError("already-exists", "Эта награда уже получена.");
    const owned = players.filter((player) => countOf(player.id) > 0).length;
    const target = reward.fullCollection ? players.length : reward.target;
    if (owned < target) makeActionError("failed-precondition", "Коллекция ещё не собрана для этой награды.");
    state.claimedCollectionRewards.push(reward.id);
    state.coins += reward.reward;
    result.reward = reward.reward;
  } else if (action === "setSquadSlot") {
    if (!Object.hasOwn(state.squad, payload.position)) makeActionError("invalid-argument", "Неизвестная позиция в составе.");
    if (payload.playerId === null) {
      state.squad[payload.position] = null;
    } else {
      const player = playerById.get(payload.playerId);
      if (!player || countOf(player.id) < 1) makeActionError("failed-precondition", "Нужна карточка в твоей коллекции.");
      if (Object.entries(state.squad).some(([position, id]) => position !== payload.position && id === player.id)) makeActionError("failed-precondition", "Эта карточка уже стоит в составе.");
      state.squad[payload.position] = player.id;
    }
  } else if (action === "dailyBonus") {
    const cooldown = 12 * 60 * 60 * 1000;
    if (Date.now() - state.lastBonusTime < cooldown) makeActionError("failed-precondition", "Ежедневный бонус пока недоступен.");
    state.coins += 500;
    state.lastBonusTime = Date.now();
    result.reward = 500;
  } else if (action === "resetProgress") {
    const preserved = {
      bestTotalOpened: state.bestTotalOpened,
      nickname: state.nickname,
      avatarUrl: state.avatarUrl,
      lastBonusTime: state.lastBonusTime,
    };
    Object.assign(state, createEmptyCloudState(user), preserved);
  } else if (action === "updateProfile") {
    const profile = payload.profile;
    if (!profile || typeof profile !== "object" || Array.isArray(profile) || Object.keys(profile).some((key) => !["userClub", "avatarUrl"].includes(key))) makeActionError("invalid-argument", "Недопустимые данные профиля.");
    if (Object.hasOwn(profile, "userClub")) {
      const club = profile.userClub;
      const image = getSafeImageUrl(club?.img);
      if (!club || typeof club.name !== "string" || !club.name.trim() || club.name.length > 60 || !image) makeActionError("invalid-argument", "Проверь название клуба и HTTPS-ссылку на эмблему.");
      state.userClub = { name: club.name.trim(), img: image };
    }
    if (Object.hasOwn(profile, "avatarUrl")) {
      if (typeof profile.avatarUrl !== "string" || (profile.avatarUrl && !getSafeImageUrl(profile.avatarUrl))) makeActionError("invalid-argument", "Для аватара нужна HTTPS-ссылка.");
      state.avatarUrl = getSafeImageUrl(profile.avatarUrl) || "";
    }
  } else {
    makeActionError("invalid-argument", "Это игровое действие не поддерживается.");
  }

  state.nickname ||= getClientNickname(user);
  state.lastUpdated = Math.max(Date.now(), Number(state.lastUpdated || 0) + 1);
  state.lastActionId = globalThis.crypto?.randomUUID?.() ||
    `${state.lastUpdated}-${Math.random().toString(36).slice(2)}`;
  return result;
}

function getPendingCloudSave(uid) {
  const memoryPending = cloudPendingSaves.get(uid);
  if (memoryPending) return memoryPending;
  try {
    const raw = localStorage.getItem(`footpacks_pending_sync_${uid}`);
    if (!raw || raw === "1") return null;
    const pending = JSON.parse(raw);
    if (
      pending?.version !== 1 ||
      !Number.isSafeInteger(pending.baseRevision) ||
      pending.baseRevision < 0 ||
      !pending.state ||
      typeof pending.state !== "object"
    ) return null;
    return pending;
  } catch {
    return null;
  }
}

function storePendingCloudSave(uid, pending) {
  cloudPendingSaves.set(uid, pending);
  try {
    localStorage.setItem(`footpacks_pending_sync_${uid}`, JSON.stringify(pending));
    return true;
  } catch (error) {
    console.warn("Не удалось сохранить очередь облачной синхронизации:", error);
    return false;
  }
}

function clearPendingCloudSave(uid) {
  cloudPendingSaves.delete(uid);
  try {
    localStorage.removeItem(`footpacks_pending_sync_${uid}`);
  } catch (error) {
    console.warn("Не удалось удалить очередь облачной синхронизации:", error);
  }
}

function preserveCloudConflictCopy(uid, state) {
  if (!state) return;
  try {
    localStorage.setItem(`footpacks_conflict_backup_${uid}`, JSON.stringify(state));
  } catch (error) {
    console.warn("Не удалось сохранить резервную копию конфликта:", error);
  }
}

async function loadCloudGameState(user, fallbackState) {
  const uid = user.uid;
  const userRef = doc(db, "users", uid);
  const leaderboardRef = doc(db, "leaderboard", uid);
  const pendingKey = `footpacks_pending_sync_${uid}`;
  const rawPending = safeStorageGet(pendingKey);
  const pending = getPendingCloudSave(uid);
  const legacyPending = rawPending === "1";
  const fallback = normalizeClientCloudState(
    fallbackState || createEmptyCloudState(user),
    user,
  );

  cloudPendingConflictOnLoad = false;
  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (snapshot.exists()) {
      const remoteState = normalizeClientCloudState(snapshot.data(), user);
      if (pending && pending.state.lastActionId === remoteState.lastActionId) {
        return { state: remoteState, pendingResolved: true, conflict: false };
      }
      if (pending && pending.baseRevision === remoteState.lastUpdated) {
        const pendingState = normalizeClientCloudState(pending.state, user);
        transaction.set(userRef, pendingState);
        transaction.set(leaderboardRef, {
          nickname: pendingState.nickname,
          totalOpened: pendingState.bestTotalOpened,
          cups: pendingState.cups,
          lastUpdated: pendingState.lastUpdated,
        });
        return { state: pendingState, pendingResolved: true, conflict: false };
      }
      return {
        state: remoteState,
        pendingResolved: false,
        conflict: Boolean(pending || legacyPending),
      };
    }

    const initialState = pending
      ? normalizeClientCloudState(pending.state, user)
      : fallback;
    transaction.set(userRef, initialState);
    transaction.set(leaderboardRef, {
      nickname: initialState.nickname,
      totalOpened: initialState.bestTotalOpened,
      cups: initialState.cups,
      lastUpdated: initialState.lastUpdated,
    });
    return { state: initialState, pendingResolved: true, conflict: false };
  });

  cloudAcknowledgedRevision = result.state.lastUpdated;
  if (result.pendingResolved) {
    clearPendingCloudSave(uid);
  } else if (result.conflict) {
    preserveCloudConflictCopy(uid, pending?.state || fallbackState);
    clearPendingCloudSave(uid);
    cloudPendingConflictOnLoad = true;
  }
  return result.state;
}

async function executeGameAction(action, payload = {}) {
  const currentUser = auth.currentUser;
  const uid = currentUser?.uid;
  if (!currentUser || !uid || currentUserUid !== uid) {
    throw new Error("Войди в аккаунт, чтобы сохранить прогресс.");
  }

  const requiresFullCatalog =
    (action === "sellCard" && !builtInPlayerIds.has(payload.playerId)) ||
    (action === "buyMarket" && !builtInPlayerIds.has(payload.playerId)) ||
    (action === "exchangeSbc" &&
      Array.isArray(payload.playerIds) &&
      payload.playerIds.some((playerId) => !builtInPlayerIds.has(playerId))) ||
    (action === "setSquadSlot" &&
      Boolean(payload.playerId) &&
      !builtInPlayerIds.has(payload.playerId)) ||
    ["claimCollectionReward", "adminCollectAllPlayers"].includes(action);
  if (requiresFullCatalog) {
    await playersLoadPromise;
    if (!playersCatalogComplete) {
      throw new Error("Не удалось загрузить полный список игроков. Проверь подключение и попробуй ещё раз.");
    }
  }

  if (["adminAddCoins", "adminCollectAllPlayers"].includes(action)) {
    const isAdmin = await hasAdminClaim(true, currentUser);
    if (!isAdmin || auth.currentUser?.uid !== uid || currentUserUid !== uid) {
      makeActionError("permission-denied", "Для этого действия нужны права администратора.");
    }
  }

  if (auth.currentUser?.uid !== uid || currentUserUid !== uid) {
    throw new Error("Аккаунт сменился. Повтори действие после входа.");
  }

  const baseRevision = cloudAcknowledgedRevision;
  const state = normalizeClientCloudState(
    snapshotCurrentGameState(currentUser),
    currentUser,
  );
  const actionResult = applyClientGameAction(state, action, payload, currentUser);
  state.bestTotalOpened = Math.max(state.bestTotalOpened, state.totalOpened);
  hydrateGameState(state);
  await saveState();
  updateUI();
  enqueueCloudGameStateSave(currentUser, state, baseRevision);
  return { state, ...actionResult };
}

function enqueueCloudGameStateSave(user, state, fallbackBaseRevision = cloudAcknowledgedRevision) {
  const uid = user.uid;
  const existing = getPendingCloudSave(uid);
  const pending = {
    version: 1,
    baseRevision: existing?.baseRevision ?? fallbackBaseRevision,
    state,
    revision: ++cloudGameSaveRevision,
  };
  storePendingCloudSave(uid, pending);

  cloudGameSaveQueue = cloudGameSaveQueue
    .catch(() => undefined)
    .then(() => flushPendingCloudSave(uid));
}

async function flushPendingCloudSave(uid) {
  while (auth.currentUser?.uid === uid && currentUserUid === uid) {
    const pending = getPendingCloudSave(uid);
    if (!pending) return;

    const user = auth.currentUser;
    const state = normalizeClientCloudState(pending.state, user);
    const userRef = doc(db, "users", uid);
    const leaderboardRef = doc(db, "leaderboard", uid);
    let conflict = false;
    let saved = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await runTransaction(db, async (transaction) => {
          const snapshot = await transaction.get(userRef);
          const remoteRevision = snapshot.exists()
            ? normalizeClientCloudState(snapshot.data(), user).lastUpdated
            : 0;
          if (snapshot.exists() && snapshot.data().lastActionId === state.lastActionId) {
            return { revision: remoteRevision, stale: false };
          }
          if (remoteRevision !== pending.baseRevision) {
            return { revision: remoteRevision, stale: true };
          }
          transaction.set(userRef, state);
          transaction.set(leaderboardRef, {
            nickname: state.nickname,
            totalOpened: state.bestTotalOpened,
            cups: state.cups,
            lastUpdated: state.lastUpdated,
          });
          return { revision: state.lastUpdated, stale: false };
        });
        if (result.stale) {
          conflict = true;
          break;
        }
        cloudAcknowledgedRevision = result.revision;
        saved = true;
        break;
      } catch (error) {
        if (attempt < 2 && auth.currentUser?.uid === uid) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
          continue;
        }
        console.error("Не удалось синхронизировать игровое сохранение:", error);
      }
    }

    if (conflict) {
      try {
        const remoteSnapshot = await getDoc(userRef);
        const latestPending = getPendingCloudSave(uid);
        const remoteState = remoteSnapshot.exists()
          ? normalizeClientCloudState(remoteSnapshot.data(), user)
          : null;
        if (remoteState?.lastActionId === state.lastActionId) {
          cloudAcknowledgedRevision = remoteState.lastUpdated;
          if (latestPending) {
            latestPending.baseRevision = remoteState.lastUpdated;
            storePendingCloudSave(uid, latestPending);
            continue;
          }
          clearPendingCloudSave(uid);
          return;
        }
        preserveCloudConflictCopy(uid, latestPending?.state || state);
        clearPendingCloudSave(uid);
        cloudGameSaveRevision += 1;
        if (remoteState && auth.currentUser?.uid === uid && currentUserUid === uid) {
          cloudAcknowledgedRevision = remoteState.lastUpdated;
          hydrateGameState(remoteState);
          await saveState();
          updateUI();
          renderSquad();
          renderSquadPicker();
          showToast("На другом устройстве сохранён более новый прогресс. Загружена облачная версия; локальная копия оставлена в резерве.", "error");
        }
      } catch (error) {
        console.error("Не удалось проверить актуальное облачное сохранение:", error);
      }
      return;
    }

    if (!saved) {
      if (auth.currentUser?.uid === uid && cloudSaveErrorNotifiedUid !== uid) {
        cloudSaveErrorNotifiedUid = uid;
        showToast(
          "Прогресс остался на этом устройстве, но не синхронизировался с облаком. Проверь подключение.",
          "error",
        );
      }
      return;
    }

    if (cloudSaveErrorNotifiedUid === uid) cloudSaveErrorNotifiedUid = null;
    const latestPending = getPendingCloudSave(uid);
    if (!latestPending) return;
    if (latestPending.revision === pending.revision) {
      clearPendingCloudSave(uid);
      return;
    }
    latestPending.baseRevision = cloudAcknowledgedRevision;
    storePendingCloudSave(uid, latestPending);
  }
}

window.addEventListener("online", () => {
  const user = auth.currentUser;
  if (!user || currentUserUid !== user.uid) return;
  const pending = getPendingCloudSave(user.uid);
  if (pending) enqueueCloudGameStateSave(user, pending.state, pending.baseRevision);
});

function readStoredNumber(key, fallback) {
  const storedValue = safeStorageGet(key);
  if (storedValue === null || storedValue === "") return fallback;
  const value = Number(storedValue);
  return Number.isFinite(value) ? value : fallback;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Не удалось прочитать локальное хранилище (${key}):`, error);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Не удалось записать локальное хранилище (${key}):`, error);
    return false;
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Не удалось удалить локальное значение (${key}):`, error);
    return false;
  }
}

function readStoredJson(key, fallback) {
  try {
    const value = safeStorageGet(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Не удалось прочитать локальное сохранение ${key}:`, error);
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function getSafeImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, window.location.href);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function getPlayerIdFromName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function createEmptySquad() {
  return {
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
}

function hydrateGameState(data = {}) {
  coins = Number.isFinite(Number(data.coins))
    ? Math.max(0, Number(data.coins))
    : 1000;
  totalOpened = Number.isFinite(Number(data.totalOpened))
    ? Math.max(0, Math.floor(Number(data.totalOpened)))
    : 0;
  bestTotalOpened = Math.max(
    totalOpened,
    Number.isFinite(Number(data.bestTotalOpened))
      ? Number(data.bestTotalOpened)
      : 0,
  );
  eliteStreak = Number.isFinite(Number(data.eliteStreak))
    ? Math.max(0, Math.floor(Number(data.eliteStreak)))
    : 0;
  cups = Number.isFinite(Number(data.cups))
    ? Math.max(0, Math.floor(Number(data.cups)))
    : Array.isArray(data.completedQuests)
      ? data.completedQuests.length
      : 0;
  inventory = {};
  if (
    data.inventory &&
    typeof data.inventory === "object" &&
    !Array.isArray(data.inventory)
  ) {
    Object.entries(data.inventory).forEach(([id, item]) => {
      const count = Number(item?.count);
      if (
        id !== "__proto__" &&
        id !== "constructor" &&
        id !== "prototype" &&
        Number.isFinite(count) &&
        count > 0
      ) {
        inventory[id] = { count: Math.floor(count) };
      }
    });
  }
  squad = createEmptySquad();
  if (
    data.squad &&
    typeof data.squad === "object" &&
    !Array.isArray(data.squad)
  ) {
    Object.keys(squad).forEach((position) => {
      const playerId = data.squad[position];
      squad[position] = typeof playerId === "string" ? playerId : null;
    });
  }
  completedQuests = Array.isArray(data.completedQuests)
    ? data.completedQuests.filter((id) =>
        questDefinitions.some((quest) => quest.id === id),
      )
    : [];
  lastBonusTime = Number.isFinite(Number(data.lastBonusTime))
    ? Number(data.lastBonusTime)
    : lastBonusTime;
  dailyChallengeClaimedDate =
    typeof data.dailyChallengeClaimedDate === "string"
      ? data.dailyChallengeClaimedDate
      : "";
  claimedCollectionRewards = Array.isArray(data.claimedCollectionRewards)
    ? [...new Set(data.claimedCollectionRewards)].filter((id) =>
        collectionRewardDefinitions.some((reward) => reward.id === id),
      )
    : [];
  userClub = {
    name: String(data.userClub?.name || DEFAULT_CLUB.name),
    img: getSafeImageUrl(data.userClub?.img) || DEFAULT_CLUB.img,
  };
  userAvatarUrl = getSafeImageUrl(data.avatarUrl) || "";
  gameStateLastUpdated = Number.isSafeInteger(Number(data.lastUpdated))
    ? Math.max(0, Number(data.lastUpdated))
    : 0;
  gameStateLastActionId = typeof data.lastActionId === "string"
    ? data.lastActionId
    : "";
}

function resetGameState() {
  hydrateGameState({
    userClub: DEFAULT_CLUB,
    lastBonusTime: 0,
    dailyChallengeClaimedDate: "",
  });
}

// === ИНТЕГРАЦИЯ С TELEGRAM MINI APP ===
const tg = window.Telegram?.WebApp || null;

// Разворачиваем игру на весь экран, если открыли в Telegram
if (tg?.initDataUnsafe?.user) {
  tg.expand();
}

async function autoTelegramLogin() {
  if (!tg?.initData) return;
  showToast("В бесплатном режиме войди через ник и пароль.", "error");
}

if (tg?.initData) autoTelegramLogin();

const players = [
  // --- ИКОНЫ (ДЖЕКПОТ) ---
  {
    id: "maradona",
    name: "Maradona",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://images.fotmob.com/image_resources/playerimages/158546.png",
  },
  {
    id: "pele",
    name: "Pele",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://cdn3.futbin.com/content/fifa27/img/players/237067.png?fm=png&ixlib=java-2.1.0&verzion=2&w=324&s=22102a1903bfc0271a823f3a78443f56",
  },
  {
    id: "ronaldinho",
    name: "Ronaldinho",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://images.fotmob.com/image_resources/playerimages/30743.png",
  },
  {
    id: "zidane-icon",
    name: "Zinédine Zidane",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://images.fotmob.com/image_resources/playerimages/38422.png",
  },
  {
    id: "johan-cruyff-icon",
    name: "Johan Cruyff",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "CAM",
    price: 5000,
    photo: "https://sport.news.am/static/news/b/2012/10/13489.jpg",
  },
  {
    id: "lev-yashin-icon",
    name: "Lev Yashin",
    raiting: 95,
    club: "Icons",
    league: "Icon",
    pos: "GK",
    price: 5000,
    photo: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Lev_Yashin.jpg",
    photoCreditUrl: "https://commons.wikimedia.org/wiki/File:Lev_Yashin.jpg",
    photoLicense: "CC BY-SA 3.0 NL",
    photoLicenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/nl/deed.en",
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
  // --- НОВЫЕ КАРТОЧКИ ---
  {
    id: "nuno-mendes",
    name: "Nuno Mendes",
    raiting: 89,
    club: "PSG",
    league: "Ligue 1",
    pos: "LB",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/1158945.png",
  },
  {
    id: "marc-cucurella",
    name: "Marc Cucurella",
    raiting: 86,
    club: "Real Madrid",
    league: "La Liga",
    pos: "LB",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/873289.png",
  },
  {
    id: "dimarco",
    name: "Federico Dimarco",
    raiting: 86,
    club: "Inter",
    league: "Seria A",
    pos: "LB",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/605224.png",
  },
  {
    id: "hakimi",
    name: "Achraf Hakimi",
    raiting: 88,
    club: "PSG",
    league: "Ligue 1",
    pos: "RB",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/770881.png",
  },
  {
    id: "laimer",
    name: "Konrad Laimer",
    raiting: 85,
    club: "Bayern Munich",
    league: "Bundesliga",
    pos: "RB",
    price: 250,
    photo: "https://images.fotmob.com/image_resources/playerimages/526827.png",
  },
  {
    id: "marcos-llorente",
    name: "Marcos Llorente",
    raiting: 85,
    club: "Atletico Madrid",
    league: "La Liga",
    pos: "RB",
    price: 250,
    photo: "https://images.fotmob.com/image_resources/playerimages/602563.png",
  },
  {
    id: "pedri",
    name: "Pedri",
    raiting: 90,
    club: "Barcelona",
    league: "La Liga",
    pos: "CM",
    price: 1200,
    photo: "https://images.fotmob.com/image_resources/playerimages/1083323.png",
  },
  {
    id: "frenkie-de-jong",
    name: "Frenkie de Jong",
    raiting: 86,
    club: "Barcelona",
    league: "La Liga",
    pos: "CDM",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/638622.png",
  },
  {
    id: "van-dijk",
    name: "Virgil van Dijk",
    raiting: 88,
    club: "Liverpool",
    league: "Premier League",
    pos: "CB",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/209405.png",
  },
  {
    id: "gabriel-magalhaes",
    name: "Gabriel Magalhães",
    raiting: 89,
    club: "Arsenal",
    league: "Premier League",
    pos: "CB",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/795179.png",
  },
  {
    id: "willian-pacho",
    name: "Willian Pacho",
    raiting: 89,
    club: "PSG",
    league: "Ligue 1",
    pos: "CB",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/1137670.png",
  },
  {
    id: "joao-neves",
    name: "João Neves",
    raiting: 88,
    club: "PSG",
    league: "Ligue 1",
    pos: "CM",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/1342757.png",
  },
  {
    id: "luis-diaz",
    name: "Luis Díaz",
    raiting: 88,
    club: "Bayern Munich",
    league: "Bundesliga",
    pos: "LW",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/860914.png",
  },
  {
    id: "julian-alvarez",
    name: "Julián Álvarez",
    raiting: 86,
    club: "Atletico Madrid",
    league: "La Liga",
    pos: "ST",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/974753.png",
  },
  {
    id: "florian-wirtz",
    name: "Florian Wirtz",
    raiting: 86,
    club: "Liverpool",
    league: "Premier League",
    pos: "CAM",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/1152455.png",
  },
  {
    id: "cole-palmer",
    name: "Cole Palmer",
    raiting: 90,
    club: "Chelsea",
    league: "Premier League",
    pos: "CAM",
    price: 1000,
    photo: "https://images.fotmob.com/image_resources/playerimages/1096353.png",
  },
  {
    id: "jamal-musiala",
    name: "Jamal Musiala",
    raiting: 90,
    club: "Bayern Munich",
    league: "Bundesliga",
    pos: "CAM",
    price: 1000,
    photo: "https://images.fotmob.com/image_resources/playerimages/1156141.png",
  },
  {
    id: "declan-rice",
    name: "Declan Rice",
    raiting: 89,
    club: "Arsenal",
    league: "Premier League",
    pos: "CDM",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/654096.png",
  },
  {
    id: "bruno-fernandes",
    name: "Bruno Fernandes",
    raiting: 88,
    club: "Man United",
    league: "Premier League",
    pos: "CAM",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/422685.png",
  },
  {
    id: "trent-alexander-arnold",
    name: "Trent Alexander-Arnold",
    raiting: 87,
    club: "Real Madrid",
    league: "La Liga",
    pos: "RB",
    price: 500,
    photo: "https://images.fotmob.com/image_resources/playerimages/760712.png",
  },
  {
    id: "michael-olise",
    name: "Michael Olise",
    raiting: 87,
    club: "Bayern Munich",
    league: "Bundesliga",
    pos: "RW",
    price: 500,
    photo: "https://images.fotmob.com/image_resources/playerimages/1029063.png",
  },
  {
    id: "gavi",
    name: "Gavi",
    raiting: 85,
    club: "Barcelona",
    league: "La Liga",
    pos: "CM",
    price: 300,
    photo: "https://images.fotmob.com/image_resources/playerimages/1279040.png",
  },
  {
    id: "khvicha-kvaratskhelia",
    name: "Khvicha Kvaratskhelia",
    raiting: 89,
    club: "PSG",
    league: "Ligue 1",
    pos: "LW",
    price: 800,
    photo: "https://images.fotmob.com/image_resources/playerimages/900433.png",
  },
  {
    id: "viktor-gyokeres",
    name: "Viktor Gyökeres",
    raiting: 87,
    club: "Arsenal",
    league: "Premier League",
    pos: "ST",
    price: 500,
    photo: "https://images.fotmob.com/image_resources/playerimages/664500.png",
  },
  {
    id: "alexis-mac-allister",
    name: "Alexis Mac Allister",
    raiting: 87,
    club: "Liverpool",
    league: "Premier League",
    pos: "CM",
    price: 500,
    photo: "https://images.fotmob.com/image_resources/playerimages/831489.png",
  },
  {
    id: "nico-williams",
    name: "Nico Williams",
    raiting: 87,
    club: "Athletic Club",
    league: "La Liga",
    pos: "LW",
    price: 500,
    photo: "https://images.fotmob.com/image_resources/playerimages/1202110.png",
  },
  {
    id: "alexander-isak",
    name: "Alexander Isak",
    raiting: 88,
    club: "Liverpool",
    league: "Premier League",
    pos: "ST",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/690107.png",
  },
  {
    id: "rayan-cherki",
    name: "Rayan Cherki",
    raiting: 86,
    club: "Man City",
    league: "Premier League",
    pos: "CAM",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/1104053.png",
  },
  {
    id: "fermin-lopez",
    name: "Fermín López",
    raiting: 84,
    club: "Barcelona",
    league: "La Liga",
    pos: "CAM",
    price: 250,
    photo: "https://images.fotmob.com/image_resources/playerimages/1404415.png",
  },
  {
    id: "vitinha",
    name: "Vitinha",
    raiting: 88,
    club: "PSG",
    league: "Ligue 1",
    pos: "CM",
    price: 600,
    photo: "https://images.fotmob.com/image_resources/playerimages/1061249.png",
  },
  {
    id: "unai-simon",
    name: "Unai Simón",
    raiting: 86,
    club: "Athletic Club",
    league: "La Liga",
    pos: "GK",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/660625.png",
  },
  {
    id: "hugo-ekitike",
    name: "Hugo Ekitiké",
    raiting: 87,
    club: "Liverpool",
    league: "Premier League",
    pos: "ST",
    price: 500,
    photo: "https://images.fotmob.com/image_resources/playerimages/1197030.png",
  },
  {
    id: "warren-zaire-emery",
    name: "Warren Zaïre-Emery",
    raiting: 85,
    club: "PSG",
    league: "Ligue 1",
    pos: "CM",
    price: 300,
    photo: "https://images.fotmob.com/image_resources/playerimages/1367615.png",
  },
  {
    id: "dani-olmo",
    name: "Dani Olmo",
    raiting: 86,
    club: "Barcelona",
    league: "La Liga",
    pos: "CAM",
    price: 350,
    photo: "https://images.fotmob.com/image_resources/playerimages/614834.png",
  },
  {
    id: "ferran-torres",
    name: "Ferrán Torres",
    raiting: 85,
    club: "Barcelona",
    league: "La Liga",
    pos: "LW",
    price: 300,
    photo: "https://images.fotmob.com/image_resources/playerimages/881771.png",
  },
  {
    id: "ousmane-dembele",
    name: "Ousmane Dembélé",
    raiting: 91,
    club: "PSG",
    league: "Ligue 1",
    pos: "ST",
    price: 1800,
    photo: "https://images.fotmob.com/image_resources/playerimages/692984.png",
  },
  {
    id: "cody-gakpo",
    name: "Cody Gakpo",
    raiting: 84,
    club: "Liverpool",
    league: "Premier League",
    pos: "LW",
    price: 250,
    photo: "https://images.fotmob.com/image_resources/playerimages/806552.png",
  },
];

players.sort(
  (first, second) =>
    second.raiting - first.raiting || first.name.localeCompare(second.name),
);

const collectionRewardDefinitions = [
  { id: "collection-15", target: 15, reward: 500 },
  { id: "collection-30", target: 30, reward: 1000 },
  { id: "collection-45", target: 45, reward: 1500 },
  { id: "collection-full", fullCollection: true, reward: 2500 },
];

const builtInPlayerIds = new Set(players.map((player) => player.id));
const customPlayerIds = new Set();

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
      "zidane-icon": 0.1,
      "johan-cruyff-icon": 0.1,
      "lev-yashin-icon": 0.1,
      "nuno-mendes": 1,
      "marc-cucurella": 6,
      dimarco: 6,
      hakimi: 2,
      laimer: 10,
      "marcos-llorente": 10,
      pedri: 0.5,
      "frenkie-de-jong": 6,
      "van-dijk": 2,
      "gabriel-magalhaes": 1,
      "willian-pacho": 1,
      "joao-neves": 2,
      "luis-diaz": 2,
      "julian-alvarez": 6,
      "florian-wirtz": 6,
      "cole-palmer": 1,
      "jamal-musiala": 1,
      "declan-rice": 1.5,
      "bruno-fernandes": 2,
      "trent-alexander-arnold": 3,
      "michael-olise": 3,
      gavi: 5,
      "khvicha-kvaratskhelia": 1.5,
      "viktor-gyokeres": 3,
      "alexis-mac-allister": 3,
      "nico-williams": 3,
      "alexander-isak": 2,
      "rayan-cherki": 4,
      "fermin-lopez": 8,
      vitinha: 2,
      "unai-simon": 4,
      "hugo-ekitike": 3,
      "warren-zaire-emery": 5,
      "dani-olmo": 4,
      "ferran-torres": 5,
      "ousmane-dembele": 0.5,
      "cody-gakpo": 8,
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
      "zidane-icon": 3,
      "johan-cruyff-icon": 3,
      "lev-yashin-icon": 3,
      "nuno-mendes": 14,
      "marc-cucurella": 12,
      dimarco: 12,
      hakimi: 16,
      laimer: 8,
      "marcos-llorente": 8,
      pedri: 15,
      "frenkie-de-jong": 12,
      "van-dijk": 16,
      "gabriel-magalhaes": 14,
      "willian-pacho": 14,
      "joao-neves": 16,
      "luis-diaz": 16,
      "julian-alvarez": 12,
      "florian-wirtz": 12,
      "cole-palmer": 22,
      "jamal-musiala": 22,
      "declan-rice": 24,
      "bruno-fernandes": 26,
      "trent-alexander-arnold": 28,
      "michael-olise": 28,
      gavi: 32,
      "khvicha-kvaratskhelia": 24,
      "viktor-gyokeres": 28,
      "alexis-mac-allister": 28,
      "nico-williams": 28,
      "alexander-isak": 26,
      "rayan-cherki": 30,
      "fermin-lopez": 34,
      vitinha: 26,
      "unai-simon": 30,
      "hugo-ekitike": 28,
      "warren-zaire-emery": 32,
      "dani-olmo": 30,
      "ferran-torres": 32,
      "ousmane-dembele": 8,
      "cody-gakpo": 34,
    },
  },
};

const SOUND_STORAGE_KEY = "footpacks_sound_enabled";
const soundToggleButton = document.getElementById("sound-toggle-btn");
let soundEnabled = true;
try {
  soundEnabled = safeStorageGet(SOUND_STORAGE_KEY) !== "false";
} catch (error) {
  console.warn("Не удалось прочитать настройку звука:", error);
}
let audioContext = null;
let packRattleTimer = null;

function getAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ||= new AudioContextConstructor();
  return audioContext;
}

function playTone(context, frequency, startAt, duration, volume, type = "sine", endFrequency = frequency) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(30, frequency), startAt);
  if (endFrequency !== frequency) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), startAt + duration);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), startAt + Math.min(0.012, duration / 3));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.015);
}

function playSound(kind = "click") {
  if (!soundEnabled) return;
  try {
    const context = getAudioContext();
    if (!context) return;
    const play = () => {
      const now = context.currentTime + 0.004;
      const short = (frequency, offset = 0, duration = 0.055, volume = 0.035, type = "sine", endFrequency = frequency) =>
        playTone(context, frequency, now + offset, duration, volume, type, endFrequency);

      if (kind === "pack-open") {
        short(150, 0, 0.25, 0.075, "sawtooth", 58);
        short(380, 0.08, 0.3, 0.025, "triangle", 780);
      } else if (kind === "pack-rattle") {
        short(170 + Math.random() * 70, 0, 0.045, 0.018, "square", 100 + Math.random() * 70);
      } else if (kind === "walkout") {
        [523, 659, 784, 1047].forEach((frequency, index) =>
          short(frequency, index * 0.12, 0.24, 0.04, "triangle"),
        );
      } else if (kind === "reveal") {
        [660, 880, 1109].forEach((frequency, index) =>
          short(frequency, index * 0.07, 0.28, 0.035, "sine"),
        );
      } else if (kind === "sell") {
        short(880, 0, 0.08, 0.035, "triangle");
        short(1175, 0.07, 0.12, 0.03, "sine");
      } else if (kind === "reward") {
        [784, 988, 1175].forEach((frequency, index) =>
          short(frequency, index * 0.09, 0.32, 0.04, "sine"),
        );
      } else if (kind === "error") {
        short(260, 0, 0.11, 0.04, "triangle", 190);
      } else if (kind === "tab") {
        short(560, 0, 0.045, 0.022, "sine");
      } else {
        short(720, 0, 0.04, 0.02, "sine");
      }
    };

    if (context.state === "suspended") context.resume().then(play).catch(() => undefined);
    else play();
  } catch (error) {
    console.warn("Звуковой эффект недоступен в этом браузере:", error);
  }
}

function startPackRattle() {
  stopPackRattle();
  packRattleTimer = window.setInterval(() => playSound("pack-rattle"), 170);
}

function stopPackRattle() {
  if (packRattleTimer !== null) window.clearInterval(packRattleTimer);
  packRattleTimer = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopPackRattle();
});

function updateSoundToggle() {
  if (!soundToggleButton) return;
  soundToggleButton.setAttribute("aria-pressed", String(soundEnabled));
  soundToggleButton.setAttribute(
    "aria-label",
    soundEnabled ? "Отключить звуки" : "Включить звуки",
  );
  soundToggleButton.title = soundEnabled ? "Звук включён" : "Звук выключен";
  soundToggleButton.innerHTML = `<span aria-hidden="true">${soundEnabled ? "🔊" : "🔇"}</span>`;
  soundToggleButton.classList.toggle("is-muted", !soundEnabled);
}

if (soundToggleButton) {
  soundToggleButton.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    safeStorageSet(SOUND_STORAGE_KEY, String(soundEnabled));
    updateSoundToggle();
    if (soundEnabled) playSound("click");
  });
}
updateSoundToggle();

const MODAL_HISTORY_KEY = "footPacksModalToken";
const SUPPORT_HISTORY_KEY = "footPacksSupportToken";
const modalStack = [];
let modalTokenCounter = 0;
let supportHistoryToken = null;
const programmaticHistoryBacks = [];

function goBackAfterProgrammaticClose(kind, token) {
  const request = { kind, token, timer: null };
  request.timer = window.setTimeout(() => {
    const index = programmaticHistoryBacks.indexOf(request);
    if (index >= 0) programmaticHistoryBacks.splice(index, 1);
  }, 1500);
  programmaticHistoryBacks.push(request);
  history.back();
}

function getManagedModal(modalOrId) {
  if (typeof modalOrId === "string") return document.getElementById(modalOrId);
  return modalOrId instanceof HTMLElement ? modalOrId : null;
}

function getDialogElement(modal) {
  return modal?.querySelector(".modal-window, .admin-modal-window") || modal?.firstElementChild || modal;
}

function getTopModalEntry() {
  for (let index = modalStack.length - 1; index >= 0; index -= 1) {
    const modal = document.getElementById(modalStack[index].id);
    if (modal && getComputedStyle(modal).display !== "none") return modalStack[index];
  }
  return null;
}

function getModalFocusableElements(dialog) {
  return [...dialog.querySelectorAll(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0 && !element.closest("[inert]"));
}

function syncModalInertState() {
  const topEntry = getTopModalEntry();
  const topModal = topEntry ? document.getElementById(topEntry.id) : null;
  const main = document.querySelector("main");
  if (main) main.inert = Boolean(topModal);

  document.querySelectorAll(".modal-overlay, #admin-modal").forEach((modal) => {
    modal.inert = Boolean(topModal && modal !== topModal);
    modal.setAttribute("aria-hidden", String(modal !== topModal));
  });
  document.querySelectorAll(".support-float-btn, .sound-toggle-btn").forEach((control) => {
    control.inert = Boolean(topModal);
  });
  const supportWindow = document.getElementById("support-float-window");
  if (supportWindow) supportWindow.inert = Boolean(topModal);

  const backButton = window.Telegram?.WebApp?.BackButton;
  if (backButton) {
    if (telegramBackButtonBound !== backButton) {
      backButton.onClick(requestModalBack);
      telegramBackButtonBound = backButton;
    }
    const supportWindow = document.getElementById("support-float-window");
    const supportOpen = Boolean(
      supportWindow && getComputedStyle(supportWindow).display !== "none",
    );
    const canClose = Boolean(topEntry ? !topEntry.persistent : supportOpen);
    if (canClose) backButton.show();
    else backButton.hide();
  }
}

function focusModal(modal) {
  const dialog = getDialogElement(modal);
  const firstFocusable = getModalFocusableElements(dialog)[0];
  (firstFocusable || dialog).focus({ preventScroll: true });
}

function openModal(modalOrId, options = {}) {
  const modal = getManagedModal(modalOrId);
  if (!modal) return;
  const isPersistent = options.persistent ?? modal.dataset.modalPersistent === "true";
  let entry = modalStack.find((item) => item.id === modal.id);

  if (getComputedStyle(modal).display === "none") {
    entry = {
      id: modal.id,
      token: isPersistent ? null : `modal-${Date.now()}-${++modalTokenCounter}`,
      persistent: isPersistent,
      returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    modalStack.push(entry);
    modal.style.display = "flex";
    if (!entry.persistent) {
      const nextState = { ...(history.state || {}), [MODAL_HISTORY_KEY]: entry.token };
      history.pushState(nextState, "", location.href);
    }
  } else if (!entry) {
    entry = {
      id: modal.id,
      token: isPersistent ? null : `modal-${Date.now()}-${++modalTokenCounter}`,
      persistent: isPersistent,
      returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    };
    modalStack.push(entry);
  }

  const dialog = getDialogElement(modal);
  const heading = dialog.querySelector("h1, h2, h3, [data-modal-title]");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("tabindex", "-1");
  if (heading) {
    if (!heading.id) heading.id = `${modal.id}-title`;
    dialog.setAttribute("aria-labelledby", heading.id);
  } else if (!dialog.hasAttribute("aria-label")) {
    dialog.setAttribute("aria-label", "Окно FootPacks");
  }
  dialog.querySelectorAll(".close-btn").forEach((button) => {
    if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", "Закрыть окно");
    button.setAttribute("type", "button");
  });

  syncModalInertState();
  window.requestAnimationFrame(() => {
    if (getTopModalEntry()?.id === modal.id) focusModal(modal);
  });
}

function dismissModalElement(modal, entry) {
  modal.style.display = "none";
  const stackIndex = modalStack.indexOf(entry);
  if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
  syncModalInertState();
  if (!getTopModalEntry() && entry.returnFocus?.isConnected) {
    entry.returnFocus.focus({ preventScroll: true });
  } else if (getTopModalEntry()) {
    focusModal(document.getElementById(getTopModalEntry().id));
  }
}

function closeModal(modalOrId, options = {}) {
  const modal = getManagedModal(modalOrId);
  if (!modal) return;
  const entry = [...modalStack].reverse().find((item) => item.id === modal.id);
  if (!entry) {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    return;
  }
  if (entry.persistent && !options.force) return;

  const currentHistoryToken = history.state?.[MODAL_HISTORY_KEY];
  dismissModalElement(modal, entry);
  if (!entry.persistent && currentHistoryToken === entry.token) {
    goBackAfterProgrammaticClose("modal", entry.token);
  }
}

function requestModalBack() {
  const entry = getTopModalEntry();
  if (!entry) {
    const supportWindow = document.getElementById("support-float-window");
    if (supportWindow && getComputedStyle(supportWindow).display !== "none") {
      playSound("click");
      setSupportWindowOpen(false);
      return true;
    }
    return false;
  }
  if (entry.persistent) return false;
  if (history.state?.[MODAL_HISTORY_KEY] === entry.token) history.back();
  else {
    playSound("click");
    closeModal(entry.id);
  }
  return true;
}

function initializeModalManager() {
  document.querySelectorAll(".modal-overlay, #admin-modal").forEach((modal) => {
    const visible = getComputedStyle(modal).display !== "none";
    modal.setAttribute("aria-hidden", String(!visible));
    const dialog = getDialogElement(modal);
    const heading = dialog.querySelector("h1, h2, h3, [data-modal-title]");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("tabindex", "-1");
    if (heading) {
      if (!heading.id) heading.id = `${modal.id}-title`;
      dialog.setAttribute("aria-labelledby", heading.id);
    }
    dialog.querySelectorAll(".close-btn").forEach((button) => {
      if (!button.hasAttribute("aria-label")) button.setAttribute("aria-label", "Закрыть окно");
      button.setAttribute("type", "button");
    });

    if (visible) {
      modalStack.push({
        id: modal.id,
        token: null,
        persistent: modal.dataset.modalPersistent === "true",
        returnFocus: null,
      });
    }

    modal.addEventListener("click", (event) => {
      if (event.target === modal) {
        playSound("click");
        closeModal(modal);
      }
    });
  });

  document.querySelectorAll("input, textarea, select").forEach((field) => {
    if (field.hasAttribute("aria-label") || field.hasAttribute("aria-labelledby")) return;
    const label = field.closest("label") ||
      [...document.querySelectorAll("label[for]")].find((candidate) => candidate.htmlFor === field.id);
    if (label) return;
    const accessibleName = field.getAttribute("placeholder") || field.getAttribute("title");
    if (accessibleName) field.setAttribute("aria-label", accessibleName);
  });

  syncModalInertState();
  if (getTopModalEntry()) focusModal(document.getElementById(getTopModalEntry().id));
}

document.addEventListener("click", (event) => {
  const eventElement = event.target instanceof Element ? event.target : event.target?.parentElement;
  const closeButton = eventElement?.closest("[data-close]");
  if (closeButton) closeModal(closeButton.dataset.close);
});

document.addEventListener("keydown", (event) => {
  const entry = getTopModalEntry();
  if (!entry) {
    if (event.key === "Escape") {
      const supportWindow = document.getElementById("support-float-window");
      if (supportWindow && getComputedStyle(supportWindow).display !== "none") {
        event.preventDefault();
        playSound("click");
        window.toggleSupportWindow();
      }
    }
    return;
  }

  const modal = document.getElementById(entry.id);
  const dialog = getDialogElement(modal);
  if (event.key === "Escape") {
    event.preventDefault();
    playSound("click");
    closeModal(entry.id);
  } else if (event.key === "Tab") {
    const focusable = getModalFocusableElements(dialog);
    if (!focusable.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const eventElement = event.target instanceof Element
    ? event.target
    : event.target?.parentElement;
  const customControl = eventElement?.closest(
    '[role="button"]:not(button), .pitch-slot, .preset-img',
  );
  if (
    !customControl ||
    customControl.getAttribute("aria-disabled") === "true" ||
    customControl.closest("[inert]") ||
    eventElement.closest("button, a[href], input, textarea, select")
  ) return;

  event.preventDefault();
  customControl.click();
});

window.addEventListener("popstate", (event) => {
  const programmaticBack = programmaticHistoryBacks.shift();
  if (programmaticBack) {
    window.clearTimeout(programmaticBack.timer);
    return;
  }

  const entry = getTopModalEntry();
  if (entry && !entry.persistent && event.state?.[MODAL_HISTORY_KEY] !== entry.token) {
    playSound("click");
    dismissModalElement(document.getElementById(entry.id), entry);
  }
  const supportWindow = document.getElementById("support-float-window");
  if (
    supportWindow &&
    getComputedStyle(supportWindow).display !== "none" &&
    event.state?.[SUPPORT_HISTORY_KEY] !== supportHistoryToken
  ) {
    playSound("click");
    setSupportWindowOpen(false, { fromHistory: true });
  }
});

let telegramBackButtonBound = null;
initializeModalManager();

document.addEventListener("click", (event) => {
  const eventElement = event.target instanceof Element ? event.target : event.target?.parentElement;
  const interactive = eventElement?.closest(
    'button:not(#btn):not(#sell-btn):not(#sound-toggle-btn), a[href], input, textarea, select, [role="button"], .pitch-slot, .squad-picker-card, .sbc-slot.filled, .preset-img',
  );
  if (
    !interactive ||
    interactive.disabled ||
    interactive.getAttribute("aria-disabled") === "true" ||
    interactive.matches('select, input[type="checkbox"], input[type="radio"]') ||
    interactive.id === "pack"
  ) return;
  playSound(interactive.classList.contains("pack-tab") ? "tab" : "click");
}, { capture: true });

document.addEventListener("change", (event) => {
  if (event.target.matches("select, input[type=checkbox], input[type=radio]")) {
    playSound("click");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target instanceof Element && event.target.closest("button, a, input, textarea, select")) return;
  const target = event.target instanceof Element
    ? event.target.closest('[role="button"][tabindex="0"], .pitch-slot[tabindex="0"]')
    : null;
  if (!target || target.tagName === "BUTTON" || target.tagName === "A") return;
  event.preventDefault();
  target.click();
});

async function loadPlayersFromDB() {
  const stagedPlayers = [];
  playersCatalogComplete = false;
  try {
    const playersRef = collection(db, "players");
    let cursor = null;
    let page;
    do {
      const constraints = [orderBy(documentId()), limit(100)];
      if (cursor) constraints.splice(1, 0, startAfter(cursor));
      page = await getDocs(query(playersRef, ...constraints));
      page.forEach((playerDoc) => {
        const customPlayer = playerDoc.data();
        const rating = Number(customPlayer.raiting);
        const price = Number(customPlayer.price);
        const name = typeof customPlayer.name === "string" ? customPlayer.name.trim() : "";
        const club = typeof customPlayer.club === "string" ? customPlayer.club.trim().slice(0, 60) : "";
        const league = typeof customPlayer.league === "string" ? customPlayer.league.trim().slice(0, 60) : "";
        const pos = typeof customPlayer.pos === "string" ? customPlayer.pos.trim().slice(0, 12) : "";
        const photo = getSafeImageUrl(customPlayer.photo);
        const weightStandard = Number(customPlayer.weightStandard);
        const weightElite = Number(customPlayer.weightElite);
        if (
          typeof customPlayer.id !== "string" ||
          !customPlayer.id ||
          customPlayer.id.length > 100 ||
          customPlayer.id !== playerDoc.id ||
          builtInPlayerIds.has(customPlayer.id) ||
          !name ||
          name.length > 60 ||
          !photo ||
          photo.length > 2048 ||
          !Number.isInteger(rating) ||
          rating < 1 ||
          rating > 99 ||
          !Number.isSafeInteger(price) ||
          price < 0 ||
          price > 1_000_000_000
        ) {
          console.warn(`Пропущена некорректная карточка ${playerDoc.id}.`);
          return;
        }
        stagedPlayers.push({
          id: customPlayer.id,
          name,
          raiting: rating,
          club,
          league,
          pos,
          price,
          photo,
          weightStandard: Number.isFinite(weightStandard) &&
            weightStandard >= 0 && weightStandard <= 100_000
            ? weightStandard
            : 5,
          weightElite: Number.isFinite(weightElite) &&
            weightElite >= 0 && weightElite <= 100_000
            ? weightElite
            : 5,
        });
      });
      cursor = page.docs.at(-1) || null;
    } while (page.size === 100 && cursor);

    stagedPlayers.forEach((customPlayer) => {
      const existingIndex = players.findIndex((player) => player.id === customPlayer.id);
      if (existingIndex === -1) players.push(customPlayer);
      else players[existingIndex] = customPlayer;
      customPlayerIds.add(customPlayer.id);
      packTypes.standard.weights[customPlayer.id] = customPlayer.weightStandard;
      packTypes.elite.weights[customPlayer.id] = customPlayer.weightElite;
    });
    players.sort(
      (first, second) =>
        second.raiting - first.raiting || first.name.localeCompare(second.name),
    );
    playersCatalogComplete = true;
    console.log("✅ Игроки из базы успешно загружены!");
    updateUI();
    if (document.getElementById("collection-modal").style.display === "flex") {
      initSlots();
    }
    if (document.getElementById("market-modal").style.display === "flex") {
      renderMarket();
    }
  } catch (error) {
    console.error("❌ Ошибка при загрузке игроков из базы:", error);
    playersCatalogComplete = false;
  }
}

const playersLoadPromise = loadPlayersFromDB();

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

let coins = readStoredNumber("cards_coins", 1000);
let totalOpened = readStoredNumber("cards_totalOpened", 0);
let bestTotalOpened = readStoredNumber("cards_bestTotalOpened", totalOpened);
let eliteStreak = readStoredNumber("cards_eliteStreak", 0);
let cups = readStoredNumber("cards_cups", 0);
let inventory = readStoredJson("cards_inventory", {});
let squad = readStoredJson("cards_squad", {
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
});
let completedQuests = readStoredJson("cards_completed_quests", []);
let claimedCollectionRewards = [];
let collectionRewardClaimInProgress = false;
let lastBonusTime = 0;
let dailyChallengeClaimedDate = "";
let sbcBurnList = [];

let currentPackType = "standard";
let lastDroppedPlayer = null;
let selectedPitchPos = null;
let activeFilter = "all";
let collectionSearchTerm = "";

async function checkDailyBonus() {
  if (!currentUserUid) return;
  try {
    await executeGameAction("dailyBonus");
    playSound("reward");
    showToast("🎁 Ежедневный бонус! Начислено +500$!");
  } catch (error) {
    if (error?.code !== "functions/failed-precondition") {
      console.error("Не удалось получить ежедневный бонус:", error);
      showToast(error.message || "Не удалось получить ежедневный бонус.", "error");
    }
  }
}

// Красивое всплывающее уведомление вместо alert
function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Уведомления");
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "game-toast";
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-atomic", "true");
  if (type === "error") {
    toast.style.borderLeftColor = "#ef4444";
    playSound("error");
  }
  toast.textContent = message;

  container.appendChild(toast);

  // Удаляем элемент из DOM через 3 секунды после окончания анимации
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Локальная копия ускоряет загрузку; авторизованные игровые действия сохраняются в Firestore.
async function saveState() {
  const snapshot = {
    coins,
    totalOpened,
    bestTotalOpened: Math.max(bestTotalOpened, totalOpened),
    eliteStreak,
    cups,
    inventory: { ...inventory },
    squad: { ...squad },
    completedQuests: [...completedQuests],
    claimedCollectionRewards: [...claimedCollectionRewards],
    userClub: { ...userClub },
    avatarUrl: userAvatarUrl,
    lastBonusTime,
    dailyChallengeClaimedDate,
    nickname: getClientNickname(auth.currentUser),
    lastUpdated: gameStateLastUpdated,
    lastActionId: gameStateLastActionId,
  };

  try {
    if (currentUserUid) {
      localStorage.setItem(`footpacks_save_${currentUserUid}`, JSON.stringify(snapshot));
      localStorage.setItem("footpacks_local_owner", currentUserUid);
    } else {
      localStorage.setItem("footpacks_guest_save", JSON.stringify(snapshot));
    }
  } catch (error) {
    console.error("Ошибка локального сохранения:", error);
  }
  return true;
}

function updateUI() {
  document.getElementById("coins-count").textContent = coins;
  document.getElementById("pack-count").textContent = totalOpened;
  document.getElementById("btn").textContent =
    `Открыть (${packTypes[currentPackType].cost}$)`;
  document.getElementById("btn").disabled =
    packOpenInProgress || coins < packTypes[currentPackType].cost;
  const packBox = document.getElementById("pack");
  const packUnavailable = packOpenInProgress || coins < packTypes[currentPackType].cost;
  if (packBox) {
    packBox.setAttribute("aria-disabled", String(packUnavailable));
    packBox.tabIndex = packUnavailable ? -1 : 0;
  }

  const collectedPlayerCount = players.filter(
    (p) => inventory[p.id]?.count > 0,
  ).length;
  document.getElementById("collection-count").textContent =
    collectedPlayerCount + (hasExclusiveCoach ? EXCLUSIVE_COACHES.length : 0);
  document.getElementById("collection-total").textContent =
    players.length + EXCLUSIVE_COACHES.length;
  const profileCoins = document.getElementById("profile-total-coins");
  const profilePacks = document.getElementById("profile-total-packs");
  const profileCups = document.getElementById("profile-cups");
  if (profileCoins) profileCoins.textContent = coins;
  if (profilePacks) profilePacks.textContent = totalOpened;
  if (profileCups) profileCups.textContent = cups;
  renderCollectionRewards();
}

function checkBankruptcy() {
  const minCost = packTypes.standard.cost;
  const totalCardsValue = players.reduce(
    (sum, p) => sum + (inventory[p.id]?.count || 0) * p.price,
    0,
  );
  if (coins + totalCardsValue < minCost) {
    document.getElementById("final-pack-score").textContent = totalOpened;
    openModal("gameover-modal");
  }
}

function initSlots() {
  renderCollectionRewards();
  const grid = document.getElementById("collection-grid");
  grid.innerHTML = "";
  const searchText = collectionSearchTerm.trim().toLocaleLowerCase("ru");
  const showCoachView = activeFilter === "Тренер";
  const includeCoachCard = showCoachView || activeFilter === "all";
  const coachSearchFields = [
    "тренер coach эксклюзив",
    ...EXCLUSIVE_COACHES.flatMap((coach) => [
      coach.name,
      coach.title,
      coach.country,
      coach.searchTerms,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("ru");
  grid.classList.toggle("coach-only", showCoachView);

  // 1. Фильтрация по лиге или позициям
  let filtered = players.filter((p) => {
    if (showCoachView) return false;

    const searchableFields = [p.name, p.club, p.league, p.pos]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ru");
    if (searchText && !searchableFields.includes(searchText)) return false;

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
      return ["CM", "CDM", "RCM", "CAM"].includes(playerPos);
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

  if (includeCoachCard && (!searchText || coachSearchFields.includes(searchText))) {
    EXCLUSIVE_COACHES.forEach((coach, index) => {
      const coachFields = [
        coach.name,
        coach.title,
        coach.country,
        coach.searchTerms,
        "тренер coach эксклюзив",
      ]
        .join(" ")
        .toLocaleLowerCase("ru");
      if (!searchText || coachFields.includes(searchText)) {
        renderExclusiveCoachCard(grid, coach, index);
      }
    });
  } else if (showCoachView) {
    const emptyState = document.createElement("p");
    emptyState.className = "coach-empty-state";
    emptyState.textContent = "По запросу тренеры не найдены.";
    grid.appendChild(emptyState);
  }
}

function renderExclusiveCoachCard(container, coach, index) {
  const coachCard = document.createElement("article");
  const owned = hasExclusiveCoach;
  coachCard.className = `exclusive-coach-card ${owned ? "is-owned" : "is-locked"}`;
  coachCard.setAttribute(
    "aria-label",
    owned
      ? `${coach.name}, эксклюзивный тренер, карточка получена`
      : `${coach.name}, эксклюзивный тренер, доступ закрыт`,
  );
  const isSpanishCoach = coach.id === "pep-guardiola";
  const flagMarkup = isSpanishCoach
    ? `<svg class="coach-country-flag" viewBox="0 0 24 16" role="img" aria-label="Флаг Испании">
        <rect width="24" height="16" rx="2" fill="#AA151B" />
        <path fill="#F1BF00" d="M0 4h24v8H0z" />
        <path fill="#AA151B" d="M5.2 5.1h3.2v5.8H5.2z" />
        <path fill="#F1BF00" d="M5.8 5.8h2v4.4h-2z" />
      </svg>`
    : `<svg class="coach-country-flag" viewBox="0 0 24 16" role="img" aria-label="Флаг Шотландии">
        <rect width="24" height="16" rx="2" fill="#005EB8" />
        <path d="M0 0l24 16M24 0L0 16" stroke="#fff" stroke-width="3.2" />
      </svg>`;
  const photoCredit = coach.photoCredit
    ? `<p class="coach-photo-credit"><a href="${coach.photoCreditUrl}" target="_blank" rel="noopener noreferrer">Фото: ${coach.photoCredit}</a></p>`
    : "";
  coachCard.innerHTML = `
    <div class="coach-card-topline">
      <span class="coach-card-edition">EXCLUSIVE · ${index + 1}/${EXCLUSIVE_COACHES.length}</span>
      <span class="coach-card-state">${owned ? "ПОЛУЧЕНА" : "ЗАКРЫТА"}</span>
    </div>
    <div class="coach-card-art" aria-hidden="true">
      <svg class="coach-tactics-board" viewBox="0 0 180 118" fill="none">
        <rect x="13" y="8" width="154" height="102" rx="14" />
        <path d="M90 9v100M14 59h152M58 9v24h64V9M58 109V85h64v24" />
        <circle cx="90" cy="59" r="16" />
        <path d="M35 34l17 10m93-10-17 10M35 84l17-10m93 10-17-10" />
        <circle class="coach-tactic-dot" cx="52" cy="44" r="4" />
        <circle class="coach-tactic-dot" cx="128" cy="44" r="4" />
        <circle class="coach-tactic-dot" cx="52" cy="74" r="4" />
        <circle class="coach-tactic-dot" cx="128" cy="74" r="4" />
      </svg>
      <img
        class="coach-card-portrait"
        src="${coach.portrait}"
        alt="${coach.name}"
        loading="lazy"
        onerror="this.hidden=true; this.nextElementSibling.hidden=false"
      />
      <span class="coach-card-monogram" hidden>${coach.initials}</span>
      <span class="coach-card-rating"><strong>99</strong><small>COACH</small></span>
      ${owned ? "" : '<span class="coach-card-lock" aria-label="Закрыто">🔒</span>'}
    </div>
    <div class="coach-card-copy">
      <span class="coach-card-role">${coach.title}</span>
      <h4>${coach.name}</h4>
      <p class="coach-country-line">
        ${flagMarkup}
        <span>${coach.country} · Коллекционная серия</span>
      </p>
      ${photoCredit}
    </div>
  `;
  container.appendChild(coachCard);
}

function renderCollectionRewards() {
  const container = document.getElementById("collection-rewards");
  if (!container) return;

  const collectedCount = players.filter(
    (player) => (inventory[player.id]?.count || 0) > 0,
  ).length;

  container.innerHTML = `
    <div class="collection-rewards-heading">
      <div>
        <h4>Награды коллекции</h4>
        <p>Разные футболисты: ${collectedCount} из ${players.length}. Дубли и тренер не учитываются.</p>
      </div>
      <span class="collection-rewards-count">${claimedCollectionRewards.length}/${collectionRewardDefinitions.length}</span>
    </div>
    <div class="collection-rewards-grid">
      ${collectionRewardDefinitions
        .map((reward) => {
          const target = reward.fullCollection ? players.length : reward.target;
          const claimed = claimedCollectionRewards.includes(reward.id);
          const ready = collectedCount >= target;
          const progress = Math.min(100, Math.round((collectedCount / target) * 100));
          const title = reward.fullCollection ? "Вся коллекция" : `${target} игроков`;
          const buttonLabel = claimed
            ? "Получено"
            : ready
              ? "Забрать"
              : `Собери ${target}`;

          return `
            <article class="collection-reward-card${claimed ? " is-claimed" : ""}${ready && !claimed ? " is-ready" : ""}">
              <div class="collection-reward-topline">
                <h5>${title}</h5>
                <span>+${reward.reward}$</span>
              </div>
              <div
                class="collection-reward-progress"
                role="progressbar"
                aria-label="${title}"
                aria-valuemin="0"
                aria-valuemax="${target}"
                aria-valuenow="${Math.min(collectedCount, target)}"
              >
                <span style="width: ${progress}%"></span>
              </div>
              <p>${Math.min(collectedCount, target)} / ${target}</p>
              <button
                class="collection-reward-claim"
                type="button"
                data-collection-reward="${reward.id}"
                ${claimed || !ready || collectionRewardClaimInProgress ? "disabled" : ""}
              >
                ${buttonLabel}
              </button>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  container.querySelectorAll("[data-collection-reward]").forEach((button) => {
    button.addEventListener("click", () => {
      claimCollectionReward(button.dataset.collectionReward);
    });
  });
}

async function claimCollectionReward(rewardId) {
  if (collectionRewardClaimInProgress) return;

  const reward = collectionRewardDefinitions.find(
    (item) => item.id === rewardId,
  );
  if (!reward || claimedCollectionRewards.includes(reward.id)) return;

  const target = reward.fullCollection ? players.length : reward.target;
  const collectedCount = players.filter(
    (player) => (inventory[player.id]?.count || 0) > 0,
  ).length;
  if (collectedCount < target) return;

  collectionRewardClaimInProgress = true;
  try {
    const result = await executeGameAction("claimCollectionReward", { rewardId });
    playSound("reward");
    showToast(`Награда за коллекцию получена: +${result.reward}$!`);
  } catch (error) {
    showToast(error.message || "Не удалось получить награду за коллекцию.", "error");
  } finally {
    collectionRewardClaimInProgress = false;
  }
  updateUI();
}

function appendPlayerPhotoCredit(container, player, className) {
  if (
    !container ||
    !player?.photoCredit ||
    !player?.photoCreditUrl ||
    !player?.photoLicense ||
    !player?.photoLicenseUrl
  ) {
    return;
  }

  const credit = document.createElement("small");
  credit.className = className;

  const sourceLink = document.createElement("a");
  sourceLink.href = player.photoCreditUrl;
  sourceLink.target = "_blank";
  sourceLink.rel = "noopener noreferrer";
  sourceLink.textContent = player.photoCredit;

  const licenseLink = document.createElement("a");
  licenseLink.href = player.photoLicenseUrl;
  licenseLink.target = "_blank";
  licenseLink.rel = "noopener noreferrer";
  licenseLink.textContent = player.photoLicense;

  credit.append(
    document.createTextNode("Фото: "),
    sourceLink,
    document.createTextNode(" · "),
    licenseLink,
  );
  container.appendChild(credit);
}

function renderSlot(player) {
  const item = inventory[player.id];
  const slot = document.getElementById(`slot-${player.id}`);
  if (!slot) return;

  if ((item?.count || 0) > 0) {
    // 1. Определяем класс редкости для коллекции
    let rarityClass = "card-bronze";

    // Сначала проверяем, Икона ли это (чтобы дать ИМБА-фон)
    if (player.league === "Icon" || player.league === "Legend") {
      rarityClass = "card-icon-style";
    }
    // Если не Икона, то смотрим на рейтинг
    else if (player.raiting >= 90) {
      rarityClass = "card-legend"; // Фиолетовый Walkout
    } else if (player.raiting >= 86) {
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

    slot.replaceChildren();
    const rating = document.createElement("span");
    rating.className = "mini-card-rating";
    rating.textContent = String(player.raiting ?? "?");
    slot.appendChild(rating);

    if (item.count > 1) {
      const count = document.createElement("span");
      count.className = "mini-card-count";
      count.textContent = `x${item.count}`;
      slot.appendChild(count);
    }

    const photo = document.createElement("img");
    photo.className = "mini-card-photo";
    photo.src = getSafeImageUrl(player.photo);
    photo.alt = player.name || "Карточка футболиста";
    photo.loading = "lazy";
    slot.appendChild(photo);

    const name = document.createElement("span");
    name.className = "mini-card-name";
    name.textContent = player.name || "Неизвестный игрок";
    slot.appendChild(name);
    appendPlayerPhotoCredit(slot, player, "mini-card-photo-credit");

    const sellButton = document.createElement("button");
    sellButton.className = "mini-card-sell-btn";
    sellButton.type = "button";
    sellButton.textContent = `Продать (+${player.price}$)`;
    sellButton.addEventListener("click", () => sellFromCollection(player.id));
    slot.appendChild(sellButton);
  } else {
    slot.className = "mini-card slot-locked";
    const icon = document.createElement("div");
    icon.className = "mini-placeholder-icon";
    icon.textContent = "🔒";
    const text = document.createElement("div");
    text.className = "mini-placeholder-text";
    text.textContent = "Не открыт";
    slot.replaceChildren(icon, text);
  }
}

window.sellFromCollection = async function (playerId) {
  const player = players.find((p) => p.id === playerId);
  if (!player || !inventory[playerId] || inventory[playerId].count <= 0) return;
  try {
    await executeGameAction("sellCard", { playerId });
    playSound("sell");
    renderSlot(players.find((item) => item.id === playerId) || player);
    renderSquad();
    renderSquadPicker();
    checkBankruptcy();
  } catch (error) {
    showToast(error.message || "Не удалось продать карточку.", "error");
  }
};

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    if (btn.dataset.filter) {
      activeFilter = btn.dataset.filter;
      currentSort = null;
    } else if (btn.dataset.sort) {
      currentSort = btn.dataset.sort;
    }
    initSlots();
  });
});

let collectionSearchTimeout = null;
document
  .getElementById("collection-search-input")
  .addEventListener("input", (event) => {
    collectionSearchTerm = event.currentTarget.value;
    clearTimeout(collectionSearchTimeout);
    collectionSearchTimeout = setTimeout(initSlots, 140);
  });

function getQuestProgress(quest) {
  if (quest.type === "packs") return totalOpened;
  if (quest.type === "elite_streak") return eliteStreak;
  if (quest.type === "unique_players") {
    return players.filter((player) => inventory[player.id]?.count > 0).length;
  }
  if (quest.type === "madrid") {
    return players
      .filter((player) => player.club === "Real Madrid")
      .reduce((sum, player) => sum + (inventory[player.id]?.count || 0), 0);
  }
  if (quest.type === "stars") {
    return players
      .filter((player) => player.raiting >= 90)
      .reduce((sum, player) => sum + (inventory[player.id]?.count || 0), 0);
  }
  if (quest.type === "coins") return coins;
  return 0;
}

function getLocalDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getActiveSquadPlayers() {
  const usedPlayerIds = new Set();

  return Object.values(squad)
    .map((playerId) => players.find((player) => player.id === playerId))
    .filter((player) => {
      if (
        !player ||
        usedPlayerIds.has(player.id) ||
        (inventory[player.id]?.count || 0) < 1
      ) {
        return false;
      }
      usedPlayerIds.add(player.id);
      return true;
    });
}

const dailyChallengeDefinitions = [
  {
    id: "full-squad",
    title: "Основной состав",
    description: "Заполни все 11 мест разными карточками.",
    progressLabel: "Игроков в составе",
    target: 11,
    reward: 800,
    getProgress: (activePlayers) => activePlayers.length,
  },
  {
    id: "attack-line",
    title: "Атакующая тройка",
    description: "Поставь в состав четыре атакующие карточки.",
    progressLabel: "Атакующих в составе",
    target: 4,
    reward: 500,
    getProgress: (activePlayers) =>
      activePlayers.filter((player) =>
        ["ST", "LW", "RW", "CAM"].includes(
          String(player.pos || "").toUpperCase(),
        ),
      ).length,
  },
  {
    id: "defensive-wall",
    title: "Стена обороны",
    description: "Поставь в состав пять защитников или вратарей.",
    progressLabel: "Защитников и вратарей",
    target: 5,
    reward: 600,
    getProgress: (activePlayers) =>
      activePlayers.filter((player) =>
        ["GK", "CB", "LB", "RB"].includes(
          String(player.pos || "").toUpperCase(),
        ),
      ).length,
  },
  {
    id: "star-lineup",
    title: "Звёздный состав",
    description: "Собери в стартовом составе четыре карточки с рейтингом 86+.",
    progressLabel: "Карточек с рейтингом 86+",
    target: 4,
    reward: 700,
    getProgress: (activePlayers) =>
      activePlayers.filter((player) => player.raiting >= 86).length,
  },
  {
    id: "club-link",
    title: "Клубная связка",
    description: "Поставь в состав пять игроков из одного клуба.",
    progressLabel: "Игроков из лучшей клубной связки",
    target: 5,
    reward: 650,
    getProgress: (activePlayers) => getLargestSquadGroup(activePlayers, "club"),
  },
  {
    id: "league-link",
    title: "Лига под контролем",
    description: "Поставь в состав шесть игроков из одной лиги.",
    progressLabel: "Игроков из лучшей лиговой связки",
    target: 6,
    reward: 650,
    getProgress: (activePlayers) =>
      getLargestSquadGroup(activePlayers, "league"),
  },
];

function getLargestSquadGroup(activePlayers, property) {
  const counts = new Map();
  activePlayers.forEach((player) => {
    const group = String(player[property] || "").trim();
    if (group && group !== "Icon" && group !== "Legend") {
      counts.set(group, (counts.get(group) || 0) + 1);
    }
  });
  return Math.max(0, ...counts.values());
}

function getTodayDailyChallenge() {
  const now = new Date();
  const dayNumber = Math.floor(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) / 86400000,
  );
  const challenge =
    dailyChallengeDefinitions[
      ((dayNumber % dailyChallengeDefinitions.length) +
        dailyChallengeDefinitions.length) %
        dailyChallengeDefinitions.length
    ];

  return { ...challenge, dateKey: getLocalDateKey(now) };
}

function renderDailyChallenge() {
  const container = document.getElementById("daily-challenge-card");
  if (!container) return;

  const challenge = getTodayDailyChallenge();
  const progress = challenge.getProgress(getActiveSquadPlayers());
  const shownProgress = Math.min(progress, challenge.target);
  const isClaimed = dailyChallengeClaimedDate === challenge.dateKey;
  const canClaim = !isClaimed && progress >= challenge.target;
  const progressPercent = Math.min(
    100,
    Math.round((shownProgress / challenge.target) * 100),
  );
  const buttonLabel = isClaimed
    ? "Награда получена"
    : canClaim
      ? `Забрать +${challenge.reward}$`
      : "Выполни цель";

  container.innerHTML = `
    <div class="daily-challenge-heading">
      <span class="daily-challenge-badge">⚡ ЗАДАНИЕ ДНЯ</span>
      <span class="daily-challenge-refresh">Обновляется ежедневно</span>
    </div>
    <h4>${escapeHtml(challenge.title)}</h4>
    <p>${escapeHtml(challenge.description)}</p>
    <div class="daily-challenge-progress" role="progressbar" aria-label="${escapeHtml(challenge.progressLabel)}" aria-valuemin="0" aria-valuemax="${challenge.target}" aria-valuenow="${shownProgress}">
      <span style="width: ${progressPercent}%"></span>
    </div>
    <div class="daily-challenge-footer">
      <span>${escapeHtml(challenge.progressLabel)}: <b>${shownProgress}/${challenge.target}</b></span>
      <button id="daily-challenge-claim" class="claim-btn" type="button" ${canClaim ? "" : "disabled"}>${buttonLabel}</button>
    </div>
  `;

  const claimButton = document.getElementById("daily-challenge-claim");
  if (claimButton) {
    claimButton.addEventListener("click", () => {
      window.claimDailyChallenge();
    });
  }
}

function renderQuests() {
  renderDailyChallenge();
  const list = document.getElementById("quests-list");
  list.innerHTML = "";
  questDefinitions.forEach((q) => {
    const isCompleted = completedQuests.includes(q.id);
    const progress = getQuestProgress(q);
    const canClaim = !isCompleted && progress >= q.target;
    const div = document.createElement("div");
    div.className = "quest-item";
    div.innerHTML = `
      <div class="quest-info">
        <h4>${escapeHtml(q.title)}</h4>
        <p>${escapeHtml(q.desc)} (${Math.min(progress, q.target)}/${q.target})</p>
        <div style="color: #34d399; font-weight: bold; font-size: 12px;">+${q.reward}$ · +1 🏆</div>
      </div>
      <button class="claim-btn" ${canClaim ? "" : "disabled"} onclick="claimQuest('${escapeHtml(q.id)}')">
        ${isCompleted ? "Получено" : "Забрать"}
      </button>
    `;
    list.appendChild(div);
  });
}

window.claimQuest = async function (id) {
  const quest = questDefinitions.find((item) => item.id === id);
  if (!quest || completedQuests.includes(quest.id)) return;
  if (getQuestProgress(quest) < quest.target) return;

  try {
    await executeGameAction("claimQuest", { questId: id });
    playSound("reward");
    renderQuests();
    showToast(`Задание выполнено! +${quest.reward}$ и +1 🏆`);
  } catch (error) {
    showToast(error.message || "Не удалось получить награду.", "error");
  }
};

window.claimDailyChallenge = async function () {
  const challenge = getTodayDailyChallenge();
  if (dailyChallengeClaimedDate === challenge.dateKey) return;

  const progress = challenge.getProgress(getActiveSquadPlayers());
  if (progress < challenge.target) return;
  try {
    const result = await executeGameAction("claimDailyChallenge");
    playSound("reward");
    renderQuests();
    showToast(`Задание дня выполнено! +${result.reward}$ и +1 🏆`);
  } catch (error) {
    showToast(error.message || "Не удалось получить награду.", "error");
  }
};

window.removeFromSquad = async function (event, pos) {
  event.stopPropagation();
  try {
    await executeGameAction("setSquadSlot", { position: pos, playerId: null });
    renderSquad();
    renderSquadPicker();
  } catch (error) {
    showToast(error.message || "Не удалось изменить состав.", "error");
  }
};

function renderSquad() {
  let squadPlayers = []; // Массив для сбора всех игроков на поле

  Object.keys(squad).forEach((pos) => {
    const slotEl = document.getElementById(`slot-${pos}`);
    if (!slotEl) return;
    const p = players.find((x) => x.id === squad[pos]);
    if (!p || (inventory[p.id]?.count || 0) < 1) squad[pos] = null;
    const activePlayer = p && inventory[p.id]?.count > 0 ? p : null;
    slotEl.tabIndex = 0;

    if (selectedPitchPos === pos) slotEl.classList.add("active-slot");
    else slotEl.classList.remove("active-slot");

    if (activePlayer) {
      slotEl.setAttribute("role", "group");
      slotEl.setAttribute("aria-label", `${pos}, ${activePlayer.name}, рейтинг ${activePlayer.raiting}. Выбрать позицию`);
      slotEl.classList.add("occupied");
      slotEl.innerHTML = `<div style="font-size:8px;">${escapeHtml(pos)}</div><div>${escapeHtml(getShortName(activePlayer.name))}</div><div>${escapeHtml(activePlayer.raiting)}</div><button class="slot-remove-btn" type="button" aria-label="Убрать игрока" onclick="removeFromSquad(event, '${escapeHtml(pos)}')">✕</button>`;

      squadPlayers.push(activePlayer); // Добавляем игрока в массив для умного подсчета
    } else {
      slotEl.setAttribute("role", "button");
      slotEl.setAttribute("aria-label", `Выбрать позицию ${pos}`);
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

  document.getElementById("squad-ovr").textContent =
    calculateSquadOverall(squadPlayers);
}

function calculateSquadOverall(squadPlayers) {
  if (!squadPlayers.length) return 0;

  const sum = squadPlayers.reduce((total, player) => total + player.raiting, 0);
  const baseAverage = Math.floor(sum / squadPlayers.length);
  const starBonus = squadPlayers.reduce(
    (total, player) =>
      total + Math.max(0, player.raiting - baseAverage),
    0,
  );

  return Math.min(99, baseAverage + Math.round(starBonus / 8));
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
    div.setAttribute("role", "button");
    div.tabIndex = 0;
    div.setAttribute("aria-label", `Поставить ${p.name}, позиция ${p.pos}`);
    div.innerHTML = `<b>${escapeHtml(getShortName(p.name))}</b> (${escapeHtml(p.raiting)})<br><small>${escapeHtml(p.pos)}</small>`;
    div.onclick = async () => {
      if (!selectedPitchPos) {
        // Используем красивый тост вместо старого alert
        showToast("Сначала нажми на позицию на поле!", "error");
        return;
      }
      const position = selectedPitchPos;
      try {
        await executeGameAction("setSquadSlot", { position, playerId: p.id });
        selectedPitchPos = null;
        document.getElementById("selected-pos-label").textContent = "Нажми на позицию";
        renderSquad();
        renderSquadPicker();
      } catch (error) {
        showToast(error.message || "Не удалось изменить состав.", "error");
      }
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
      } else if (p.raiting >= 86) {
        rarityClass = "card-elite"; // Синие
      } else if (p.raiting >= 75) {
        rarityClass = "card-gold"; // Золотые
      } else if (p.raiting >= 65) {
        rarityClass = "card-silver"; // Серебро
      }

      const div = document.createElement("div");
      div.className = `mini-card ${rarityClass}`;

      div.innerHTML = `
        <span class="mini-card-rating">${escapeHtml(p.raiting)}</span>
        <img class="mini-card-photo" src="${escapeHtml(getSafeImageUrl(p.photo))}" alt="${escapeHtml(p.name)}" loading="lazy">
        <span class="mini-card-name">${escapeHtml(p.name)}</span>
      `;
      const buyButton = document.createElement("button");
      buyButton.id = `buy-btn-${p.id}`;
      buyButton.className = "market-buy-btn";
      buyButton.type = "button";
      buyButton.disabled = coins < cost;
      buyButton.textContent = `Купить ${cost}$`;
      buyButton.addEventListener("click", () => buyMarket(p.id));
      div.appendChild(buyButton);
      grid.appendChild(div);
    });
}

window.buyMarket = async function (id) {
  const player = players.find((item) => item.id === id);
  if (!player || player.league === "Icon" || player.league === "Legend") return;
  const cost = Number(player.price) * 5;
  if (!Number.isFinite(cost) || cost < 0) {
    showToast("У этой карточки указана неверная цена.", "error");
    return;
  }
  try {
    await executeGameAction("buyMarket", { playerId: id });
    playSound("reward");
    renderMarket();
    checkBankruptcy();
    showToast(`${player.name} добавлен в коллекцию.`);
  } catch (error) {
    showToast(error.message || "Не удалось купить карточку.", "error");
  }
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
      if (!p) {
        sbcBurnList.splice(i, 1);
        i--;
        continue;
      }
      slot.classList.add("filled");
      slot.setAttribute("role", "button");
      slot.tabIndex = 0;
      slot.setAttribute("aria-label", `Убрать ${p.name} из сборки`);
      slot.innerHTML = `
        <img src="${escapeHtml(getSafeImageUrl(p.photo))}" alt="${escapeHtml(p.name)}" style="width: 55px; height: 55px; object-fit: contain; margin-bottom: 5px;">
        <div style="font-size: 18px; font-weight: 900; color: #fff;">${escapeHtml(p.raiting)}</div>
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
      p.league !== "Icon" &&
      p.league !== "Legend",
  );
  avail.forEach((p) => {
    const div = document.createElement("div");
    div.className = "squad-picker-card";
    div.setAttribute("role", "button");
    div.tabIndex = 0;
    div.setAttribute("aria-label", `Добавить ${p.name} в сборку`);
    div.innerHTML = `<b>${escapeHtml(getShortName(p.name))}</b> (${escapeHtml(p.raiting)})`;
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

document.getElementById("sbc-submit-btn").onclick = async () => {
  // Находим трех игроков, которых игрок положил в слоты сжигания
  const burnedPlayers = sbcBurnList
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean);

  // Если вдруг в слотах меньше 3 игроков, прерываемся
  if (
    sbcBurnList.length !== 3 ||
    burnedPlayers.length !== 3 ||
    new Set(sbcBurnList).size !== 3 ||
    sbcBurnList.some((id) => !inventory[id] || inventory[id].count < 1)
  ) {
    showToast("Выбери три доступные карточки для обмена.", "error");
    return;
  }

  const playerIds = [...sbcBurnList];
  const submitButton = document.getElementById("sbc-submit-btn");
  submitButton.disabled = true;
  try {
    const result = await executeGameAction("exchangeSbc", { playerIds });
    sbcBurnList = [];
    closeModal("sbc-modal");
    renderSBC();
    renderSBCPicker();
    renderSquad();
    renderSquadPicker();
    revealCard(result.player, true, false);
  } catch (error) {
    showToast(error.message || "Не удалось выполнить обмен.", "error");
    submitButton.disabled = sbcBurnList.length < 3;
  }
};

const btn = document.getElementById("btn");
const pack = document.getElementById("pack");
const card = document.getElementById("card");
const sellBtn = document.getElementById("sell-btn");

pack.addEventListener("click", () => {
  if (!packOpenInProgress && !btn.disabled) btn.click();
});

document.querySelectorAll(".pack-tab[data-pack]").forEach((tab) => {
  tab.onclick = () => {
    if (packOpenInProgress) return;
    document
      .querySelectorAll(".pack-tab[data-pack]")
      .forEach((t) => {
        t.classList.remove("active");
        t.setAttribute("aria-pressed", "false");
      });
    tab.classList.add("active");
    tab.setAttribute("aria-pressed", "true");
    currentPackType = tab.dataset.pack;
    tab.closest(".pack-selector")?.classList.toggle(
      "is-elite",
      currentPackType === "elite",
    );
    pack.setAttribute(
      "aria-label",
      currentPackType === "elite" ? "Открыть элитный пак" : "Открыть обычный пак",
    );
    document.getElementById("pack").className =
      currentPackType === "elite" ? "pack-box elite-pack" : "pack-box";
    document.getElementById("pack-icon").textContent =
      currentPackType === "elite" ? "⭐" : "📦";
    document.getElementById("pack-name").textContent =
      currentPackType === "elite" ? "Элитный пак" : "Обычный пак";
    updateUI();
  };
});

btn.onclick = async () => {
  if (packOpenInProgress || coins < packTypes[currentPackType].cost) return;

  const selectedPackType = currentPackType;
  const selectedPack = packTypes[selectedPackType];
  if (!selectedPack) return;
  packOpenInProgress = true;
  playSound("pack-open");
  startPackRattle();
  document
    .querySelectorAll(".pack-tab[data-pack]")
    .forEach((tab) => (tab.disabled = true));
  updateUI();
  sellBtn.style.display = "none";
  card.style.display = "none";
  pack.style.display = "flex";
  pack.classList.add("shake");

  try {
    const result = await executeGameAction("openPack", { packType: selectedPackType });
    const dropped = result.player;
    if (!dropped) throw new Error("Сервер не вернул выпавшую карточку.");
    setTimeout(() => {
    pack.classList.remove("shake");
      revealCard(dropped, dropped.raiting >= 90 || dropped.league === "Icon", true);
    }, 700);
  } catch (error) {
    stopPackRattle();
    pack.classList.remove("shake");
    packOpenInProgress = false;
    document
      .querySelectorAll(".pack-tab[data-pack]")
      .forEach((tab) => (tab.disabled = false));
    pack.style.display = "flex";
    showToast(error.message || "Не удалось открыть пак.", "error");
    updateUI();
  }
};

function revealCard(player, isWalkout, countAsPack = true) {
  if (!player) {
    showToast("Не удалось показать карточку. Попробуй ещё раз.", "error");
    return;
  }
  pack.style.display = "none";
  lastDroppedPlayer = player;

  const finishReveal = () => {
    playSound("reveal");
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
    <div class="card-rating">${escapeHtml(player.raiting)}</div>
  </div>
  <img class="card-photo" src="${escapeHtml(getSafeImageUrl(player.photo))}" alt="${escapeHtml(player.name)}">
  <div class="card-bottom">
    <div class="card-name">${escapeHtml(player.name)}</div>
    <div class="card-details">
      <span class="card-pos-badge">${escapeHtml(player.pos)}</span>
      <span class="card-club-text">${escapeHtml(player.club)}</span>
    </div>
  </div>
`;
    appendPlayerPhotoCredit(
      card.querySelector(".card-bottom"),
      player,
      "card-photo-credit",
    );
    card.style.display = "flex";

    sellBtn.textContent = `Продать (+${player.price}$)`;
    sellBtn.style.display = "inline-block";

    if (countAsPack) {
      packOpenInProgress = false;
      document
        .querySelectorAll(".pack-tab[data-pack]")
        .forEach((tab) => (tab.disabled = false));
    }
    updateUI();
    checkBankruptcy();
  };

  if (isWalkout) {
    playSound("walkout");
    document.getElementById("walkout-overlay").style.display = "flex";
    setTimeout(() => {
      document.getElementById("walkout-overlay").style.display = "none";
      stopPackRattle();
      finishReveal();
    }, 900);
  } else {
    stopPackRattle();
    finishReveal();
  }
}

sellBtn.onclick = async () => {
  if (
    !lastDroppedPlayer ||
    !inventory[lastDroppedPlayer.id] ||
    inventory[lastDroppedPlayer.id].count <= 0
  ) return;
  const playerId = lastDroppedPlayer.id;
  try {
    await executeGameAction("sellCard", { playerId });
    playSound("sell");
    if (!(inventory[playerId]?.count > 0)) {
      renderSquad();
      renderSquadPicker();
    }
    sellBtn.style.display = "none";
    card.style.display = "none";
    pack.style.display = "flex";
    checkBankruptcy();
  } catch (error) {
    showToast(error.message || "Не удалось продать карточку.", "error");
  }
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
  openModal("collection-modal");
};

document.getElementById("open-quests-btn").onclick = () => {
  renderQuests();
  openModal("quests-modal");
};

document.getElementById("open-squad-btn").onclick = () => {
  // playSound('click')
  renderSquad();
  renderSquadPicker();
  openModal("squad-modal");
};

document.getElementById("open-market-btn").onclick = () => {
  renderMarket();
  openModal("market-modal");
};

document.getElementById("open-sbc-btn").onclick = () => {
  sbcBurnList = [];
  renderSBC();
  renderSBCPicker();
  openModal("sbc-modal");
};

// Функция скачивания Топа из облака
async function loadLeaderboard(sortBy = "totalOpened") {
  const list = document.getElementById("leaderboard-list");
  const loading = document.createElement("div");
  loading.style.cssText = "text-align:center; padding:20px;";
  loading.textContent = "Загрузка... ⏳";
  list.replaceChildren(loading);

  try {
    const q = query(
      collection(db, "leaderboard"),
      orderBy(sortBy, "desc"),
      limit(10),
    );
    const querySnapshot = await getDocs(q);

    list.replaceChildren();
    let rank = 1;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const scoreValue = Number(data[sortBy]);
      const score = Number.isFinite(scoreValue) ? scoreValue : 0;
      const icon = sortBy === "totalOpened" ? "📦" : "🏆";
      const row = document.createElement("div");
      row.className = "leader-row";
      const name = document.createElement("span");
      name.style.cssText = "flex:1; color:#fff;";
      name.textContent = `#${rank} ${data.nickname || "Аноним"}`;
      const points = document.createElement("span");
      points.style.cssText = "color:#38bdf8; font-weight:bold;";
      points.textContent = `${score} ${icon}`;
      row.append(name, points);
      list.appendChild(row);
      rank++;
    });

    if (rank === 1) {
      const empty = document.createElement("div");
      empty.style.cssText = "text-align:center; padding:20px; color:#94a3b8;";
      empty.textContent = "Пока нет результатов.";
      list.appendChild(empty);
    }
  } catch (error) {
    console.error("Ошибка загрузки топа:", error);
    const message = document.createElement("div");
    message.style.cssText = "color:#ef4444; text-align:center;";
    message.textContent = "Не удалось загрузить рейтинг. Попробуй позже.";
    list.replaceChildren(message);
  }
}

// Открытие окна и переключение вкладок
document.getElementById("open-leaderboard-btn").onclick = () => {
  openModal("leaderboard-modal");
  loadLeaderboard("totalOpened"); // По умолчанию грузим паки
};

document.getElementById("tab-packs").onclick = (e) => {
  document
    .querySelectorAll("#leaderboard-modal .pack-tab")
    .forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
  e.currentTarget.classList.add("active");
  e.currentTarget.setAttribute("aria-pressed", "true");
  document
    .querySelector("#leaderboard-modal .pack-selector")
    ?.classList.remove("is-cups");
  loadLeaderboard("totalOpened");
};

document.getElementById("tab-cups").onclick = (e) => {
  document
    .querySelectorAll("#leaderboard-modal .pack-tab")
    .forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
  e.currentTarget.classList.add("active");
  e.currentTarget.setAttribute("aria-pressed", "true");
  document
    .querySelector("#leaderboard-modal .pack-selector")
    ?.classList.add("is-cups");
  loadLeaderboard("cups");
};

document.getElementById("save-score-btn").onclick = resetAllProgress;

const resetModal = document.getElementById("reset-modal");
document.getElementById("reset-btn").onclick = () => {
  openModal(resetModal);
  // playSound('click')
};
document.getElementById("cancel-reset-btn").onclick = () => {
  closeModal(resetModal);
  // playSound('click')
};

// Универсальная функция сброса прогресса (и локально, и в облаке)
async function resetAllProgress() {
  try {
    await executeGameAction("resetProgress");
    clearLocalData();
  } catch (error) {
    showToast(error.message || "Не удалось сбросить прогресс.", "error");
  }
}

// Вспомогательная функция, чтобы не писать удаление по сто раз
function clearLocalData() {
  [
    "cards_coins",
    "cards_totalOpened",
    "cards_eliteStreak",
    "cards_cups",
    "cards_inventory",
    "cards_squad",
    "cards_completed_quests",
    "cards_leaderboard",
  ].forEach(safeStorageRemove);
  location.reload();
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

async function hasAdminClaim(forceRefresh = false, expectedUser = auth.currentUser) {
  if (!expectedUser || auth.currentUser?.uid !== expectedUser.uid) return false;
  try {
    const token = await expectedUser.getIdTokenResult(forceRefresh);
    return auth.currentUser?.uid === expectedUser.uid && token.claims.admin === true;
  } catch (error) {
    console.error("Не удалось проверить права администратора:", error);
    return false;
  }
}

document.getElementById("admin-submit-btn").onclick = async () => {
  const adminUser = auth.currentUser;
  if (!(await hasAdminClaim(true, adminUser)) || auth.currentUser?.uid !== adminUser?.uid) {
    showToast("Для этого действия нужны права администратора.", "error");
    return;
  }

  const weightStandard =
    parseFloat(document.getElementById("admin-weight-standard").value) || 0;
  const weightElite =
    parseFloat(document.getElementById("admin-weight-elite").value) || 0;
  const name = document.getElementById("admin-name").value.trim();
  const raiting = Number(document.getElementById("admin-raiting").value);
  const club = document.getElementById("admin-club").value.trim();
  const league = document.getElementById("admin-league").value.trim();
  const pos = document.getElementById("admin-pos").value.trim();
  const price = Number(document.getElementById("admin-price").value);
  const photo = getSafeImageUrl(document.getElementById("admin-photo").value.trim());
  const photoProtocol = photo ? new URL(photo).protocol : "";

  if (
    !name || name.length > 60 ||
    !Number.isInteger(raiting) ||
    raiting < 1 ||
    raiting > 99 ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    price > 1_000_000_000 ||
    !club || club.length > 60 ||
    !league || league.length > 60 ||
    !pos || pos.length > 12 ||
    !photo || photo.length > 2048 ||
    photoProtocol !== "https:" ||
    !Number.isFinite(weightStandard) ||
    weightStandard < 0 ||
    weightStandard > 100_000 ||
    !Number.isFinite(weightElite) ||
    weightElite < 0 ||
    weightElite > 100_000
  ) {
    return showToast("Заполни все поля и проверь ограничения: рейтинг 1–99, HTTPS-фото и шансы от 0 до 100 000.", "error");
  }

  const id = getPlayerIdFromName(name);
  if (!id || id.length > 100) {
    return showToast("Не удалось создать короткий ID карточки из этого имени.", "error");
  }
  if (builtInPlayerIds.has(id)) {
    return showToast("Это имя занято встроенной карточкой.", "error");
  }

  const customPlayer = {
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
  };

  try {
    if (
      !adminUser ||
      !(await hasAdminClaim(true, adminUser)) ||
      auth.currentUser?.uid !== adminUser.uid
    ) {
      throw new Error("Права администратора больше не подтверждены. Войди снова и повтори действие.");
    }
    await setDoc(doc(db, "players", id), {
      ...customPlayer,
      updatedAt: Date.now(),
    });
    const existingIndex = players.findIndex((player) => player.id === id);
    if (existingIndex === -1) players.push(customPlayer);
    else players[existingIndex] = customPlayer;
    customPlayerIds.add(id);
    packTypes.standard.weights[id] = weightStandard;
    packTypes.elite.weights[id] = weightElite;
    updateUI();
    if (document.getElementById("collection-modal").style.display === "flex") {
      initSlots();
    }
    if (document.getElementById("market-modal").style.display === "flex") {
      renderMarket();
    }
    showToast("Карточка добавлена в общую базу.");
    closeModal("admin-modal");
    document
      .querySelectorAll("#admin-modal input")
      .forEach((input) => (input.value = ""));
  } catch (error) {
    console.error("Ошибка:", error);
    showToast(error.message || "Не удалось добавить карточку.", "error");
  }
};

document.getElementById("admin-delete-btn").onclick = async () => {
  const adminUser = auth.currentUser;
  if (!(await hasAdminClaim(true, adminUser)) || auth.currentUser?.uid !== adminUser?.uid) {
    showToast("Для этого действия нужны права администратора.", "error");
    return;
  }

  const nameInput = document.getElementById("admin-delete-name").value;
  if (!nameInput) return alert("Введи имя карточки, которую хочешь удалить!");

  const idToDelete = getPlayerIdFromName(nameInput);
  if (!idToDelete || builtInPlayerIds.has(idToDelete)) {
    return showToast("Здесь можно удалить только пользовательские карточки.", "error");
  }

  if (
    confirm(
      `Ты уверен, что хочешь удалить игрока "${nameInput}" из глобальной базы?`,
    )
  ) {
    try {
      if (
        !adminUser ||
        !(await hasAdminClaim(true, adminUser)) ||
        auth.currentUser?.uid !== adminUser.uid
      ) {
        throw new Error("Права администратора больше не подтверждены. Войди снова и повтори действие.");
      }
      await deleteDoc(doc(db, "players", idToDelete));
      customPlayerIds.delete(idToDelete);
      const playerIndex = players.findIndex((player) => player.id === idToDelete);
      if (playerIndex !== -1) players.splice(playerIndex, 1);
      delete packTypes.standard.weights[idToDelete];
      delete packTypes.elite.weights[idToDelete];
      updateUI();
      if (document.getElementById("collection-modal").style.display === "flex") {
        initSlots();
      }
      showToast("Пользовательская карточка удалена из базы.");
      document.getElementById("admin-delete-name").value = "";
    } catch (error) {
      console.error("Ошибка при удалении:", error);
      alert("❌ Произошла ошибка. Карточка не удалена.");
    }
  }
};

document.getElementById("admin-add-coins-btn").onclick = async (event) => {
  const button = event.currentTarget;
  const amountInput = document.getElementById("admin-coins-amount");
  const amount = Number(amountInput.value);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1_000_000) {
    showToast("Введи целое число от 1 до 1 000 000.", "error");
    amountInput.focus();
    return;
  }

  button.disabled = true;
  try {
    const result = await executeGameAction("adminAddCoins", { amount });
    playSound("reward");
    showToast(`На баланс начислено +${result.coinsAdded.toLocaleString("ru-RU")} монет.`);
  } catch (error) {
    showToast(error.message || "Не удалось изменить баланс.", "error");
  } finally {
    button.disabled = false;
  }
};

document.getElementById("admin-collect-all-btn").onclick = async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await playersLoadPromise;
    if (!playersCatalogComplete) {
      throw new Error("Не удалось загрузить полный список футболистов. Проверь подключение.");
    }
    const missingCount = players.filter(
      (player) => (inventory[player.id]?.count || 0) < 1,
    ).length;
    if (missingCount === 0) {
      showToast("В коллекции уже есть все футболисты.");
      return;
    }
    if (!confirm(`Добавить в коллекцию ${missingCount} недостающих футболистов?`)) {
      return;
    }

    const result = await executeGameAction("adminCollectAllPlayers");
    playSound("reward");
    showToast(`Добавлено карточек: ${result.playersAdded} из ${result.playersTotal}.`);
    if (document.getElementById("collection-modal").style.display === "flex") {
      initSlots();
    }
  } catch (error) {
    showToast(error.message || "Не удалось выдать карточки.", "error");
  } finally {
    button.disabled = false;
  }
};

onAuthStateChanged(auth, async (user) => {
  const userId = user?.uid || null;
  const isAdmin = user ? await hasAdminClaim(false, user) : false;
  if ((auth.currentUser?.uid || null) !== userId) return;
  hasExclusiveCoach = isAdmin;
  document.getElementById("admin-access-btn").style.display = isAdmin
    ? "block"
    : "none";
  document.getElementById("admin-dashboard-section").style.display = isAdmin
    ? "flex"
    : "none";
  updateUI();
  if (
    document.getElementById("collection-modal").style.display === "flex" &&
    activeFilter === "Тренер"
  ) {
    initSlots();
  }
});

document.getElementById("admin-logout-btn").onclick = async () => {
  await signOut(auth);
  alert("🚪 Вы вышли из аккаунта.");
};

document.getElementById("admin-access-btn").onclick = () => {
  openModal("admin-modal");
};

// --- ЛОГИКА АВТОРИЗАЦИИ ИГРОКОВ (ВЕРСИЯ 1.5) ---

const authModal = document.getElementById("auth-modal");
const authBtn = document.getElementById("auth-login-btn");

["auth-nickname", "auth-password"].forEach((id) => {
  document.getElementById(id)?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || authBtn.disabled) return;
    event.preventDefault();
    authBtn.click();
  });
});

authBtn.onclick = async () => {
  // playSound('click');
  if (authBtn.disabled) return;

  const nickname = document
    .getElementById("auth-nickname")
    .value.trim()
    .toLowerCase();
  const pass = document.getElementById("auth-password").value;

  const validNickname =
    /^[a-z0-9._+-]{3,64}$/.test(nickname) &&
    !nickname.startsWith(".") &&
    !nickname.endsWith(".") &&
    !nickname.includes("..");
  if (!validNickname) {
    showToast("Ник: 3–64 символа латиницей, цифрами или . _ + -, без пробелов и двух точек подряд.", "error");
    return;
  }
  if (pass.length < 6) {
    showToast("Пароль должен содержать не меньше 6 символов.", "error");
    return;
  }

  const email = `${nickname}@fbcards.game`;
  authBtn.disabled = true;
  authBtn.textContent = "Загрузка...";

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast(`С возвращением, ${nickname}!`);
  } catch (signInError) {
    const canRegisterAfterSignInFailure = [
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(signInError.code);

    if (!canRegisterAfterSignInFailure) {
      console.error("Не удалось выполнить вход:", signInError);
      showToast("Не удалось войти. Проверь данные и подключение.", "error");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, pass);
      showToast(`Добро пожаловать, ${nickname}! Аккаунт создан.`);
    } catch (regError) {
      if (regError.code !== "auth/email-already-in-use") {
        console.error("Не удалось создать аккаунт:", regError);
      }
      showToast("Ник уже занят или пароль не подходит.", "error");
    }
  } finally {
    if (!auth.currentUser) {
      authBtn.disabled = false;
      authBtn.textContent = "Войти / Зарегистрироваться";
    }
  }
};

// Следим за тем, вошел игрок или нет
// Следим за входом и ЗАГРУЖАЕМ сохранения из облака
// Следим за входом и УМНО ЗАГРУЖАЕМ сохранения из облака
onAuthStateChanged(auth, async (user) => {
  const authRevision = ++authStateRevision;

  if (user) {
    currentUserUid = user.uid;
    const uid = user.uid;
    openModal(authModal, { persistent: true });
    authBtn.disabled = true;
    authBtn.textContent = "Загрузка сохранения...";

    const accountSave = readStoredJson(`footpacks_save_${uid}`, null);
    const localOwner = safeStorageGet("footpacks_local_owner");
    lastBonusTime = 0;
    const localFallback = accountSave || (
      localOwner === uid ? snapshotCurrentGameState(user) : null
    );
    if (localFallback) {
      hydrateGameState(localFallback);
    } else {
      resetGameState();
    }
    safeStorageSet("footpacks_local_owner", uid);

    const nickname = user.displayName || user.email?.split("@")[0] || "Игрок";
    document.getElementById("top-nickname").textContent = nickname;
    document.getElementById("profile-nickname-display").textContent = nickname;
    const defaultAvatars = [
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Max",
      "https://cdn-icons-png.flaticon.com/512/147/147144.png",
      "https://api.dicebear.com/7.x/adventurer/svg?seed=128",
    ];
    const avatarStorageKey = `footpacks_avatar_${uid}`;
    let userAvatar =
      userAvatarUrl ||
      getSafeImageUrl(safeStorageGet(avatarStorageKey)) ||
      defaultAvatars[0];
    userAvatarUrl = userAvatar;

    function updateAvatarDisplay(url) {
      const profilePreview = document.getElementById("profile-avatar-preview");
      if (profilePreview) profilePreview.src = getSafeImageUrl(url);
      const topAvatar = document.getElementById("top-avatar");
      if (topAvatar) topAvatar.src = getSafeImageUrl(url);
    }

    updateAvatarDisplay(userAvatar);

    function renderAvatarPresets() {
      const container = document.getElementById("avatar-presets");
      if (!container) return;
      container.innerHTML = "";

      defaultAvatars.forEach((url, index) => {
        const img = document.createElement("img");
        img.src = getSafeImageUrl(url);
        img.alt = `Вариант аватара ${index + 1}`;
        img.className = `preset-img ${url === userAvatar ? "active" : ""}`;
        img.setAttribute("role", "button");
        img.tabIndex = 0;
        img.setAttribute(
          "aria-label",
          `Выбрать аватар ${index + 1}${url === userAvatar ? ", выбран" : ""}`,
        );
        img.onclick = () => setAvatar(url);
        container.appendChild(img);
      });
    }

    function setAvatar(url) {
      const safeUrl = getSafeImageUrl(url);
      if (!safeUrl) {
        showToast("Укажи ссылку на изображение с HTTPS.", "error");
        return;
      }
      executeGameAction("updateProfile", { profile: { avatarUrl: safeUrl } })
        .then(() => {
          userAvatar = safeUrl;
          userAvatarUrl = safeUrl;
          safeStorageSet(avatarStorageKey, safeUrl);
          updateAvatarDisplay(safeUrl);
          renderAvatarPresets();
        })
        .catch((error) => showToast(error.message || "Не удалось сохранить аватар.", "error"));
    }

    window.saveCustomAvatar = function () {
      const input = document.getElementById("custom-avatar-input");
      const url = input.value.trim();
      if (getSafeImageUrl(url)) {
        setAvatar(url);
        input.value = "";
        showToast("Аватар успешно изменен!");
      } else {
        showToast("Вставьте ссылку на картинку!", "error");
      }
    };

    renderAvatarPresets();

    try {
      const responseState = await loadCloudGameState(
        user,
        localFallback || snapshotCurrentGameState(user),
      );
      if (authRevision !== authStateRevision || auth.currentUser?.uid !== uid) {
        return;
      }
      hydrateGameState(responseState);
      document.getElementById("club-name-display").textContent = userClub.name;
      document.getElementById("club-badge-img").src = userClub.img;
      userAvatar = userAvatarUrl || userAvatar;
      userAvatarUrl = userAvatar;
      updateAvatarDisplay(userAvatar);
      renderAvatarPresets();
      await saveState();
    } catch (error) {
      if (authRevision !== authStateRevision || auth.currentUser?.uid !== uid) {
        return;
      }
      console.error("❌ Ошибка загрузки сохранения:", error);
      showToast("Не удалось загрузить облачное сохранение. Проверь подключение и попробуй войти снова.", "error");
    }

    if (authRevision !== authStateRevision || auth.currentUser?.uid !== uid) {
      return;
    }

  if (cloudPendingConflictOnLoad) {
    showToast("Облако содержит более новую версию. Она загружена; конфликтная локальная копия сохранена в резерве на этом устройстве.", "error");
    cloudPendingConflictOnLoad = false;
  }

    await checkDailyBonus();
    updateUI();
    renderSquad();
    authBtn.disabled = false;
    authBtn.textContent = "Войти / Зарегистрироваться";
    closeModal(authModal, { force: true });
  } else {
    currentUserUid = null;
    authBtn.disabled = false;
    authBtn.textContent = "Войти / Зарегистрироваться";
    openModal(authModal, { persistent: true });
  }
});

// --- ЛОГИКА ПРОФИЛЯ ---

// 1. Открытие кабинета (профиля)
document.getElementById("open-profile-btn").onclick = () => {
  openModal("profile-modal");

  // Обновляем статистику
  document.getElementById("profile-total-packs").textContent = totalOpened;
  document.getElementById("profile-total-coins").textContent = coins;
  document.getElementById("profile-cups").textContent = cups;

  // Звук клика
  // playSound('click');
};

// Кнопка Выхода из аккаунта
document.getElementById("logout-btn").onclick = async () => {
  await signOut(auth);
  location.reload(); // Перезагружаем страницу, чтобы всё сбросилось
  // playSound('click')
};

// Открытие модалки выбора клуба
document.getElementById("open-club-picker").onclick = () => {
  openModal("club-modal");
};

// Выбор конкретного клуба из списка
document.querySelectorAll(".club-option-btn").forEach((btn) => {
  btn.onclick = async () => {
    const clubName = btn.getAttribute("data-club");
    const clubImg = btn.getAttribute("data-img");
    try {
      await executeGameAction("updateProfile", {
        profile: { userClub: { name: clubName, img: clubImg } },
      });
      document.getElementById("club-name-display").textContent = userClub.name;
      document.getElementById("club-badge-img").src = userClub.img;
      closeModal("club-modal");
    } catch (error) {
      showToast(error.message || "Не удалось сохранить любимый клуб.", "error");
    }
  };
});

// Открытие и закрытие плавающего окна техподдержки
window.toggleSupportWindow = function() {
  const win = document.getElementById("support-float-window");
  const opening = getComputedStyle(win).display === "none";
  setSupportWindowOpen(opening);
};

function setSupportWindowOpen(opening, options = {}) {
  const win = document.getElementById("support-float-window");
  const toggleButton = document.querySelector(".support-float-btn");
  if (!win) return;

  if (opening) {
    win.style.display = "block";
    win.setAttribute("aria-hidden", "false");
    toggleButton?.setAttribute("aria-expanded", "true");
    supportHistoryToken = `support-${Date.now()}-${++modalTokenCounter}`;
    history.pushState(
      { ...(history.state || {}), [SUPPORT_HISTORY_KEY]: supportHistoryToken },
      "",
      location.href,
    );
    window.supportOpenedAt = Date.now();
    syncModalInertState();
    document.getElementById("support-text")?.focus({ preventScroll: true });
    return;
  }

  const closingHistoryToken = supportHistoryToken;
  const shouldGoBack =
    !options.fromHistory &&
    closingHistoryToken &&
    history.state?.[SUPPORT_HISTORY_KEY] === closingHistoryToken;
  win.style.display = "none";
  win.setAttribute("aria-hidden", "true");
  toggleButton?.setAttribute("aria-expanded", "false");
  supportHistoryToken = null;
  syncModalInertState();
  if (shouldGoBack) goBackAfterProgrammaticClose("support", closingHistoryToken);
  toggleButton?.focus({ preventScroll: true });
}

// Отправка сообщения в Firebase
window.sendSupportMessage = async function() {
  const textInput = document.getElementById("support-text");
  const sendButton = document.getElementById("support-send-btn");
  const honeypot = document.getElementById("support-website");
  const message = textInput.value.trim();

  if (honeypot?.value) {
    textInput.value = "";
    window.toggleSupportWindow();
    return;
  }
  if (Date.now() - Number(window.supportOpenedAt || 0) < 1200) {
    showToast("Подожди секунду и отправь сообщение ещё раз.", "error");
    return;
  }

  if (!message) {
    showToast("Напишите хоть что-нибудь!", "error");
    return;
  }
  if (message.length > 1200) {
    showToast("Сообщение должно быть короче 1200 символов.", "error");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    showToast("Войди в аккаунт, чтобы написать в поддержку.", "error");
    return;
  }

  try {
    if (sendButton) sendButton.disabled = true;
    const rateLimitRef = doc(db, "supportRateLimits", user.uid);
    const messageRef = doc(collection(db, "supportMessages"));
    await runTransaction(db, async (transaction) => {
      const rateLimitSnapshot = await transaction.get(rateLimitRef);
      const lastSentAt = rateLimitSnapshot.exists()
        ? rateLimitSnapshot.data().lastSentAt
        : null;
      if (lastSentAt?.toMillis && Date.now() - lastSentAt.toMillis() < 60_000) {
        throw new Error("Подожди минуту перед следующим сообщением.");
      }
      transaction.set(rateLimitRef, {
        lastSentAt: serverTimestamp(),
        lastMessageId: messageRef.id,
      });
      transaction.set(messageRef, {
        uid: user.uid,
        nickname: getClientNickname(user),
        message,
        status: "new",
        createdAt: serverTimestamp(),
      });
    });
    showToast("Сообщение отправлено.");
    playSound("reward");
    textInput.value = "";
    toggleSupportWindow();

  } catch (error) {
    console.error("Ошибка сохранения обращения в поддержку:", error);
    showToast(error.message || "Поддержка временно недоступна.", "error");
  } finally {
    if (sendButton) sendButton.disabled = false;
  }
};

updateUI();
