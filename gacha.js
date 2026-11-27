(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Gacha = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function gachaFactory() {
  // 雀魂尋覓公示：雀士 5%、裝扮 15%、禮物 80%。
  // 禮物之中紫色 6.25%、藍色 93.75%（全體即紫禮 5%、藍禮 75%）。
  // 限時池的 UP 裝扮占裝扮機率 49%。
  // 十連依官方機率表：9 次獨立尋覓，再固定 1 個紫色禮物。
  const CHARACTER_RATE = 0.05;
  const OUTFIT_RATE = 0.15;
  const PURPLE_GIFT_SHARE = 0.0625;
  const OUTFIT_UP_SHARE = 0.49;

  const CHARACTERS = [
    { id: "daquan", name: "大全熊" },
    { id: "fuli", name: "福利熊" },
    { id: "apple", name: "蘋狗" },
    { id: "kiwi", name: "奇異狗" },
  ];

  const OUTFITS = [
    { id: "kiwi-up", name: "奇異狗・新裝扮", up: true },
    { id: "fan", name: "櫻花團扇" },
    { id: "scroll", name: "竹簡掛軸" },
    { id: "charm", name: "祈願護符" },
    { id: "stick", name: "星見立直棒" },
    { id: "card", name: "尋覓卡面" },
  ];

  const BLUE_GIFTS = [
    { id: "cookie-b", name: "藍罐曲奇", series: "曲奇" },
    { id: "art-b", name: "精美掛畫", series: "美術品" },
    { id: "gem-b", name: "鴿子蛋寶石", series: "鑽石" },
    { id: "book-b", name: "簡裝同人志", series: "同人志" },
    { id: "game-b", name: "Twitch掌機", series: "遊戲機" },
    { id: "wine-b", name: "香醇紅酒", series: "酒" },
    { id: "doll-b", name: "熊公仔L", series: "玩偶" },
    { id: "dress-b", name: "普通的小裙子", series: "女裝" },
  ];

  const PURPLE_GIFTS = [
    { id: "cookie-p", name: "香噴噴曲奇", series: "曲奇" },
    { id: "art-p", name: "經典名畫", series: "美術品" },
    { id: "gem-p", name: "海洋之心", series: "鑽石" },
    { id: "book-p", name: "精美同人志", series: "同人志" },
    { id: "game-p", name: "次世代遊戲機", series: "遊戲機" },
    { id: "wine-p", name: "82年的拉菲", series: "酒" },
    { id: "doll-p", name: "熊公仔XXL", series: "玩偶" },
    { id: "dress-p", name: "華麗的小裙子", series: "女裝" },
  ];

  function stamp(item, kind, rarity) {
    return {
      id: item.id,
      name: item.name,
      series: item.series || "",
      kind,
      rarity,
    };
  }

  function pick(list, random) {
    return list[Math.floor(random() * list.length)];
  }

  function rollOnce(rng) {
    const random = rng || Math.random;
    const ticket = random();
    if (ticket < CHARACTER_RATE) {
      return stamp(pick(CHARACTERS, random), "character", "character");
    }
    if (ticket < CHARACTER_RATE + OUTFIT_RATE) {
      if (random() < OUTFIT_UP_SHARE) return stamp(OUTFITS[0], "outfit", "outfit-up");
      return stamp(pick(OUTFITS.slice(1), random), "outfit", "outfit");
    }
    if (random() < PURPLE_GIFT_SHARE) return stamp(pick(PURPLE_GIFTS, random), "gift", "purple");
    return stamp(pick(BLUE_GIFTS, random), "gift", "blue");
  }

  function rollTen(rng) {
    const random = rng || Math.random;
    const results = [];
    for (let i = 0; i < 9; i += 1) results.push(rollOnce(random));
    results.push(stamp(pick(PURPLE_GIFTS, random), "gift", "purple"));
    for (let i = results.length - 1; i > 0; i -= 1) {
      const swap = Math.floor(random() * (i + 1));
      const held = results[i];
      results[i] = results[swap];
      results[swap] = held;
    }
    return results;
  }

  function best(results) {
    const rank = { character: 5, "outfit-up": 4, purple: 3, outfit: 2, blue: 1 };
    return results.reduce((top, item) => (rank[item.rarity] > rank[top.rarity] ? item : top), results[0]);
  }

  return {
    CHARACTERS,
    OUTFITS,
    BLUE_GIFTS,
    PURPLE_GIFTS,
    rollOnce,
    rollTen,
    best,
  };
});
