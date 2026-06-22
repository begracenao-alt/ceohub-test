// ============================================================
// Be Grace CEO Hub - クラウド連携（Firebase）
// 認証 + Firestore で データを安全にクラウド保存・複数端末で同期
// ============================================================
(function () {
  "use strict";

  // ログインモーダルを最初に表示（CSSはmoduleが読み込まれる前から効くようにinlineで）
  function ensureLoginModal() {
    if (document.getElementById("bgLoginOverlay")) return;
    var ov = document.createElement("div");
    ov.id = "bgLoginOverlay";
    ov.innerHTML =
      '<style>' +
      '#bgLoginOverlay{position:fixed;inset:0;background:rgba(248,247,243,0.97);z-index:99999;display:none;align-items:center;justify-content:center;font-family:"Noto Sans JP",sans-serif;padding:20px;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}' +
      '#bgLoginOverlay.is-open{display:flex}' +
      '#bgLoginCard{background:#fff;border-radius:18px;box-shadow:0 30px 80px -30px rgba(60,90,110,0.35);padding:36px 28px;max-width:380px;width:100%;text-align:center}' +
      '#bgLoginCard h2{font-family:"Cormorant Garamond",serif;font-weight:500;font-size:22px;letter-spacing:0.2em;color:#3a96bf;margin:0 0 6px}' +
      '#bgLoginCard .sub{font-size:13px;color:#6c6a64;letter-spacing:0.1em;margin-bottom:24px}' +
      '#bgLoginCard input{width:100%;padding:13px 14px;border:1px solid rgba(50,60,70,0.15);border-radius:10px;font-size:15px;margin:6px 0;font-family:inherit;text-align:center}' +
      '#bgLoginCard input:focus{outline:none;border-color:#3a96bf}' +
      '#bgLoginCard button{width:100%;padding:13px;border:0;border-radius:999px;background:#3a96bf;color:#fff;font-size:15px;letter-spacing:0.16em;cursor:pointer;margin-top:12px;font-family:inherit;font-weight:500}' +
      '#bgLoginCard button:hover{background:#2d7da3}' +
      '#bgLoginCard .ghost{background:transparent;color:#6c6a64;border:1px solid rgba(50,60,70,0.15);margin-top:8px;letter-spacing:0.1em;font-size:13px}' +
      '#bgLoginCard .err{color:#c44b5a;font-size:12px;min-height:18px;margin-top:8px;line-height:1.5}' +
      '#bgLoginCard .info{color:#6c6a64;font-size:11px;line-height:1.7;margin-top:14px;letter-spacing:0.04em}' +
      '#bgLoginCard a{color:#3a96bf;text-decoration:none;cursor:pointer}' +
      '#bgUserBar{position:fixed;top:10px;right:10px;z-index:9999;font-size:11px;color:#6c6a64;background:rgba(255,255,255,0.85);padding:6px 12px;border-radius:999px;box-shadow:0 4px 12px -6px rgba(0,0,0,0.15);display:none;align-items:center;gap:8px}' +
      '#bgUserBar.is-open{display:flex}' +
      '#bgUserBar .sync{font-size:10px;color:#3a96bf}' +
      '#bgUserBar button{background:transparent;border:0;color:#a6a29b;font-size:11px;cursor:pointer;padding:2px 6px}' +
      '#bgUserBar button:hover{color:#c44b5a}' +
      '</style>' +
      '<div id="bgLoginCard">' +
      '  <h2>Be Grace</h2>' +
      '  <div class="sub">CEO Hub にログイン</div>' +
      '  <input type="email" id="bgEmail" placeholder="メールアドレス" autocomplete="email" />' +
      '  <input type="password" id="bgPass" placeholder="パスワード（6文字以上）" autocomplete="current-password" />' +
      '  <button id="bgLoginBtn">ログイン</button>' +
      '  <button id="bgSignupBtn" class="ghost">はじめての方はこちら（新規登録）</button>' +
      '  <div class="err" id="bgErr"></div>' +
      '  <div class="info">記録は安全な Google の クラウド に 保存されます。<br>同じメールアドレスで、 別の端末からも 見られます。</div>' +
      '</div>';
    document.body.appendChild(ov);

    var bar = document.createElement("div");
    bar.id = "bgUserBar";
    bar.innerHTML = '<span id="bgUserEmail"></span><span class="sync" id="bgSyncMark">☁ 同期中</span><button id="bgLogoutBtn">ログアウト</button>';
    document.body.appendChild(bar);
  }

  function openLogin() {
    ensureLoginModal();
    document.getElementById("bgLoginOverlay").classList.add("is-open");
    document.getElementById("bgUserBar").classList.remove("is-open");
  }
  function closeLogin() {
    var ov = document.getElementById("bgLoginOverlay");
    if (ov) ov.classList.remove("is-open");
  }
  function showUserBar(email) {
    ensureLoginModal();
    document.getElementById("bgUserBar").classList.add("is-open");
    document.getElementById("bgUserEmail").textContent = email || "";
  }
  function setSyncMark(text) {
    var el = document.getElementById("bgSyncMark");
    if (el) el.textContent = text;
  }

  // ESM Firebase SDK を非同期で読み込む
  Promise.all([
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js")
  ]).then(function (mods) {
    var initializeApp = mods[0].initializeApp;
    var auth_ = mods[1];
    var fs_ = mods[2];

    var firebaseConfig = {
      apiKey: "AIzaSyCT1jmqIMF1uPviKsq_Gl5Q-AIc4Sx9aHw",
      authDomain: "begrace-cloud.firebaseapp.com",
      projectId: "begrace-cloud",
      storageBucket: "begrace-cloud.firebasestorage.app",
      messagingSenderId: "368222814271",
      appId: "1:368222814271:web:b37248c3b27b2e8305388a",
      measurementId: "G-7YT8NL0E11"
    };

    var app = initializeApp(firebaseConfig);
    var auth = auth_.getAuth(app);
    var db = fs_.getFirestore(app);

    ensureLoginModal();
    openLogin();

    // ログインボタンの動作
    document.getElementById("bgLoginBtn").addEventListener("click", function () {
      var email = document.getElementById("bgEmail").value.trim();
      var pass = document.getElementById("bgPass").value;
      document.getElementById("bgErr").textContent = "";
      if (!email || !pass) {
        document.getElementById("bgErr").textContent = "メールアドレスとパスワードを入れてください";
        return;
      }
      auth_.signInWithEmailAndPassword(auth, email, pass).catch(function (e) {
        var msg = "ログインできませんでした。";
        if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") msg = "パスワードが違うようです。";
        if (e.code === "auth/user-not-found") msg = "そのメールアドレスは登録されていません。新規登録してください。";
        if (e.code === "auth/invalid-email") msg = "メールアドレスの形式が違うようです。";
        document.getElementById("bgErr").textContent = msg;
      });
    });

    document.getElementById("bgSignupBtn").addEventListener("click", function () {
      var email = document.getElementById("bgEmail").value.trim();
      var pass = document.getElementById("bgPass").value;
      document.getElementById("bgErr").textContent = "";
      if (!email || !pass) {
        document.getElementById("bgErr").textContent = "メールアドレスとパスワード（6文字以上）を入れてください";
        return;
      }
      if (pass.length < 6) {
        document.getElementById("bgErr").textContent = "パスワードは6文字以上にしてください";
        return;
      }
      auth_.createUserWithEmailAndPassword(auth, email, pass).catch(function (e) {
        var msg = "登録できませんでした。";
        if (e.code === "auth/email-already-in-use") msg = "そのメールアドレスは登録済みです。ログインを試してください。";
        if (e.code === "auth/weak-password") msg = "パスワードは6文字以上にしてください。";
        if (e.code === "auth/invalid-email") msg = "メールアドレスの形式が違うようです。";
        document.getElementById("bgErr").textContent = msg;
      });
    });

    document.getElementById("bgLogoutBtn").addEventListener("click", function () {
      if (!confirm("ログアウトします。よろしいですか？")) return;
      auth_.signOut(auth);
    });

    // BODY 系（個人エリアにだけ保存して 共有されない）
    var PRIVATE_KEYS = ["bodyLogs", "bodyMoves"];

    function splitData(data) {
      var shared = {};
      var priv = {};
      Object.keys(data || {}).forEach(function (k) {
        if (PRIVATE_KEYS.indexOf(k) >= 0) priv[k] = data[k];
        else shared[k] = data[k];
      });
      return { shared: shared, priv: priv };
    }

    function mergeData(shared, priv) {
      var d = {};
      if (shared) Object.keys(shared).forEach(function (k) { d[k] = shared[k]; });
      if (priv) Object.keys(priv).forEach(function (k) { d[k] = priv[k]; });
      return d;
    }

    // 自分が直近に書き込んだ内容（ループ防止用）
    var lastSent = { hubs: "", personal: "" };

    // クラウド書き込みのスロットル（共有用と個人用、別々に）
    var pending = { hubs: null, personal: null };
    var timers = { hubs: null, personal: null };
    function scheduleSave(col, data) {
      pending[col] = data;
      if (timers[col]) return;
      timers[col] = setTimeout(function () {
        var snapshot = pending[col];
        pending[col] = null;
        timers[col] = null;
        var user = auth.currentUser;
        if (!user || !snapshot) return;
        var jsonStr = JSON.stringify(snapshot);
        lastSent[col] = jsonStr;  // 自分の書き込みを記録
        setSyncMark("☁ 同期中…");
        fs_.setDoc(fs_.doc(db, col, user.uid), { json: jsonStr, at: Date.now() })
          .then(function () { setSyncMark("☁ 同期 OK"); })
          .catch(function (e) { setSyncMark("⚠ 同期エラー"); console.warn(e); });
      }, 1000);
    }
    function scheduleCloudSave(data) {
      var s = splitData(data);
      scheduleSave("hubs", s.shared);
      scheduleSave("personal", s.priv);
    }

    // 公開API
    var unsubscribeHubs = null;
    var unsubscribePersonal = null;
    window.bgCloud = {
      isLoggedIn: function () { return !!auth.currentUser; },
      saveData: scheduleCloudSave,
      logout: function () { auth_.signOut(auth); }
    };

    // 認証状態の変化を監視
    auth_.onAuthStateChanged(auth, function (user) {
      if (user) {
        closeLogin();
        showUserBar(user.email);
        // 順序を揃えて比較（早めに定義しておく）
        function stableStr2(obj) {
          if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
          if (Array.isArray(obj)) return "[" + obj.map(stableStr2).join(",") + "]";
          var ks = Object.keys(obj).sort();
          return "{" + ks.map(function (k) { return JSON.stringify(k) + ":" + stableStr2(obj[k]); }).join(",") + "}";
        }
        // 初回はクラウドからデータを取得（このタブで一度だけ）
        var loaded = sessionStorage.getItem("bgCloudLoaded");
        var lastReload = parseInt(sessionStorage.getItem("bgLastReload") || "0", 10);
        var canReload = (Date.now() - lastReload >= 5000);
        if (!loaded) {
          sessionStorage.setItem("bgCloudLoaded", "1");
          setSyncMark("☁ 読み込み中…");
          Promise.all([
            fs_.getDoc(fs_.doc(db, "hubs", user.uid)),
            fs_.getDoc(fs_.doc(db, "personal", user.uid))
          ]).then(function (snaps) {
            var sharedCloud = snaps[0].exists() && snaps[0].data().json ? JSON.parse(snaps[0].data().json) : null;
            var privCloud = snaps[1].exists() && snaps[1].data().json ? JSON.parse(snaps[1].data().json) : null;
            if (sharedCloud || privCloud) {
              var currentJson = localStorage.getItem("begrace_ceo_hub_v1");
              var currentObj = {};
              try { currentObj = currentJson ? JSON.parse(currentJson) : {}; } catch (e) {}
              var currentSplit = splitData(currentObj);
              var merged = mergeData(sharedCloud || currentSplit.shared, privCloud || currentSplit.priv);
              // キー順を揃えて比較（内容が同じなら何もしない）
              if (stableStr2(currentObj) !== stableStr2(merged) && canReload) {
                try {
                  localStorage.setItem("begrace_ceo_hub_v1", JSON.stringify(merged));
                  sessionStorage.setItem("bgLastReload", String(Date.now()));
                  setSyncMark("☁ 同期 OK");
                  location.reload();
                  return;
                } catch (e) {}
              }
            }
            setSyncMark("☁ 同期 OK");
          }).catch(function (e) {
            setSyncMark("⚠ 読み込み失敗");
            console.warn(e);
          });
        } else {
          setSyncMark("☁ 同期 OK");
        }

        // 順序を揃えて比較する（キー順違いで誤検知しないように）
        function stableStr(obj) {
          if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
          if (Array.isArray(obj)) return "[" + obj.map(stableStr).join(",") + "]";
          var ks = Object.keys(obj).sort();
          return "{" + ks.map(function (k) { return JSON.stringify(k) + ":" + stableStr(obj[k]); }).join(",") + "}";
        }
        // リアルタイム監視（共有 + 個人 別々に）
        function applyRemoteUpdate(field, value) {
          var currentJson = localStorage.getItem("begrace_ceo_hub_v1");
          var currentObj = {};
          try { currentObj = currentJson ? JSON.parse(currentJson) : {}; } catch (e) {}
          var currentSplit = splitData(currentObj);
          var nextShared = field === "shared" ? value : currentSplit.shared;
          var nextPriv = field === "priv" ? value : currentSplit.priv;
          var merged = mergeData(nextShared, nextPriv);
          // キー順を揃えて比較（内容が同じなら何もしない）
          if (stableStr(currentObj) === stableStr(merged)) return;
          // 直近のリロードから5秒以内なら、安全のためスキップ（ループ防止）
          var lastReload = parseInt(sessionStorage.getItem("bgLastReload") || "0", 10);
          if (Date.now() - lastReload < 5000) return;
          try {
            localStorage.setItem("begrace_ceo_hub_v1", JSON.stringify(merged));
            sessionStorage.setItem("bgLastReload", String(Date.now()));
            setSyncMark("☁ 他端末から更新");
            setTimeout(function () { location.reload(); }, 500);
          } catch (e) {}
        }
        // 初回スナップショットは「現在の状態を記録」だけして、reloadは起こさない
        var firstSnap = { hubs: true, personal: true };
        if (unsubscribeHubs) unsubscribeHubs();
        unsubscribeHubs = fs_.onSnapshot(fs_.doc(db, "hubs", user.uid), function (snap) {
          if (!snap.exists() || !snap.metadata || snap.metadata.hasPendingWrites) return;
          var d = snap.data();
          if (!d || !d.json) return;
          if (firstSnap.hubs) { firstSnap.hubs = false; lastSent.hubs = d.json; return; }
          if (d.json === lastSent.hubs) return;  // 自分の書き込みは無視
          try { applyRemoteUpdate("shared", JSON.parse(d.json)); } catch (e) {}
        });
        if (unsubscribePersonal) unsubscribePersonal();
        unsubscribePersonal = fs_.onSnapshot(fs_.doc(db, "personal", user.uid), function (snap) {
          if (!snap.exists() || !snap.metadata || snap.metadata.hasPendingWrites) return;
          var d = snap.data();
          if (!d || !d.json) return;
          if (firstSnap.personal) { firstSnap.personal = false; lastSent.personal = d.json; return; }
          if (d.json === lastSent.personal) return;  // 自分の書き込みは無視
          try { applyRemoteUpdate("priv", JSON.parse(d.json)); } catch (e) {}
        });
      } else {
        if (unsubscribeHubs) { unsubscribeHubs(); unsubscribeHubs = null; }
        if (unsubscribePersonal) { unsubscribePersonal(); unsubscribePersonal = null; }
        sessionStorage.removeItem("bgCloudLoaded");
        openLogin();
      }
    });
  }).catch(function (e) {
    console.error("Firebase 読み込み失敗", e);
    ensureLoginModal();
    var err = document.getElementById("bgErr");
    if (err) err.textContent = "クラウドに 繋がりませんでした。ネットを確認してください。";
    openLogin();
  });
})();
