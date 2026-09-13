// Надежная база фоток с SoFifa
const players = [
  { id: 'pele', name: 'Pele (ICON)', raiting: 99, club: 'Icons', league: 'Icon', pos: 'ST', price: 5000, photo: './pele.png' },
  { id: 'mbappe', name: 'K. Mbappe', raiting: 91, club: 'Real Madrid', league: 'La Liga', pos: 'ST', price: 300, photo: 'https://images.fotmob.com/image_resources/playerimages/701154.png' },
  { id: 'haaland', name: 'E. Haaland', raiting: 91, club: 'Man City', league: 'Premier League', pos: 'ST', price: 300, photo: 'https://images.fotmob.com/image_resources/playerimages/737066.png' },
  { id: 'vini', name: 'Vinicius JR', raiting: 90, club: 'Real Madrid', league: 'La Liga', pos: 'LW', price: 250, photo: 'https://images.fotmob.com/image_resources/playerimages/846033.png' },
  { id: 'salah', name: 'M. Salah', raiting: 89, club: 'Liverpool', league: 'Premier League', pos: 'RW', price: 220, photo: 'https://images.fotmob.com/image_resources/playerimages/292462.png' },
  { id: 'yamal', name: 'L. Yamal', raiting: 87, club: 'Barcelona', league: 'La Liga', pos: 'RW', price: 150, photo: 'https://images.fotmob.com/image_resources/playerimages/1467236.png' },
  { id: 'foden', name: 'P. Foden', raiting: 88, club: 'Man City', league: 'Premier League', pos: 'LW', price: 180, photo: 'https://images.fotmob.com/image_resources/playerimages/815006.png' },
  { id: 'guler', name: 'A. Guler', raiting: 78, club: 'Real Madrid', league: 'La Liga', pos: 'CM', price: 50, photo: 'https://images.fotmob.com/image_resources/playerimages/1253890.png' },
  { id: 'courtois', name: 'T. Courtois', raiting: 90, club: 'Real Madrid', league: 'La Liga', pos: 'GK', price: 150, photo: 'https://images.fotmob.com/image_resources/playerimages/170323.png' },
  { id: 'rudiger', name: 'A. Rudiger', raiting: 88, club: 'Real Madrid', league: 'La Liga', pos: 'CB', price: 120, photo: 'https://images.fotmob.com/image_resources/playerimages/276738.png' },
  { id: 'walker', name: 'K. Walker', raiting: 84, club: 'Burnley', league: 'Premier League', pos: 'RB', price: 70, photo: './walker.png' }
];

// Умное сокращение имен для поля
function getShortName(fullName) {
  if (fullName.includes('.')) return fullName.split('. ')[1]; // K. Mbappe -> Mbappe
  if (fullName.includes('(')) return fullName.split(' ')[0];  // Pele (ICON) -> Pele
  return fullName; // Vinicius JR -> Vinicius JR
}

const packTypes = {
  standard: { cost: 150, weights: { guler: 40, walker: 30, rudiger: 15, yamal: 10, courtois: 5, foden: 4, salah: 2, vini: 1, mbappe: 0.5, haaland: 0.5 } },
  elite: { cost: 400, weights: { guler: 10, walker: 15, rudiger: 20, yamal: 25, courtois: 15, foden: 10, salah: 8, vini: 6, mbappe: 4, haaland: 4 } }
};

const questDefinitions = [
  { id: 'open_3', title: 'Новичок', desc: 'Открой 3 пака', target: 3, type: 'packs', reward: 150 },
  { id: 'open_10', title: 'Опытный кейсер', desc: 'Открой 10 паков', target: 10, type: 'packs', reward: 350 },
  { id: 'collect_madrid', title: 'Галактикос', desc: 'Выбей 2 игроков Реал Мадрид', target: 2, type: 'madrid', reward: 300 },
  { id: 'stars_90', title: 'Суперзвезда', desc: 'Игрок с рейтингом 90+', target: 1, type: 'stars', reward: 250 }
];

// Память
let coins = parseInt(localStorage.getItem('cards_coins')) || 1000;
let totalOpened = parseInt(localStorage.getItem('cards_totalOpened')) || 0;
let inventory = JSON.parse(localStorage.getItem('cards_inventory')) || {};
let squad = JSON.parse(localStorage.getItem('cards_squad')) || { LW:null, ST:null, RW:null, LCM:null, CM:null, RCM:null, LB:null, LCB:null, RCB:null, RB:null, GK:null };
let completedQuests = JSON.parse(localStorage.getItem('cards_completed_quests')) || [];
let leaderboard = JSON.parse(localStorage.getItem('cards_leaderboard')) || [{ name: 'Cristiano7', score: 42 }, { name: 'PackKing', score: 35 }];
let sbcBurnList = [];

let currentPackType = 'standard';
let lastDroppedPlayer = null;
let selectedPitchPos = null;
let activeFilter = 'all';

function saveState() {
  localStorage.setItem('cards_coins', coins);
  localStorage.setItem('cards_totalOpened', totalOpened);
  localStorage.setItem('cards_inventory', JSON.stringify(inventory));
  localStorage.setItem('cards_squad', JSON.stringify(squad));
  localStorage.setItem('cards_completed_quests', JSON.stringify(completedQuests));
}

function updateUI() {
  document.getElementById('coins-count').textContent = coins;
  document.getElementById('pack-count').textContent = totalOpened;
  document.getElementById('btn').textContent = `Открыть (${packTypes[currentPackType].cost}$)`;
  document.getElementById('btn').disabled = coins < packTypes[currentPackType].cost;
  document.getElementById('collection-count').textContent = players.filter(p => inventory[p.id]?.count > 0).length;
  document.getElementById('collection-total').textContent = players.length;
}

// Банкротство
function checkBankruptcy() {
  const minCost = 150;
  const totalCardsValue = players.reduce((sum, p) => sum + (inventory[p.id]?.count || 0) * p.price, 0);
  if (coins + totalCardsValue < minCost) {
    document.getElementById('final-pack-score').textContent = totalOpened;
    document.getElementById('gameover-modal').style.display = 'flex';
  }
}

// === МЕНЮ: КОЛЛЕКЦИЯ ===
function initSlots() {
  const grid = document.getElementById('collection-grid');
  grid.innerHTML = '';
  const filtered = players.filter(p => activeFilter === 'all' || p.league === activeFilter);
  
  filtered.forEach(player => {
    if (!inventory[player.id]) inventory[player.id] = { count: 0 };
    const slot = document.createElement('div');
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
    slot.className = `mini-card ${player.league === 'Icon' ? 'card-icon' : player.raiting >= 90 ? 'card-gold' : player.raiting >= 85 ? 'card-silver' : 'card-bronze'}`;
    slot.innerHTML = `
      <span class="mini-card-rating">${player.raiting}</span>
      ${item.count > 1 ? `<span class="mini-card-count">x${item.count}</span>` : ''}
      <img class="mini-card-photo" src="${player.photo}">
      <span class="mini-card-name">${player.name}</span>
      <button class="mini-card-sell-btn" onclick="sellFromCollection('${player.id}')">Продать (+${player.price}$)</button>
    `;
  } else {
    slot.className = 'mini-card slot-locked';
    slot.innerHTML = `<div class="mini-placeholder-icon">🔒</div><div class="mini-placeholder-text">Не открыт</div>`;
  }
}

window.sellFromCollection = function(playerId) {
  const player = players.find(p => p.id === playerId);
  if (!player || !inventory[playerId] || inventory[playerId].count <= 0) return;
  if (inventory[playerId].count === 1) {
    for (const pos in squad) { if (squad[pos] === playerId) squad[pos] = null; }
    renderSquad();
  }
  inventory[playerId].count--;
  coins += player.price;
  renderSlot(player);
  saveState(); updateUI(); renderSquadPicker(); checkBankruptcy();
};

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    initSlots();
  });
});

// === МЕНЮ: ЗАДАНИЯ ===
function renderQuests() {
  const list = document.getElementById('quests-list');
  list.innerHTML = '';
  questDefinitions.forEach(q => {
    const isCompleted = completedQuests.includes(q.id);
    let progress = 0;
    if (q.type === 'packs') progress = totalOpened;
    if (q.type === 'madrid') progress = players.filter(p => p.club === 'Real Madrid').reduce((sum, p) => sum + (inventory[p.id]?.count || 0), 0);
    if (q.type === 'stars') progress = players.filter(p => p.raiting >= 90).reduce((sum, p) => sum + (inventory[p.id]?.count || 0), 0);
    
    const canClaim = !isCompleted && progress >= q.target;
    const div = document.createElement('div');
    div.className = 'quest-item';
    div.innerHTML = `
      <div class="quest-info">
        <h4>${q.title}</h4>
        <p>${q.desc} (${Math.min(progress, q.target)}/${q.target})</p>
        <div style="color: #34d399; font-weight: bold; font-size: 12px;">+${q.reward}$</div>
      </div>
      <button class="claim-btn" ${canClaim ? '' : 'disabled'} onclick="claimQuest('${q.id}', ${q.reward})">
        ${isCompleted ? 'Получено' : 'Забрать'}
      </button>
    `;
    list.appendChild(div);
  });
}

window.claimQuest = function(id, reward) {
  completedQuests.push(id);
  coins += reward;
  saveState(); updateUI(); renderQuests();
};

// === МЕНЮ: ТОП ЛИДЕРОВ ===
function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '';
  leaderboard.forEach((item, index) => {
    list.innerHTML += `<div class="leader-row"><span class="leader-rank">#${index + 1}</span><span style="flex:1; color:#fff;">${item.name}</span><span style="color:#38bdf8; font-weight:bold;">${item.score} паков</span></div>`;
  });
}

// === МЕНЮ: СОСТАВ ===
function renderSquad() {
  let totalRating = 0, count = 0;
  Object.keys(squad).forEach(pos => {
    const slotEl = document.getElementById(`slot-${pos}`);
    if (!slotEl) return;
    const p = players.find(x => x.id === squad[pos]);
    
    if (selectedPitchPos === pos) slotEl.classList.add('active-slot');
    else slotEl.classList.remove('active-slot');

    if (p) {
      slotEl.classList.add('occupied');
      // ИСПОЛЬЗУЕМ getShortName ВМЕСТО split
      slotEl.innerHTML = `<div style="font-size:8px;">${pos}</div><div>${getShortName(p.name)}</div><div>${p.raiting}</div><button class="slot-remove-btn" onclick="event.stopPropagation(); squad['${pos}']=null; saveState(); renderSquad(); renderSquadPicker();">✕</button>`;
      totalRating += p.raiting; count++;
    } else {
      slotEl.classList.remove('occupied');
      slotEl.innerHTML = pos;
    }

    slotEl.onclick = () => {
      selectedPitchPos = pos;
      document.getElementById('selected-pos-label').textContent = `Выбираем: ${pos}`;
      renderSquad(); renderSquadPicker();
    };
  });
  document.getElementById('squad-ovr').textContent = count > 0 ? Math.round(totalRating / count) : 0;
}

function renderSquadPicker() {
  const el = document.getElementById('squad-inventory');
  el.innerHTML = '';
  const occupied = Object.values(squad).filter(Boolean);
  const avail = players.filter(p => inventory[p.id]?.count > 0 && !occupied.includes(p.id));
  
  avail.forEach(p => {
    const div = document.createElement('div');
    div.className = 'squad-picker-card';
    // ИСПОЛЬЗУЕМ getShortName
    div.innerHTML = `<b>${getShortName(p.name)}</b> (${p.raiting})<br><small>${p.pos}</small>`;
    div.onclick = () => {
      if(!selectedPitchPos) return alert('Сначала нажми на позицию на поле!');
      squad[selectedPitchPos] = p.id;
      selectedPitchPos = null;
      document.getElementById('selected-pos-label').textContent = 'Нажми на позицию';
      saveState(); renderSquad(); renderSquadPicker();
    };
    el.appendChild(div);
  });
}

// === МЕНЮ: РЫНОК ===
function renderMarket() {
  const grid = document.getElementById('market-grid');
  grid.innerHTML = '';
  players.filter(p => p.id !== 'pele').forEach(p => {
    const cost = p.price * 5;
    const div = document.createElement('div');
    div.className = `mini-card ${p.raiting >= 90 ? 'card-gold' : p.raiting >= 85 ? 'card-silver' : 'card-bronze'}`;
    div.innerHTML = `
      <span class="mini-card-rating">${p.raiting}</span>
      <img class="mini-card-photo" src="${p.photo}">
      <span class="mini-card-name">${p.name}</span>
      <button class="market-buy-btn" ${coins < cost ? 'style="opacity:0.5"' : ''} onclick="buyMarket('${p.id}', ${cost})">Купить ${cost}$</button>
    `;
    grid.appendChild(div);
  });
}

window.buyMarket = function(id, cost) {
  if (coins < cost) return alert('Недостаточно денег!');
  coins -= cost;
  if(!inventory[id]) inventory[id] = {count:0};
  inventory[id].count++;
  saveState(); updateUI(); renderMarket();
};

// === МЕНЮ: СБОРКИ (ИПК) ===
function renderSBC() {
  const container = document.getElementById('sbc-slots');
  container.innerHTML = '';
  for(let i=0; i<3; i++) {
    const slot = document.createElement('div');
    slot.className = 'sbc-slot';
    const pId = sbcBurnList[i];
    if (pId) {
      const p = players.find(x => x.id === pId);
      slot.classList.add('filled');
      // Вот здесь я сделал большую фотку и крупный жирный рейтинг для ИПК!
      slot.innerHTML = `
        <img src="${p.photo}" style="width: 55px; height: 55px; object-fit: contain; margin-bottom: 5px;">
        <div style="font-size: 18px; font-weight: 900; color: #fff;">${p.raiting}</div>
      `;
      slot.onclick = () => { sbcBurnList.splice(i, 1); renderSBC(); renderSBCPicker(); };
    } else {
      slot.innerHTML = '+';
    }
    container.appendChild(slot);
  }
  document.getElementById('sbc-submit-btn').disabled = sbcBurnList.length < 3;
}

function renderSBCPicker() {
  const el = document.getElementById('sbc-inventory');
  el.innerHTML = '';
  const avail = players.filter(p => inventory[p.id]?.count > 0 && !sbcBurnList.includes(p.id) && p.id !== 'pele');
  avail.forEach(p => {
    const div = document.createElement('div');
    div.className = 'squad-picker-card';
    // ИСПОЛЬЗУЕМ getShortName
    div.innerHTML = `<b>${getShortName(p.name)}</b> (${p.raiting})`;
    div.onclick = () => {
      if(sbcBurnList.length < 3) { sbcBurnList.push(p.id); renderSBC(); renderSBCPicker(); }
    };
    el.appendChild(div);
  });
}

document.getElementById('sbc-submit-btn').onclick = () => {
  sbcBurnList.forEach(id => { inventory[id].count--; }); 
  sbcBurnList = [];
  document.getElementById('sbc-modal').style.display = 'none';
  saveState(); updateUI();
  
  // Шанс 10% на легенду Пеле
  const isPele = Math.random() < 0.10;
  const reward = isPele ? players.find(p=>p.id==='pele') : players.find(p=>p.id==='mbappe');
  revealCard(reward, true);
};

// === БАНК ===
// === БАНК (Донат временно отключен) ===
window.buyCoins = function(amount, priceStr) {
  alert('Эта функция пока в разработке! Пополнение баланса появится в будущих обновлениях.');
  
  // Убрали начисление монет (coins += amount), чтобы игроки не читерили
  
  // Просто закрываем модальное окно
  document.getElementById('bank-modal').style.display = 'none';
};

// === ОТКРЫТИЕ ПАКОВ ===
const btn = document.getElementById('btn');
const pack = document.getElementById('pack');
const card = document.getElementById('card');
const sellBtn = document.getElementById('sell-btn');

document.querySelectorAll('.pack-tab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.pack-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentPackType = tab.dataset.pack;
    document.getElementById('pack').className = currentPackType === 'elite' ? 'pack-box elite-pack' : 'pack-box';
    document.getElementById('pack-icon').textContent = currentPackType === 'elite' ? '⭐' : '📦';
    document.getElementById('pack-name').textContent = currentPackType === 'elite' ? 'Элитный пак' : 'Обычный пак';
    updateUI();
  };
});

btn.onclick = () => {
  if (coins < packTypes[currentPackType].cost) return;
  coins -= packTypes[currentPackType].cost;
  updateUI(); saveState();
  
  btn.disabled = true; sellBtn.style.display = 'none'; card.style.display = 'none';
  pack.style.display = 'flex'; pack.classList.add('shake');
  
  setTimeout(() => {
    pack.classList.remove('shake');
    let rand = Math.random() * Object.values(packTypes[currentPackType].weights).reduce((a,b)=>a+b,0);
    let dropped = players[0];
    for (const [id, w] of Object.entries(packTypes[currentPackType].weights)) {
      if (rand < w) { dropped = players.find(p=>p.id===id); break; }
      rand -= w;
    }
    revealCard(dropped, dropped.raiting >= 90);
  }, 900);
};

function revealCard(player, isWalkout) {
  pack.style.display = 'none';
  lastDroppedPlayer = player;
  
  const finishReveal = () => {
    card.className = `card card-popup ${player.league === 'Icon' ? 'card-icon' : player.raiting >= 90 ? 'card-gold' : player.raiting >= 85 ? 'card-silver' : 'card-bronze'}`;
    card.innerHTML = `<div class="card-top"><div class="card-rating">${player.raiting}</div></div><img class="card-photo" src="${player.photo}"><div class="card-bottom"><div class="card-name">${player.name}</div><div class="card-club">${player.club}</div></div>`;
    card.style.display = 'flex';
    
    totalOpened++;
    if(!inventory[player.id]) inventory[player.id] = {count:0};
    inventory[player.id].count++;
    
    sellBtn.textContent = `Продать (+${player.price}$)`;
    sellBtn.style.display = 'inline-block';
    
    saveState(); updateUI(); checkBankruptcy();
  };

  if (isWalkout) {
    document.getElementById('walkout-overlay').style.display = 'flex';
    setTimeout(() => { document.getElementById('walkout-overlay').style.display = 'none'; finishReveal(); }, 1100);
  } else finishReveal();
}

sellBtn.onclick = () => {
  if(!lastDroppedPlayer || inventory[lastDroppedPlayer.id].count <= 0) return;
  inventory[lastDroppedPlayer.id].count--;
  coins += lastDroppedPlayer.price;
  saveState(); updateUI();
  sellBtn.style.display = 'none'; card.style.display = 'none'; pack.style.display = 'flex';
  checkBankruptcy();
};

// === ОТКРЫТИЕ ВСЕХ ОКНА ===
document.getElementById('open-collection-btn').onclick = () => { initSlots(); document.getElementById('collection-modal').style.display = 'flex'; };
document.getElementById('open-quests-btn').onclick = () => { renderQuests(); document.getElementById('quests-modal').style.display = 'flex'; };
document.getElementById('open-leaderboard-btn').onclick = () => { renderLeaderboard(); document.getElementById('leaderboard-modal').style.display = 'flex'; };
document.getElementById('open-squad-btn').onclick = () => { renderSquad(); renderSquadPicker(); document.getElementById('squad-modal').style.display = 'flex'; };
document.getElementById('open-market-btn').onclick = () => { renderMarket(); document.getElementById('market-modal').style.display = 'flex'; };
document.getElementById('open-sbc-btn').onclick = () => { sbcBurnList = []; renderSBC(); renderSBCPicker(); document.getElementById('sbc-modal').style.display = 'flex'; };
document.getElementById('open-bank-btn').onclick = () => { document.getElementById('bank-modal').style.display = 'flex'; };

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.onclick = () => document.getElementById(btn.dataset.close).style.display = 'none';
});

// Сохранение рекорда при банкротстве
document.getElementById('save-score-btn').onclick = () => {
  leaderboard.push({ name: document.getElementById('player-nickname').value || 'Игрок', score: totalOpened });
  leaderboard.sort((a,b)=>b.score-a.score);
  localStorage.setItem('cards_leaderboard', JSON.stringify(leaderboard.slice(0,10)));
  
  localStorage.clear(); 
  location.reload(); // Жесткий рестарт страницы для новой игры
};

// === КНОПКА СБРОСА ПРОГРЕССА (РЕСТАРТ) ===
const resetModal = document.getElementById('reset-modal');

// Открываем кастомное окно при нажатии на ↺
document.getElementById('reset-btn').onclick = () => {
  resetModal.style.display = 'flex';
};

// Кнопка "Отмена"
document.getElementById('cancel-reset-btn').onclick = () => {
  resetModal.style.display = 'none';
};

// Закрытие окна при клике на черный фон
resetModal.onclick = (e) => {
  if (e.target === resetModal) resetModal.style.display = 'none';
};

// Кнопка красная "Сбросить"
document.getElementById('confirm-reset-btn').onclick = () => {
  // Удаляем прогресс, не трогая таблицу рекордов
  localStorage.removeItem('cards_coins');
  localStorage.removeItem('cards_totalOpened');
  localStorage.removeItem('cards_inventory');
  localStorage.removeItem('cards_squad');
  localStorage.removeItem('cards_completed_quests');
  
  // Перезагружаем страницу
  location.reload();
};

// === СЕКРЕТНАЯ АДМИНКА (ПРОМОКОДЫ) ===
let secretPackClicks = 0;
const packIconEl = document.getElementById('pack');

packIconEl.addEventListener('click', () => {
  secretPackClicks++;
  
  if (secretPackClicks >= 5) {
    const cheatCode = prompt('Секретная консоль. Введи чит-код:');
    
    if (cheatCode === 'money') {
      coins += 500000;
      alert('💸 Чит-код принят: +500,000$ на баланс!');
    } else if (cheatCode === 'pele') {
      if (!inventory['pele']) inventory['pele'] = { count: 0 };
      inventory['pele'].count++;
      alert('👑 Чит-код принят: Эксклюзивный Пеле (99) добавлен в коллекцию!');
    } else if (cheatCode !== null) {
      alert('❌ Неверный код!');
    }
    
    saveState();
    updateUI();
    secretPackClicks = 0; // Сбрасываем счетчик
  }
  
  // Если не успел кликнуть 5 раз за 2 секунды — счетчик сбрасывается
  setTimeout(() => secretPackClicks = 0, 2000); 
});

updateUI();