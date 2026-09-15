// VALORANT TACTICAL TERMINAL // CLIENT ENGINE
document.addEventListener("DOMContentLoaded", () => {
  let allSkins = [];
  let currentCategory = "all";
  let currentSort = "price_desc";
  let searchQuery = "";
  let isDemoActive = false;
  let pollingInterval = null;

  // DOM References
  const statusPill = document.getElementById("statusPill");
  const statusText = document.getElementById("statusText");
  const accountPill = document.getElementById("accountPill");
  const accountName = document.getElementById("accountName");
  const accountRegion = document.getElementById("accountRegion");
  
  const totalVpEl = document.getElementById("totalVp");
  const totalTryEl = document.getElementById("totalTry");
  const walletVpEl = document.getElementById("walletVp");
  const walletRpEl = document.getElementById("walletRp");
  const walletKcEl = document.getElementById("walletKc");
  const totalSkinsCountEl = document.getElementById("totalSkinsCount");
  const knivesCountEl = document.getElementById("knivesCount");
  const highTierCountEl = document.getElementById("highTierCount");

  const searchInput = document.getElementById("searchInput");
  const clearSearchBtn = document.getElementById("clearSearch");
  const sortSelect = document.getElementById("sortSelect");
  const categoryTabs = document.getElementById("categoryTabs");
  const filteredCountText = document.getElementById("filteredCountText");
  const skinsGrid = document.getElementById("skinsGrid");
  const emptyState = document.getElementById("emptyState");
  const emptyTitle = document.getElementById("emptyTitle");
  const emptyDesc = document.getElementById("emptyDesc");
  const emptyDemoBtn = document.getElementById("emptyDemoBtn");

  const demoBtn = document.getElementById("demoBtn");
  const demoBtnText = document.getElementById("demoBtnText");
  const refreshBtn = document.getElementById("refreshBtn");

  const catCountAll = document.getElementById("catCountAll");
  const catCountMelee = document.getElementById("catCountMelee");
  const catCountRifle = document.getElementById("catCountRifle");
  const catCountSniper = document.getElementById("catCountSniper");
  const catCountHigh = document.getElementById("catCountHigh");
  const catCountBp = document.getElementById("catCountBp");

  // Number animation helper
  function animateValue(el, start, end, duration = 600, suffix = "") {
    if (!el) return;
    const startTime = performance.now();
    const diff = end - start;
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + diff * ease);
      el.textContent = current.toLocaleString("tr-TR") + suffix;
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = end.toLocaleString("tr-TR") + suffix;
      }
    }
    requestAnimationFrame(update);
  }

  async function fetchInventory() {
    try {
      const res = await fetch("/api/inventory");
      if (res.ok) {
        const data = await res.json();
        renderTerminal(data);
        return;
      }
    } catch (err) {
      // Local backend not reachable, proceed to static fallback
    }

    try {
      const staticRes = await fetch("inventory.json");
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        renderTerminal(staticData);
        updateStatus("connected", "BULUT ENTEGRASYONU AKTİF (7/24)");
        return;
      }
    } catch (staticErr) {
      console.error("Static data fetch failed:", staticErr);
    }

    updateStatus("waiting", "SİSTEM BAĞLANTISI BEKLENİYOR");
  }

  function renderTerminal(data) {
    isDemoActive = data.is_demo || false;
    updateDemoButton();

    if (data.status === "waiting_riot_client") {
      updateStatus("waiting", "RIOT CLIENT BEKLENİYOR");
      accountPill.classList.add("hidden");
      resetStats();
      showStandby("RIOT CLIENT KAPALI", "Bilgisayarınızda Riot Client veya VALORANT başlatıldığında hesabınız otomatik olarak taranacaktır.");
      allSkins = [];
      updateCategoryCounters([]);
      return;
    }

    if (data.status === "waiting_login") {
      updateStatus("waiting", "OTURUM AÇILMASI BEKLENİYOR");
      accountPill.classList.add("hidden");
      resetStats();
      showStandby("OTURUM BEKLENİYOR", "Riot Client açık fakat kullanıcı girişi yapılmamış. Lütfen giriş yapın.");
      allSkins = [];
      updateCategoryCounters([]);
      return;
    }

    const acc = data.account || {};
    const name = acc.game_name || "OYUNCU";
    const tag = acc.tag_line ? `#${acc.tag_line}` : "";
    const reg = (acc.affinity || "EU").toUpperCase();
    const country = (acc.country || "TR").toUpperCase();

    if (isDemoActive) {
      updateStatus("connected", "DEMO SİMÜLASYONU AKTİF");
    } else {
      updateStatus("connected", "RIOT GATEWAY BAĞLANDI");
    }

    accountPill.classList.remove("hidden");
    accountName.textContent = `${name}${tag}`;
    accountRegion.textContent = `${reg} / ${country}`;

    // Stats
    const sum = data.summary || {};
    const currentVp = parseInt(totalVpEl.textContent.replace(/\\D/g, "")) || 0;
    animateValue(totalVpEl, currentVp, sum.total_vp || 0, 500);
    totalTryEl.textContent = `${Number(sum.total_try || 0).toLocaleString("tr-TR")} ₺`;
    totalSkinsCountEl.textContent = sum.total_skins || 0;
    knivesCountEl.textContent = sum.knives_count || 0;
    highTierCountEl.textContent = sum.high_tier_count || 0;

    // Wallet
    const wallet = data.wallet || {};
    walletVpEl.textContent = `${Number(wallet.vp || 0).toLocaleString("tr-TR")} VP`;
    walletRpEl.textContent = `${Number(wallet.radianite || 0).toLocaleString("tr-TR")} RP`;
    walletKcEl.textContent = `${Number(wallet.kc || 0).toLocaleString("tr-TR")} KC`;

    allSkins = data.skins || [];
    updateCategoryCounters(allSkins);

    if (allSkins.length === 0) {
      showStandby("ÖZEL KAPLAMA BULUNAMADI", "Bu hesapta standart varsayılan silahlar dışında özel kaplama bulunmuyor. Başka bir hesaba geçtiğinizde sistem anında güncellenir.");
    } else {
      hideStandby();
      filterAndDisplayCards();
    }
  }

  function updateStatus(type, label) {
    statusPill.className = `tactical-status ${type}`;
    statusText.textContent = label;
  }

  function updateDemoButton() {
    if (isDemoActive) {
      demoBtn.classList.add("active");
      demoBtnText.textContent = "CANLI HESAP";
    } else {
      demoBtn.classList.remove("active");
      demoBtnText.textContent = "DEMO MODU";
    }
  }

  function resetStats() {
    totalVpEl.textContent = "0";
    totalTryEl.textContent = "0 ₺";
    totalSkinsCountEl.textContent = "0";
    knivesCountEl.textContent = "0";
    highTierCountEl.textContent = "0";
    walletVpEl.textContent = "0 VP";
    walletRpEl.textContent = "0 RP";
    walletKcEl.textContent = "0 KC";
  }

  function showStandby(title, desc) {
    skinsGrid.innerHTML = "";
    emptyTitle.textContent = title;
    emptyDesc.textContent = desc;
    emptyState.classList.remove("hidden");
    filteredCountText.textContent = "0 / 0 KAPLAMA GÖRÜNTÜLENİYOR";
  }

  function hideStandby() {
    emptyState.classList.add("hidden");
  }

  function updateCategoryCounters(skins) {
    catCountAll.textContent = skins.length;
    catCountMelee.textContent = skins.filter(s => s.is_melee).length;
    catCountRifle.textContent = skins.filter(s => s.weapon_category === "rifle").length;
    catCountSniper.textContent = skins.filter(s => s.weapon_category === "sniper").length;
    catCountHigh.textContent = skins.filter(s => s.tier_rank >= 3).length;
    catCountBp.textContent = skins.filter(s => s.is_battlepass).length;
  }

  function filterAndDisplayCards() {
    if (allSkins.length === 0) return;

    let filtered = allSkins.filter(skin => {
      if (currentCategory === "melee" && !skin.is_melee) return false;
      if (currentCategory === "rifle" && skin.weapon_category !== "rifle") return false;
      if (currentCategory === "sniper" && skin.weapon_category !== "sniper") return false;
      if (currentCategory === "hightier" && skin.tier_rank < 3) return false;
      if (currentCategory === "bp" && !skin.is_battlepass) return false;

      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        const matchName = skin.name.toLowerCase().includes(q);
        const matchWeapon = skin.weapon.toLowerCase().includes(q);
        const matchTier = skin.tier_name.toLowerCase().includes(q);
        if (!matchName && !matchWeapon && !matchTier) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (currentSort === "price_desc") return (b.price_vp - a.price_vp) || (b.tier_rank - a.tier_rank);
      if (currentSort === "price_asc") return (a.price_vp - b.price_vp) || (a.tier_rank - b.tier_rank);
      if (currentSort === "tier_desc") return (b.tier_rank - a.tier_rank) || (b.price_vp - a.price_vp);
      if (currentSort === "name_asc") return a.name.localeCompare(b.name, "tr");
      return 0;
    });

    filteredCountText.textContent = `${filtered.length} / ${allSkins.length} KAPLAMA ÇÖZÜMLENDİ`;

    if (filtered.length === 0) {
      skinsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px; color: var(--text-dim); background: var(--bg-terminal); border: 1px solid var(--border-subtle); border-radius: 4px;">
          <div style="font-family: var(--font-mono); font-size: 13px; letter-spacing: 1px;">// FİLTRE KRİTERLERİNE UYGUN VERİ BULUNAMADI</div>
        </div>
      `;
      return;
    }

    skinsGrid.innerHTML = filtered.map((skin, idx) => {
      const tierColor = skin.tier_color || "#475569";
      const iconUrl = skin.icon || "https://media.valorant-api.com/weapons/vandal/displayicon.png";
      const priceVp = Number(skin.price_vp).toLocaleString("tr-TR");
      const priceTry = Number(skin.price_try).toLocaleString("tr-TR");
      const delay = Math.min(idx * 0.03, 0.45);

      let levelText = "";
      if (skin.unlocked_chromas > 0) {
        levelText = `${skin.unlocked_chromas} RENK`;
      } else if (skin.total_levels > 1) {
        levelText = `SEVİYE ${skin.unlocked_levels}/${skin.total_levels}`;
      } else {
        levelText = "STANDART";
      }

      return `
        <div class="tactical-card" style="--tier-accent: ${tierColor}; --tier-glow: ${tierColor}25; animation-delay: ${delay}s;">
          <div class="card-hairline"></div>
          
          <div class="card-meta-top">
            <span class="weapon-type-badge">${skin.weapon.toUpperCase()}</span>
            <span class="tier-code-badge">${skin.badge}</span>
          </div>

          <div class="weapon-stage">
            <img src="${iconUrl}" alt="${skin.name}" loading="lazy" onerror="this.src='https://media.valorant-api.com/weapons/vandal/displayicon.png'">
          </div>

          <div class="card-content">
            <div class="skin-heading" title="${skin.name}">${skin.name}</div>
            
            <div class="card-footer">
              <div class="price-block">
                <div class="vp-display">
                  <span>${priceVp}</span>
                  <span class="vp-code">VP</span>
                </div>
                <div class="fiat-display">≈ ${priceTry} ₺</div>
              </div>

              <div class="level-badge">
                ${levelText}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  // Event Handlers
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    if (searchQuery.length > 0) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }
    filterAndDisplayCards();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    searchQuery = "";
    clearSearchBtn.classList.add("hidden");
    filterAndDisplayCards();
  });

  sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    filterAndDisplayCards();
  });

  categoryTabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill-btn");
    if (!btn) return;
    document.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategory = btn.dataset.category;
    filterAndDisplayCards();
  });

  async function toggleDemo() {
    try {
      const r = await fetch("/api/toggle-demo", { method: "POST" });
      if (r.ok) {
        await fetchInventory();
        return;
      }
    } catch (e) {}

    // Static fallback toggle
    isDemoActive = !isDemoActive;
    updateDemoButton();
    if (isDemoActive) {
      renderTerminal({
        status: "success",
        is_demo: true,
        account: { game_name: "TACTICAL_DEMO", tag_line: "VCT", affinity: "eu", country: "tr" },
        wallet: { vp: 4250, radianite: 180, kc: 8400 },
        summary: { total_skins: 24, total_vp: 49200, total_try: 13278, knives_count: 5, high_tier_count: 14 },
        skins: getDemoSkins()
      });
    } else {
      await fetchInventory();
    }
  }

  function getDemoSkins() {
    return [
      { name: "Champions 2021 Vandal", weapon: "VANDAL", weapon_category: "rifle", is_melee: false, tier_name: "Seçkin", tier_color: "#ffd700", badge: "VCT // CHAMPIONS", price_vp: 2675, price_try: 722, tier_rank: 6, unlocked_levels: 4, total_levels: 4, unlocked_chromas: 0, icon: "https://media.valorant-api.com/weaponskins/b576b9f1-407d-310a-6009-6287fb6829bc/displayicon.png" },
      { name: "Kuronami Vandal", weapon: "VANDAL", weapon_category: "rifle", is_melee: false, tier_name: "Seçkin", tier_color: "#f5955b", badge: "TIER // EXCLUSIVE", price_vp: 2175, price_try: 587, tier_rank: 5, unlocked_levels: 4, total_levels: 4, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/c4883e50-4494-202c-3ec3-6b8a9284f00b/displayicon.png" },
      { name: "Yağmacı Karambit", weapon: "BIÇAK", weapon_category: "melee", is_melee: true, tier_name: "İhtişamlı", tier_color: "#d1548d", badge: "TIER // PREMIUM", price_vp: 3550, price_try: 958, tier_rank: 3, unlocked_levels: 3, total_levels: 3, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/4986a893-48a5-4c23-11f2-70bb9e9d284d/displayicon.png" },
      { name: "Ejder Ateşi Vandal", weapon: "VANDAL", weapon_category: "rifle", is_melee: false, tier_name: "Ultra", tier_color: "#fad663", badge: "TIER // ULTRA", price_vp: 2475, price_try: 668, tier_rank: 4, unlocked_levels: 4, total_levels: 4, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/9b62faf1-416c-b736-0edb-39b890f1f18d/displayicon.png" },
      { name: "Asil//2.0 Phantom", weapon: "PHANTOM", weapon_category: "rifle", is_melee: false, tier_name: "İhtişamlı", tier_color: "#d1548d", badge: "TIER // PREMIUM", price_vp: 1775, price_try: 479, tier_rank: 3, unlocked_levels: 4, total_levels: 4, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/2715f184-46cc-bec1-dd7c-e7b4d1aeb625/displayicon.png" },
      { name: "Kaosun Başlangıcı Vandal", weapon: "VANDAL", weapon_category: "rifle", is_melee: false, tier_name: "Seçkin", tier_color: "#f5955b", badge: "TIER // EXCLUSIVE", price_vp: 2175, price_try: 587, tier_rank: 5, unlocked_levels: 4, total_levels: 4, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/310b80d8-4e1b-b4f0-b713-9dad458ce734/displayicon.png" },
      { name: "İyon Operatör", weapon: "OPERATÖR", weapon_category: "sniper", is_melee: false, tier_name: "İhtişamlı", tier_color: "#d1548d", badge: "TIER // PREMIUM", price_vp: 1775, price_try: 479, tier_rank: 3, unlocked_levels: 4, total_levels: 4, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/44064b11-4e74-19c9-80a4-9f80875adaf5/displayicon.png" },
      { name: "Artizan Flöre", weapon: "BIÇAK", weapon_category: "melee", is_melee: true, tier_name: "Seçkin", tier_color: "#f5955b", badge: "TIER // EXCLUSIVE", price_vp: 4350, price_try: 1175, tier_rank: 5, unlocked_levels: 1, total_levels: 1, unlocked_chromas: 3, icon: "https://media.valorant-api.com/weaponskins/f3f962bd-4a19-b363-e939-6a91b897a28c/displayicon.png" }
    ];
  }

  demoBtn.addEventListener("click", toggleDemo);
  emptyDemoBtn.addEventListener("click", toggleDemo);
  refreshBtn.addEventListener("click", fetchInventory);

  // Initial load & 3-second live refresh
  fetchInventory();
  pollingInterval = setInterval(fetchInventory, 3000);
});
