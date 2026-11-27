const COST = { 1: 200, 10: 1800 };
const KEY = "fuli-bear-sim-v1";

const $ = (sel, root = document) => root.querySelector(sel);

const jadeEl = $("#jade");
const bearStat = $("#total-bears");
const historyList = $("#history-list");
const summon = $("#summon");
const deal = $("#deal");
const resultKicker = $("#result-kicker");
const resultTitle = $("#result-title");
const resultSub = $("#result-sub");
const resultVoice = $("#result-voice");
const resultHero = $("#result-hero");
const bearSource = $(".actor.fuli svg");
const toastEl = $("#toast");
const modal = $("#modal");
const drawer = $("#drawer");

let jade = 60;
let totalBears = 0;
let history = [];
let busy = false;
let skipped = false;
let releaseGate = null;
let lastCount = 1;
let audioOn = true;
let audioCtx = null;
let toastTimer = 0;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (Number.isInteger(raw.jade) && raw.jade >= 0) jade = raw.jade;
    if (Number.isInteger(raw.totalBears) && raw.totalBears >= 0) totalBears = raw.totalBears;
    if (Array.isArray(raw.history)) history = raw.history.slice(0, 12);
    if (typeof raw.audioOn === "boolean") audioOn = raw.audioOn;
  } catch {
    /* keep defaults */
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      jade,
      totalBears,
      history: history.slice(0, 12),
      audioOn,
    }));
  } catch {
    /* private mode */
  }
}

function render() {
  jadeEl.textContent = jade.toLocaleString("zh-Hant");
  bearStat.textContent = String(totalBears);
  const sound = $("#sound");
  sound.textContent = audioOn ? "音效開" : "音效關";
  sound.setAttribute("aria-pressed", audioOn ? "true" : "false");
  historyList.replaceChildren();
  if (!history.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "還沒有尋覓紀錄";
    historyList.append(li);
    return;
  }
  for (const item of history) {
    const li = document.createElement("li");
    const time = new Date(item.at).toLocaleString("zh-Hant", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const kind = item.count === 10 ? "十連" : "單抽";
    const bear = item.count === 10 ? "福利熊 ×10" : "福利熊";
    const sponsor = item.sponsored ? " · 福利贊助" : "";
    li.textContent = `${time} · ${kind} · ${bear}${sponsor}`;
    historyList.append(li);
  }
}

function toast(message) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

function tone(freq, delay, length, gainValue) {
  if (!audioOn) return;
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

function bearCopy(count, sponsored) {
  if (count === 10 && sponsored) return "十連贊助到齊，十隻都是我。";
  if (count === 10) return "十張全是我，沒有看錯。";
  if (sponsored) return "輝石的事，我先幫你付了。";
  return "這一抽，是福利熊。";
}

function buildDeal(count) {
  deal.replaceChildren();
  if (count !== 10) return;
  for (let i = 0; i < 10; i += 1) {
    const card = document.createElement("div");
    card.className = "mini";
    const inner = document.createElement("div");
    inner.className = "mini-inner";
    const back = document.createElement("div");
    back.className = "mini-back";
    back.textContent = "福";
    const front = document.createElement("div");
    front.className = "mini-front";
    front.append(bearSource.cloneNode(true));
    const name = document.createElement("em");
    name.textContent = "福利熊";
    front.append(name);
    inner.append(back, front);
    card.append(inner);
    deal.append(card);
  }
}

function finish(count, sponsored) {
  const jumped = skipped;
  skipped = true;
  releaseGate?.();
  summon.dataset.phase = "reveal";
  summon.dataset.count = String(count);
  [...deal.children].forEach((card) => card.classList.add("open"));
  resultKicker.textContent = sponsored
    ? (count === 10 ? "輝石不夠，福利中心把十隻都送來了" : "輝石不夠，福利熊自己走出來了")
    : (count === 10 ? "十連尋覓結果" : "尋覓結果");
  resultTitle.textContent = count === 10 ? "福利熊 ×10" : "福利熊";
  resultSub.textContent = "CV 全聯福利中心";
  resultVoice.textContent = bearCopy(count, sponsored);
  if (jumped) chime();
  $("#ok").focus();
}

async function play(count, sponsored) {
  skipped = false;
  summon.hidden = false;
  summon.dataset.phase = "charge";
  summon.dataset.count = String(count);
  $("#summon-line").textContent = "尋覓中";
  resultHero.replaceChildren(bearSource.cloneNode(true));
  buildDeal(count);
  document.body.classList.add("locked");

  await gate(count === 10 ? 680 : 820);
  if (skipped) return finish(count, sponsored);

  if (count === 1) {
    summon.dataset.phase = "card";
    await gate(980);
    if (skipped) return finish(count, sponsored);
    summon.dataset.phase = "burst";
    chime();
    await gate(640);
    return finish(count, sponsored);
  }

  summon.dataset.phase = "deal";
  for (const card of deal.children) {
    if (skipped) break;
    card.classList.add("open");
    blip();
    await gate(150);
  }
  if (skipped) return finish(count, sponsored);
  chime();
  await gate(380);
  return finish(count, sponsored);
}

async function startPull(count) {
  if (busy) return;
  busy = true;
  lastCount = count;
  const cost = COST[count];
  const sponsored = jade < cost;
  if (!sponsored) jade -= cost;
  totalBears += count;
  history.unshift({ count, at: Date.now(), sponsored });
  history = history.slice(0, 12);
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
  $("#close-history").addEventListener("click", closeDrawer);
  $("#back").addEventListener("click", () => toast("這是模擬的第一頁"));
  $("#jade-plus").addEventListener("click", () => {
    jade += 2000;
    save();
    render();
    toast("領取福利輝石 +2000");
  });
  $("#ticket-plus").addEventListener("click", () => toast("現在沒有尋覓券"));
  $("#sound").addEventListener("click", () => {
    audioOn = !audioOn;
    save();
    render();
  });
  $("#open-book").addEventListener("click", () => toast($("#open-book").dataset.line));

  document.querySelectorAll("[data-line]").forEach((node) => {
    if (node.id === "open-book") return;
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
