const KEY = "fuli-bear-sim-v2";

const $ = (sel, root = document) => root.querySelector(sel);

const jadeEl = $("#jade");
const ticketEl = $("#tickets");
const historyList = $("#history-list");
const summon = $("#summon");
const deal = $("#deal");
const stageCard = $("#stage-card");
const stageFront = $("#stage-front");
const stageCount = $("#stage-count");
const pillar = $("#pillar");
const sparks = $(".sparks");
const resultKicker = $("#result-kicker");
const resultTitle = $("#result-title");
const resultRarity = $("#result-rarity");
const resultSub = $("#result-sub");
const resultVoice = $("#result-voice");
const resultHero = $("#result-hero");
const toastEl = $("#toast");
const modal = $("#modal");
const drawer = $("#drawer");
const shop = $("#shop");

const state = {
  jade: 60,
  tickets: 0,
  faith: 0,
  wish: 0,
  star: 0,
  characters: [],
  outfits: [],
  gifts: {},
  history: [],
  audioOn: true,
};

let busy = false;
let skipped = false;
let releaseGate = null;
let lastCount = 1;
let current = [];
let audioCtx = null;
let toastTimer = 0;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    ["jade", "tickets", "faith", "wish", "star"].forEach((key) => {
      if (Number.isInteger(raw[key]) && raw[key] >= 0) state[key] = raw[key];
    });
    if (Array.isArray(raw.characters)) state.characters = raw.characters;
    if (Array.isArray(raw.outfits)) state.outfits = raw.outfits;
    if (raw.gifts && typeof raw.gifts === "object") state.gifts = raw.gifts;
    if (Array.isArray(raw.history)) state.history = raw.history.slice(0, 12);
    if (typeof raw.audioOn === "boolean") state.audioOn = raw.audioOn;
  } catch {
    /* keep defaults */
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

function ownedNames(ids, pool) {
  return ids.map((id) => pool.find((item) => item.id === id)?.name).filter(Boolean);
}

function renderShop() {
  shop.replaceChildren();
  const faithLine = document.createElement("p");
  faithLine.className = "vault-stats";
  faithLine.textContent = `信仰 ${state.faith} · 許願石 ${state.wish} · 星之石 ${state.star}`;
  shop.append(faithLine);

  const owned = document.createElement("p");
  const names = ownedNames(state.characters, Gacha.CHARACTERS);
  const outfitNames = ownedNames(state.outfits, Gacha.OUTFITS);
  const giftCount = Object.values(state.gifts).reduce((sum, count) => sum + count, 0);
  owned.textContent = `雀士：${names.length ? names.join("、") : "還沒有"}　裝扮：${outfitNames.length ? outfitNames.join("、") : "還沒有"}　禮物 ${giftCount}`;
  shop.append(owned);

  Gacha.CHARACTERS.forEach((item) => shop.append(shopButton(item, "character", 150)));
  Gacha.OUTFITS.forEach((item) => shop.append(shopButton(item, "outfit", 50)));
}

function shopButton(item, kind, cost) {
  const owned = (kind === "character" ? state.characters : state.outfits).includes(item.id);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shop-btn";
  button.textContent = owned ? `${item.name}　已持有` : `${cost} 信仰兌換 ${item.name}`;
  button.disabled = owned;
  button.addEventListener("click", () => exchange(item, kind, cost));
  return button;
}

function exchange(item, kind, cost) {
  const list = kind === "character" ? state.characters : state.outfits;
  if (list.includes(item.id)) return;
  if (state.faith < cost) {
    toast(`信仰還差 ${cost - state.faith}`);
    return;
  }
  state.faith -= cost;
  list.push(item.id);
  save();
  render();
  toast(`兌換了${item.name}`);
}

function render() {
  jadeEl.textContent = state.jade.toLocaleString("zh-Hant");
  ticketEl.textContent = state.tickets.toLocaleString("zh-Hant");
  const sound = $("#sound");
  sound.textContent = state.audioOn ? "音效開" : "音效關";
  sound.setAttribute("aria-pressed", state.audioOn ? "true" : "false");
  const bears = state.characters.length;
  $("#total-bears").textContent = String(bears);
  historyList.replaceChildren();
  if (!state.history.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "還沒有尋覓紀錄";
    historyList.append(li);
  } else {
    state.history.forEach((item) => {
      const li = document.createElement("li");
      const time = new Date(item.at).toLocaleString("zh-Hant", {
        timeZone: "Asia/Taipei",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const kind = item.count === 10 ? "十連" : "單抽";
      const sponsor = item.sponsored ? " · 福利贊助" : "";
      li.textContent = `${time} · ${kind} · ${item.summary}${sponsor}`;
      historyList.append(li);
    });
  }
  renderShop();
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2400);
}

function tone(freq, delay, length, gainValue) {
  if (!state.audioOn) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  const start = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

function chime() {
  [392, 494, 587, 784].forEach((freq, index) => tone(freq, index * 0.07, 0.34, 0.05));
}

function blip() {
  tone(680, 0, 0.12, 0.03);
}

function fanfare(item) {
  if (!item) return;
  if (item.kind === "character" || item.rarity === "outfit-up") chime();
  else if (item.rarity === "purple") tone(587, 0, 0.28, 0.05);
  else blip();
}

function gate(ms) {
  if (skipped) return Promise.resolve();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const delay = reduce ? 0 : ms;
  if (delay <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      releaseGate = null;
      resolve();
    }, delay);
    releaseGate = () => {
      window.clearTimeout(timer);
      releaseGate = null;
      resolve();
    };
  });
}

function skip() {
  if (summon.hidden || summon.dataset.phase === "reveal") return;
  skipped = true;
  releaseGate?.();
}

function pay(count) {
  if (count === 1) {
    if (state.tickets >= 1) {
      state.tickets -= 1;
      return false;
    }
    if (state.jade >= 200) {
      state.jade -= 200;
      return false;
    }
    return true;
  }
  if (state.tickets >= 10) {
    state.tickets -= 10;
    return false;
  }
  if (state.jade >= 1800) {
    state.jade -= 1800;
    return false;
  }
  return true;
}

function grant(item) {
  state.faith += 1;
  if (item.kind === "character") {
    if (state.characters.includes(item.id)) {
      state.wish += 75;
      item.duplicate = true;
    } else state.characters.push(item.id);
  } else if (item.kind === "outfit") {
    if (state.outfits.includes(item.id)) {
      state.star += 5;
      item.duplicate = true;
    } else state.outfits.push(item.id);
  } else {
    state.gifts[item.id] = (state.gifts[item.id] || 0) + 1;
  }
}

function summaryOf(results) {
  const notable = results.filter((item) => item.kind === "character" || item.rarity === "purple" || item.rarity === "outfit-up");
  const shown = (notable.length ? notable : results.slice(0, 2)).map((item) => item.name);
  return shown.join("、");
}

function headline(results) {
  const characters = results.filter((item) => item.kind === "character");
  if (characters.length) {
    const counts = new Map();
    characters.forEach((item) => counts.set(item.name, (counts.get(item.name) || 0) + 1));
    return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name)).join("、");
  }
  return Gacha.best(results).name;
}

function rarityLabel(item) {
  if (item.kind === "character") return "雀士";
  if (item.rarity === "outfit-up") return "UP 裝扮";
  if (item.kind === "outfit") return "裝扮";
  if (item.rarity === "purple") return "紫色禮物";
  return "藍色禮物";
}

function fillFace(node, item) {
  node.classList.add(`rarity-${item.rarity}`);
  if (item.kind === "character") {
    const svg = $(`.actor.${item.id} svg`);
    if (svg) node.append(svg.cloneNode(true));
  } else {
    const mark = document.createElement("span");
    mark.className = "mark";
    mark.textContent = item.rarity === "purple" ? "紫" : item.rarity === "blue" ? "藍" : "扮";
    node.append(mark);
  }
  const name = document.createElement("em");
  name.textContent = item.name;
  node.append(name);
  if (!item.duplicate && (item.kind === "character" || item.kind === "outfit")) {
    const tag = document.createElement("span");
    tag.className = "new-tag";
    tag.textContent = "NEW";
    node.append(tag);
  }
}

function showHero(item) {
  resultHero.replaceChildren();
  if (item.kind === "character") {
    const svg = $(`.actor.${item.id} svg`);
    if (svg) resultHero.append(svg.cloneNode(true));
    return;
  }
  const card = document.createElement("div");
  card.className = `prize rarity-${item.rarity}`;
  card.textContent = item.name;
  resultHero.append(card);
}

function buildDeal(results) {
  deal.replaceChildren();
  results.forEach((item) => {
    const card = document.createElement("div");
    card.className = "mini";
    const inner = document.createElement("div");
    inner.className = "mini-inner";
    const back = document.createElement("div");
    back.className = "mini-back";
    back.textContent = "福";
    const front = document.createElement("div");
    front.className = "mini-front";
    fillFace(front, item);
    inner.append(back, front);
    card.append(inner);
    deal.append(card);
  });
}

const BEAT = {
  blue: { glow: 280, after: 260 },
  outfit: { glow: 520, after: 380 },
  purple: { glow: 760, after: 480 },
  "outfit-up": { glow: 1150, after: 820 },
  character: { glow: 1320, after: 980 },
};

function finish(count, sponsored) {
  const jumped = skipped;
  skipped = true;
  releaseGate?.();
  const results = current;
  const focus = count === 1 ? results[0] : Gacha.best(results);
  summon.dataset.phase = "reveal";
  summon.dataset.count = String(count);
  [...deal.children].forEach((card) => card.classList.add("open"));
  showHero(focus);
  resultKicker.textContent = sponsored
    ? "輝石和尋覓券都不夠，這一抽由福利中心贊助"
    : (count === 10 ? "十連尋覓結果" : "尋覓結果");
  resultRarity.textContent = rarityLabel(focus);
  resultTitle.textContent = count === 10 ? headline(results) : results[0].name;
  resultTitle.classList.toggle("long", resultTitle.textContent.length > 8);
  if (focus.kind === "character") resultSub.textContent = "CV 全聯福利中心";
  else if (focus.kind === "gift") resultSub.textContent = focus.series ? `${focus.series}系列` : rarityLabel(focus);
  else resultSub.textContent = rarityLabel(focus);
  const notes = [`信仰 +${count}`];
  const dupes = results.filter((item) => item.duplicate);
  if (dupes.some((item) => item.kind === "character")) notes.push("重複雀士變成許願石");
  if (dupes.some((item) => item.kind === "outfit")) notes.push("重複裝扮變成星之石");
  resultVoice.textContent = notes.join(" · ");
  summon.classList.remove("bursting");
  if (jumped) fanfare(focus);
  $("#ok").focus();
}

function pulseSparks() {
  sparks.classList.remove("go");
  void sparks.offsetWidth;
  sparks.classList.add("go");
}

async function presentCard(item, index, total) {
  if (skipped) return;
  const beat = BEAT[item.rarity] || BEAT.blue;
  const high = item.rarity === "character" || item.rarity === "outfit-up";
  summon.dataset.phase = "stage";
  summon.dataset.rarity = item.rarity;
  summon.classList.remove("bursting");
  stageCount.textContent = total > 1 ? `${index + 1} / ${total}` : "";
  stageFront.replaceChildren();
  stageFront.className = "stage-front";
  fillFace(stageFront, item);
  stageCard.className = "stage-card";
  pillar.className = "pillar";
  void stageCard.offsetWidth;
  stageCard.classList.add("live");
  pillar.classList.add("on");
  pulseSparks();
  tone(196, 0, 0.08, 0.03);
  await gate(beat.glow);
  if (skipped) return;
  stageCard.classList.add("open");
  if (high) {
    void summon.offsetWidth;
    summon.classList.add("bursting");
    chime();
  } else if (item.rarity === "purple" || item.kind === "outfit") {
    tone(494, 0, 0.16, 0.04);
    tone(659, 0.07, 0.2, 0.035);
  } else blip();
  await gate(beat.after);
}

async function play(count, sponsored) {
  skipped = false;
  summon.hidden = false;
  summon.dataset.phase = "charge";
  summon.dataset.count = String(count);
  summon.dataset.rarity = "";
  summon.classList.remove("bursting");
  $("#summon-line").textContent = "尋覓中";
  resultHero.replaceChildren();
  buildDeal(current);
  document.body.classList.add("locked");

  await gate(460);
  if (skipped) return finish(count, sponsored);

  for (let i = 0; i < current.length; i += 1) {
    if (skipped) return finish(count, sponsored);
    await presentCard(current[i], i, current.length);
  }
  return finish(count, sponsored);
}

async function startPull(count) {
  if (busy) return;
  busy = true;
  lastCount = count;
  const sponsored = pay(count);
  current = count === 10 ? Gacha.rollTen() : [Gacha.rollOnce()];
  current.forEach(grant);
  state.history.unshift({
    count,
    at: Date.now(),
    sponsored,
    summary: summaryOf(current),
  });
  state.history = state.history.slice(0, 12);
  save();
  render();
  try {
    await play(count, sponsored);
  } catch (error) {
    console.error(error);
    closeSummon();
    toast("演出中斷了，再試一次");
  } finally {
    busy = false;
  }
}

function closeSummon() {
  summon.hidden = true;
  summon.dataset.phase = "idle";
  document.body.classList.remove("locked");
  $("#pull-one").focus();
}

function openModal() {
  modal.hidden = false;
  $("#modal-close").focus();
}

function closeModal() {
  modal.hidden = true;
  $("#open-detail").focus();
}

function openDrawer() {
  drawer.hidden = false;
  window.requestAnimationFrame(() => drawer.classList.add("open"));
}

function closeDrawer() {
  drawer.classList.remove("open");
  window.setTimeout(() => {
    if (!drawer.classList.contains("open")) drawer.hidden = true;
  }, 280);
}

function scatterPetals() {
  const layer = $(".petals");
  if (layer.childElementCount) return;
  for (let i = 0; i < 18; i += 1) {
    const petal = document.createElement("i");
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.animationDuration = `${8 + Math.random() * 9}s`;
    petal.style.animationDelay = `${-Math.random() * 12}s`;
    petal.style.opacity = String(0.45 + Math.random() * 0.5);
    layer.append(petal);
  }
}

function scatterSparks() {
  const layer = $(".sparks");
  if (layer.childElementCount) return;
  for (let i = 0; i < 16; i += 1) {
    const spark = document.createElement("i");
    spark.style.setProperty("--a", `${i * 22.5}deg`);
    layer.append(spark);
  }
}

function init() {
  load();
  render();
  scatterPetals();
  scatterSparks();

  $("#pull-one").addEventListener("click", () => startPull(1));
  $("#pull-ten").addEventListener("click", () => startPull(10));
  $("#again").addEventListener("click", () => {
    closeSummon();
    startPull(lastCount);
  });
  $("#ok").addEventListener("click", closeSummon);
  $("#skip").addEventListener("click", skip);
  $("#open-detail").addEventListener("click", openModal);
  $("#modal-close").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  $("#open-history").addEventListener("click", openDrawer);
  $("#open-book").addEventListener("click", openDrawer);
  $("#close-history").addEventListener("click", closeDrawer);
  $("#back").addEventListener("click", () => toast("這是模擬的第一頁"));
  $("#jade-plus").addEventListener("click", () => {
    state.jade += 2000;
    save();
    render();
    toast("領取福利輝石 +2000");
  });
  $("#ticket-plus").addEventListener("click", () => {
    state.tickets += 1;
    save();
    render();
    toast("領取尋覓券 +1");
  });
  $("#sound").addEventListener("click", () => {
    state.audioOn = !state.audioOn;
    save();
    render();
  });

  document.querySelectorAll("[data-line]").forEach((node) => {
    node.addEventListener("click", () => toast(node.dataset.line));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!modal.hidden) {
      closeModal();
      return;
    }
    if (!drawer.hidden) {
      closeDrawer();
      return;
    }
    if (summon.hidden) return;
    if (summon.dataset.phase === "reveal") closeSummon();
    else skip();
  });
}

init();
