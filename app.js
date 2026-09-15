// VALORANT TACTICAL TERMINAL // CLIENT ENGINE WITH RIOT WEB AUTH
document.addEventListener("DOMContentLoaded", () => {
  let allSkins = [];
  let currentCategory = "all";
  let currentSort = "price_desc";
  let searchQuery = "";
  let current2FASessionId = null;
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
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginBtn = document.getElementById("loginBtn");
  const emptyLoginBtn = document.getElementById("emptyLoginBtn");

  // Modal References
  const loginModal = document.getElementById("loginModal");
  const modalCloseBtn = document.getElementById("modalCloseBtn");
  const modalAlert = document.getElementById("modalAlert");
  const loginForm = document.getElementById("loginForm");
  const usernameInput = document.getElementById("usernameInput");
  const passwordInput = document.getElementById("passwordInput");
  const submitLoginBtn = document.getElementById("submitLoginBtn");
  const twoFactorForm = document.getElementById("twoFactorForm");
  const twoFactorEmail = document.getElementById("twoFactorEmail");
  const twoFactorCodeInput = document.getElementById("twoFactorCodeInput");
  const submit2faBtn = document.getElementById("submit2faBtn");
  const backToLoginBtn = document.getElementById("backToLoginBtn");

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
    } catch (err) {}

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
    if (data.status === "waiting_riot_client" || data.status === "waiting_login") {
      updateStatus("waiting", data.message || "OTURUM AÇILMASI BEKLENİYOR");
      accountPill.classList.add("hidden");
      logoutBtn.classList.add("hidden");
      resetStats();
      showStandby("OTURUM BEKLENİYOR", "Riot Client açık ise otomatik algılanır veya Riot Games hesabınız ile web üzerinden giriş yapabilirsiniz.");
      allSkins = [];
      updateCategoryCounters([]);
      return;
    }

    const acc = data.account || {};
    const name = acc.game_name || "OYUNCU";
    const tag = acc.tag_line ? `#${acc.tag_line}` : "";
    const reg = (acc.affinity || "EU").toUpperCase();
    const country = (acc.country || "TR").toUpperCase();

    if (data.auth_method === "rso_remote" || data.auth_method === "web_login") {
      updateStatus("connected", "RİOT WEB PROTOKOLÜ BAĞLANDI");
      logoutBtn.classList.remove("hidden");
    } else {
      updateStatus("connected", "RIOT CLIENT BAĞLANDI");
      logoutBtn.classList.add("hidden");
    }

    accountPill.classList.remove("hidden");
    accountName.textContent = `${name}${tag}`;
    accountRegion.textContent = `${reg} / ${country}`;

    // Stats
    const sum = data.summary || {};
    const currentVp = parseInt(totalVpEl.textContent.replace(/\D/g, "")) || 0;
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
      showStandby("ÖZEL KAPLAMA BULUNAMADI", "Bu hesapta standart varsayılan silahlar dışında özel kaplama bulunmuyor.");
    } else {
      hideStandby();
      filterAndDisplayCards();
    }
  }

  function updateStatus(type, label) {
    statusPill.className = `tactical-status ${type}`;
    statusText.textContent = label;
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

  // --- RIOT WEB LOGIN MODAL LOGIC ---
  function showLoginModal() {
    loginModal.classList.remove("hidden");
    loginForm.classList.remove("hidden");
    twoFactorForm.classList.add("hidden");
    hideModalAlert();
    usernameInput.value = "";
    passwordInput.value = "";
    usernameInput.focus();
  }

  function hideLoginModal() {
    loginModal.classList.add("hidden");
    hideModalAlert();
  }

  function showModalAlert(msg, type = "error") {
    modalAlert.textContent = msg;
    modalAlert.className = `modal-alert ${type}`;
    modalAlert.classList.remove("hidden");
  }

  function hideModalAlert() {
    modalAlert.classList.add("hidden");
    modalAlert.textContent = "";
  }

  // Step 1: Submit Username & Password
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showModalAlert("Lütfen kullanıcı adı ve şifrenizi girin.", "error");
      return;
    }

    submitLoginBtn.disabled = true;
    showModalAlert("Riot sunucularına bağlanılıyor...", "loading");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (data.status === "success") {
        hideLoginModal();
        renderTerminal(data);
      } else if (data.status === "2fa_required") {
        current2FASessionId = data.session_id;
        loginForm.classList.add("hidden");
        twoFactorForm.classList.remove("hidden");
        twoFactorEmail.textContent = data.email ? `Kod e-postanıza (${data.email}) gönderildi.` : "E-postanıza gönderilen kodu girin.";
        twoFactorCodeInput.value = "";
        twoFactorCodeInput.focus();
        showModalAlert("2FA Kodu Gönderildi.", "loading");
      } else {
        showModalAlert(data.message || "Giriş başarısız oldu.", "error");
      }
    } catch (err) {
      showModalAlert("Sunucu bağlantı hatası. Lütfen tekrar deneyin.", "error");
    } finally {
      submitLoginBtn.disabled = false;
    }
  });

  // Step 2: Submit 2FA Code
  twoFactorForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const code = twoFactorCodeInput.value.trim();

    if (!code || !current2FASessionId) {
      showModalAlert("Lütfen doğrulama kodunu girin.", "error");
      return;
    }

    submit2faBtn.disabled = true;
    showModalAlert("Kod doğrulanıyor...", "loading");

    try {
      const res = await fetch("/api/verify-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: current2FASessionId, code })
      });

      const data = await res.json();

      if (data.status === "success") {
        hideLoginModal();
        renderTerminal(data);
      } else {
        showModalAlert(data.message || "Geçersiz 2FA kodu.", "error");
      }
    } catch (err) {
      showModalAlert("Doğrulama hatası oluştu.", "error");
    } finally {
      submit2faBtn.disabled = false;
    }
  });

  backToLoginBtn.addEventListener("click", () => {
    twoFactorForm.classList.add("hidden");
    loginForm.classList.remove("hidden");
    hideModalAlert();
  });

  modalCloseBtn.addEventListener("click", hideLoginModal);
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) hideLoginModal();
  });

  loginBtn.addEventListener("click", showLoginModal);
  if (emptyLoginBtn) {
    emptyLoginBtn.addEventListener("click", showLoginModal);
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
      logoutBtn.classList.add("hidden");
      await fetchInventory();
    } catch (err) {
      console.error("Çıkış hatası:", err);
    }
  });

  // Search & Filter Events
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

  refreshBtn.addEventListener("click", fetchInventory);

  fetchInventory();
  pollingInterval = setInterval(fetchInventory, 3500);
});
