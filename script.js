const players = [
  { id: 'maradona', name: 'Maradona (ICON)', raiting: 100, club: 'Icons', league: 'Icon', pos: 'CAM', price: 3000, photo: 'https://images.fotmob.com/image_resources/playerimages/158546.png' },
  { id: 'pele', name: 'Pele (ICON)', raiting: 100, club: 'Icons', league: 'Icon', pos: 'ST', price: 3000, photo: './pele.png' },
  { id: 'ronaldo', name: 'Cristiano Ronaldo', raiting: 92, club: 'Al-Nasr', league: 'Saudi Pro League', pos: 'ST', price: 580, photo: 'https://images.fotmob.com/image_resources/playerimages/30893.png' },
  { id: 'mbappe', name: 'K. Mbappe', raiting: 91, club: 'Real Madrid', league: 'La Liga', pos: 'ST', price: 460, photo: 'https://images.fotmob.com/image_resources/playerimages/701154.png' },
  { id: 'haaland', name: 'E. Haaland', raiting: 91, club: 'Man City', league: 'Premier League', pos: 'ST', price: 460, photo: 'https://images.fotmob.com/image_resources/playerimages/737066.png' },
  { id: 'garcia', name: 'Joan García', raiting: 90, club: 'Barcelona', league: 'La Liga', pos: 'GK', price: 440, photo: 'https://images.fotmob.com/image_resources/playerimages/1167220.png' },
  { id: 'raphinha', name: 'Raphinha', raiting: 91, club: 'Barcelona', league: 'La Liga', pos: 'RW', price: 430, photo: 'https://images.fotmob.com/image_resources/playerimages/696679.png' },
  { id: 'vini', name: 'Vinicius JR', raiting: 90, club: 'Real Madrid', league: 'La Liga', pos: 'LW', price: 400, photo: 'https://images.fotmob.com/image_resources/playerimages/846033.png' },
  { id: 'salah', name: 'M. Salah', raiting: 89, club: 'Liverpool', league: 'Premier League', pos: 'RW', price: 220, photo: 'https://images.fotmob.com/image_resources/playerimages/292462.png' },
  { id: 'yamal', name: 'L. Yamal', raiting: 89, club: 'Barcelona', league: 'La Liga', pos: 'RW', price: 235, photo: 'https://images.fotmob.com/image_resources/playerimages/1467236.png' },
  { id: 'foden', name: 'P. Foden', raiting: 88, club: 'Man City', league: 'Premier League', pos: 'LW', price: 210, photo: 'https://images.fotmob.com/image_resources/playerimages/815006.png' },
  { id: 'guler', name: 'A. Guler', raiting: 78, club: 'Real Madrid', league: 'La Liga', pos: 'CM', price: 150, photo: 'https://images.fotmob.com/image_resources/playerimages/1253890.png' },
  { id: 'courtois', name: 'T. Courtois', raiting: 90, club: 'Real Madrid', league: 'La Liga', pos: 'GK', price: 390, photo: 'https://images.fotmob.com/image_resources/playerimages/170323.png' },
  { id: 'rudiger', name: 'A. Rudiger', raiting: 88, club: 'Real Madrid', league: 'La Liga', pos: 'CB', price: 230, photo: 'https://images.fotmob.com/image_resources/playerimages/276738.png' },
  { id: 'walker', name: 'K. Walker', raiting: 84, club: 'Burnley', league: 'Premier League', pos: 'RB', price: 160, photo: './walker.png' },
  { id: 'bellingham', name: 'J. Bellingham', raiting: 90, club: 'Real Madrid', league: 'La Liga', pos: 'CAM', price: 400, photo: './bellingham.png' },
  { id: 'valverde', name: 'F. Valverde', raiting: 88, club: 'Real Madrid', league: 'La Liga', pos: 'CM', price: 220, photo: './valverde.png' },
  { id: 'rodrygo', name: 'Rodrygo', raiting: 85, club: 'Real Madrid', league: 'La Liga', pos: 'RW', price: 200, photo: './rodrygo.png' },
  { id: 'modric', name: 'L. Modric', raiting: 87, club: 'Milan', league: 'Seria A', pos: 'CM', price: 200, photo: './modric.png' },
  { id: 'camavinga', name: 'E. Camavinga', raiting: 82, club: 'Real Madrid', league: 'La Liga', pos: 'CDM', price: 180, photo: './camavinga.png' },
  { id: 'tchouameni', name: 'A. Tchouameni', raiting: 84, club: 'Real Madrid', league: 'La Liga', pos: 'CDM', price: 160, photo: './tchouameni.png' }
];

function getShortName(fullName) {
  if (fullName.includes('.')) return fullName.split('. ')[1]; 
  if (fullName.includes('(')) return fullName.split(' ')[0];  
  return fullName; 
}

const packTypes = {
  standard: { 
    cost: 200, 
    weights: { 
      guler: 30, walker: 25, camavinga: 25, tchouameni: 25, 
      rodrygo: 20, modric: 13, rudiger: 12, yamal: 6, 
      courtois: 3, foden: 9, valverde: 8, 
      salah: 4, vini: 2, mbappe: 2, haaland: 2, bellingham: 2, maradona: 0,
      pele: 0, ronaldo: 0.7, raphinha: 1.5, garcia: 3
    } 
  },
  elite: { 
    cost: 450, 
    weights: { 
      guler: 0, walker: 0, camavinga: 5, tchouameni: 5, 
      rodrygo: 20, modric: 20, rudiger: 20, yamal: 20, 
      courtois: 15, foden: 10, valverde: 10, 
      salah: 8, vini: 5, mbappe: 4, haaland: 4, bellingham: 4, pele: 0.4,
      maradona: 0.4, ronaldo: 2.5, raphinha: 4.5, garcia: 5
    } 
  }
};

const questDefinitions = [
  { id: 'open_3', title: 'Новичок', desc: 'Открой 3 пака', target: 3, type: 'packs', reward: 150 },
  { id: 'open_10', title: 'Опытный кейсер', desc: 'Открой 10 паков', target: 10, type: 'packs', reward: 350 },
  { id: 'collect_madrid', title: 'Мадридский снайпер', desc: 'Выбей 3 игроков Реал Мадрид', target: 3, type: 'madrid', reward: 400 },
  { id: 'stars_90', title: 'Легендарный улов', desc: 'Выбей игрока с рейтингом 90+', target: 1, type: 'stars', reward: 800 },
  { id: 'rich_club', title: 'Клуб миллионеров', desc: 'Накопи 5 000$ на балансе', target: 5000, type: 'coins', reward: 600 }
];

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

// Проверка таймера на бонус каждые 12 часов
function checkDailyBonus() {
  const lastBonusTime = parseInt(localStorage.getItem('cards_last_bonus')) || 0;
  const now = Date.now();
  const twelveHours = 12 * 60 * 60 * 1000;

  if (now - lastBonusTime > twelveHours) {
    coins += 500;
    localStorage.setItem('cards_last_bonus', now);
    alert('🎁 Ежедневный бонус! Вам начислено +500$ за вход в игру!');
    saveState();
  }
}
checkDailyBonus();

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
  
  // Улучшенный счетчик коллекции (Уникальные / Всего)
  const collectedCount = players.filter(p => inventory[p.id]?.count > 0).length;
  document.getElementById('collection-count').textContent = collectedCount;
  document.getElementById('collection-total').textContent = players.length;
}

function checkBankruptcy() {
  const minCost = packTypes.standard.cost;
  const totalCardsValue = players.reduce((sum, p) => sum + (inventory[p.id]?.count || 0) * p.price, 0);
  if (coins + totalCardsValue < minCost) {
    document.getElementById('final-pack-score').textContent = totalOpened;
    document.getElementById('gameover-modal').style.display = 'flex';
  }
}

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

function renderQuests() {
  const list = document.getElementById('quests-list');
  list.innerHTML = '';
  questDefinitions.forEach(q => {
    const isCompleted = completedQuests.includes(q.id);
    let progress = 0;
    if (q.type === 'packs') progress = totalOpened;
    if (q.type === 'madrid') progress = players.filter(p => p.club === 'Real Madrid').reduce((sum, p) => sum + (inventory[p.id]?.count || 0), 0);
    if (q.type === 'stars') progress = players.filter(p => p.raiting >= 90).reduce((sum, p) => sum + (inventory[p.id]?.count || 0), 0);
    if (q.type === 'coins') progress = coins;
    
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

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '';
  leaderboard.forEach((item, index) => {
    list.innerHTML += `<div class="leader-row"><span class="leader-rank">#${index + 1}</span><span style="flex:1; color:#fff;">${item.name}</span><span style="color:#38bdf8; font-weight:bold;">${item.score} паков</span></div>`;
  });
}

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

function renderMarket() {
  const grid = document.getElementById('market-grid');
  grid.innerHTML = '';
  players.filter(p => p.id !== 'pele' && p.id !== 'maradona').forEach(p => {
    const cost = p.price * 5;
    const div = document.createElement('div');
    div.className = `mini-card ${p.raiting >= 90 ? 'card-gold' : p.raiting >= 85 ? 'card-silver' : 'card-bronze'}`;
    
    div.innerHTML = `
      <span class="mini-card-rating">${p.raiting}</span>
      <img class="mini-card-photo" src="${p.photo}">
      <span class="mini-card-name">${p.name}</span>
      <button id="buy-btn-${p.id}" class="market-buy-btn" ontouchstart="" ${coins < cost ? 'disabled' : ''} onclick="buyMarket('${p.id}', ${cost})">Купить ${cost}$</button>
    `;
    grid.appendChild(div);
  });
}

window.buyMarket = function(id, cost) {
  if (coins < cost) return alert('Недостаточно денег!');
  
  coins -= cost;
  if(!inventory[id]) inventory[id] = {count:0};
  inventory[id].count++;
  
  saveState(); 
  updateUI(); 
  
  players.filter(p => p.id !== 'pele' && p.id !== 'maradona').forEach(p => {
    const btn = document.getElementById(`buy-btn-${p.id}`);
    if (btn) {
      btn.disabled = coins < (p.price * 5);
    }
  });
};

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
  const avail = players.filter(p => inventory[p.id]?.count > 0 && !sbcBurnList.includes(p.id) && p.id !== 'pele' && p.id !== 'maradona');
  avail.forEach(p => {
    const div = document.createElement('div');
    div.className = 'squad-picker-card';
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
  
  const randReward = Math.random();
  let reward;
  if (randReward < 0.05) reward = players.find(p=>p.id==='maradona');
  else if (randReward < 0.15) reward = players.find(p=>p.id==='pele');
  else reward = players.find(p=>p.id==='mbappe');

  revealCard(reward, true);
};

window.buyCoins = function(amount, priceStr) {
  alert('Эта функция пока в разработке! Пополнение баланса появится в будущих обновлениях.');
  document.getElementById('bank-modal').style.display = 'none';
};

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

document.getElementById('save-score-btn').onclick = () => {
  leaderboard.push({ name: document.getElementById('player-nickname').value || 'Игрок', score: totalOpened });
  leaderboard.sort((a,b)=>b.score-a.score);
  localStorage.setItem('cards_leaderboard', JSON.stringify(leaderboard.slice(0,10)));
  
  localStorage.clear(); 
  location.reload(); 
};

const resetModal = document.getElementById('reset-modal');

document.getElementById('reset-btn').onclick = () => {
  resetModal.style.display = 'flex';
};

document.getElementById('cancel-reset-btn').onclick = () => {
  resetModal.style.display = 'none';
};

resetModal.onclick = (e) => {
  if (e.target === resetModal) resetModal.style.display = 'none';
};

document.getElementById('confirm-reset-btn').onclick = () => {
  localStorage.removeItem('cards_coins');
  localStorage.removeItem('cards_totalOpened');
  localStorage.removeItem('cards_inventory');
  localStorage.removeItem('cards_squad');
  localStorage.removeItem('cards_completed_quests');
  localStorage.removeItem('cards_last_bonus');
  
  location.reload();
};

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
    } else if (cheatCode === 'all') { 
      players.forEach(p => {
        if (!inventory[p.id]) inventory[p.id] = { count: 0 };
        inventory[p.id].count++; 
      });
      alert('🔓 Чит-код принят: Все карточки разблокированы!');
    } else if (cheatCode !== null) {
      alert('❌ Неверный код!');
    }
    
    saveState();
    updateUI();
    secretPackClicks = 0;
  }
  
  setTimeout(() => secretPackClicks = 0, 2000); 
});

updateUI();
