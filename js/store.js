/* ============================================================
   Be Grace CEO Hub — データ層 (store.js)
   - すべてのデータはブラウザ内(localStorage)に保存されます
   - JSONファイルへのバックアップ / 復元に対応（外部設定不要・永久に動作）
   - Googleスプレッドシート同期はオプション（任意でオン）
   ============================================================ */
(function () {
  "use strict";

  var KEY = "begrace_ceo_hub_v1";

  // 初期データ構造
  function blank() {
    return {
      settings: {
        repName: "", bizName: "", bizType: "個人事業主",
        mainBiz: "", mainProduct: "", price: "",
        monthlyGoal: "", yearlyGoal: "",
        idealWork: "", idealTeam: "", monthTheme: "",
        todayWord: "未来は今日の積み重ね",
        stage: "", goal: "", stageChecks: {}
      },
      sales: [],       // 売上
      expenses: [],    // 経費
      customers: [],   // 顧客
      projects: [],    // プロジェクト/タスク
      contents: [],    // 発信
      contentCats: ["Instagramリール", "ストーリーズ", "スレッズ", "LINE", "YouTube", "ブログ", "メルマガ"], // 発信カテゴリー（追加・削除できる）
      dailyPosts: {},  // （旧）毎日の発信チェック
      snsStats: [],    // SNSフォロワー記録 [{date, counts:{アカウント:数}}]
      snsAccounts: ["Instagram", "スレッズ", "LINE公式", "YouTube", "メルマガ"], // フォロワー記録の対象アカウント（追加・削除できる）
      payMethods: ["現金", "Amex", "楽天カード", "あおぞら銀行", "楽天銀行"], // 経費の支払方法（追加・編集・削除できる）
      receiveMethods: ["現金", "PayPal", "あおぞら銀行", "楽天銀行"],          // 売上の入金方法（追加・編集・削除できる）
      debitAccounts: ["あおぞら銀行", "楽天銀行"],                          // 経費の引落口座（追加・編集・削除できる）
      schedule: [],    // 予定・予約・アポ [{date, title}]
      bodyLogs: [],    // カラダ&エネルギー（日次）
      bodyMoves: ["枕運動", "ヨガ", "散歩"], // BODYの運動項目（追加・削除できる）
      team: [],        // チーム
      manuals: [],     // マニュアル
      future: {        // 未来設定
        monthly: { salesGoal: "", profitGoal: "", idealState: "", todo: "", stop: "", theme: "" },
        yearly: { salesGoal: "", profitGoal: "", peopleGoal: "", dream: "", growBiz: "", lifestyle: "", idealTeam: "", hireCount: "", socialValue: "" }
      },
      wheel: [],       // ライフバランスホイール（履歴）
      weekly: [],      // 週次ミーティング
      todos: {},       // 今日やること { "YYYY-MM-DD": [{text, done}] }
      diagnosis: [],   // 「今日の戦略」のログ
      links: [],       // リンク集（貼って・コピーできる） [{id, name, url}]
      sync: { enabled: false, url: "", lastSync: "" }
    };
  }

  var data = load();
  var lastDeleted = null; // 直前に削除したもの（元に戻す用）

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      var parsed = JSON.parse(raw);
      return mergeDefaults(parsed, blank());
    } catch (e) {
      console.warn("データ読み込み失敗、初期化します", e);
      return blank();
    }
  }

  // 旧データに新フィールドが無くても壊れないよう補完
  function mergeDefaults(obj, def) {
    if (Array.isArray(def)) return Array.isArray(obj) ? obj : def;
    if (typeof def === "object" && def !== null) {
      var out = {};
      var keys = Object.keys(def).concat(Object.keys(obj || {}));
      keys.forEach(function (k) {
        if (out.hasOwnProperty(k)) return;
        if (obj && obj.hasOwnProperty(k)) {
          out[k] = (typeof def[k] === "object" && def[k] !== null && !Array.isArray(def[k]))
            ? mergeDefaults(obj[k], def[k]) : obj[k];
        } else {
          out[k] = def[k];
        }
      });
      return out;
    }
    return obj === undefined ? def : obj;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      alert("保存に失敗しました。ブラウザの空き容量をご確認ください。");
    }
    // クラウド（Firebase）にも保存
    if (window.bgCloud && window.bgCloud.saveData) {
      try { window.bgCloud.saveData(data); } catch (e) {}
    }
    if (data.sync && data.sync.enabled && data.sync.url) {
      pushToSheet(); // 失敗してもローカルは守られる
    }
  }

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e6).toString(36);
  }

  /* ---------- 公開API ---------- */
  var store = {
    all: function () { return data; },

    settings: function () { return data.settings; },
    saveSettings: function (s) { data.settings = Object.assign(data.settings, s); persist(); },

    future: function () { return data.future; },
    saveFuture: function (f) { data.future = f; persist(); },

    setContentCats: function (arr) { data.contentCats = arr; persist(); },
    setBodyMoves: function (arr) { data.bodyMoves = arr; persist(); },
    setSnsAccounts: function (arr) { data.snsAccounts = arr; persist(); },
    setPayMethods: function (arr) { data.payMethods = arr; persist(); },
    setReceiveMethods: function (arr) { data.receiveMethods = arr; persist(); },
    setDebitAccounts: function (arr) { data.debitAccounts = arr; persist(); },

    getDailyPosts: function () { return data.dailyPosts || {}; },
    toggleDailyPost: function (date, medium) {
      data.dailyPosts = data.dailyPosts || {};
      var arr = data.dailyPosts[date] = data.dailyPosts[date] || [];
      var i = arr.indexOf(medium);
      if (i >= 0) arr.splice(i, 1); else arr.push(medium);
      persist();
    },

    list: function (col) { return data[col] || []; },

    add: function (col, item) {
      item.id = uid();
      data[col] = data[col] || [];
      data[col].unshift(item);
      persist();
      return item;
    },

    update: function (col, id, patch) {
      var arr = data[col] || [];
      for (var i = 0; i < arr.length; i++) {
        if (arr[i].id === id) { Object.assign(arr[i], patch); break; }
      }
      persist();
    },

    remove: function (col, id) {
      var arr = data[col] || [];
      var idx = -1, item = null;
      for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) { idx = i; item = arr[i]; break; } }
      data[col] = arr.filter(function (x) { return x.id !== id; });
      if (item) lastDeleted = { col: col, item: item, index: idx, ts: Date.now() };
      persist();
    },

    clearCol: function (col) {
      lastDeleted = { col: col, prevArr: (data[col] || []).slice(), ts: Date.now() };
      data[col] = [];
      persist();
    },

    // 直前の削除を元に戻す
    restoreLast: function () {
      if (!lastDeleted) return false;
      var ld = lastDeleted; lastDeleted = null;
      if (ld.prevArr) {
        data[ld.col] = ld.prevArr;
      } else {
        var arr = data[ld.col] || (data[ld.col] = []);
        var idx = ld.index; if (idx < 0 || idx > arr.length) idx = 0;
        arr.splice(idx, 0, ld.item);
      }
      persist();
      return true;
    },
    hasUndo: function () { return !!lastDeleted && (Date.now() - lastDeleted.ts < 12000); },

    find: function (col, id) {
      return (data[col] || []).filter(function (x) { return x.id === id; })[0];
    },

    // 今日やること
    todosFor: function (date) { return data.todos[date] || []; },
    saveTodos: function (date, arr) { data.todos[date] = arr; persist(); },

    // 診断ログ
    addDiagnosis: function (entry) { data.diagnosis.unshift(entry); persist(); },

    /* ---------- バックアップ / 復元（外部設定不要） ---------- */
    exportJSON: function () {
      return JSON.stringify(data, null, 2);
    },
    importJSON: function (text) {
      var parsed = JSON.parse(text); // 失敗時は例外
      data = mergeDefaults(parsed, blank());
      persist();
    },
    download: function () {
      var blob = new Blob([store.exportJSON()], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      var d = new Date();
      var stamp = d.getFullYear() + ("0" + (d.getMonth() + 1)).slice(-2) + ("0" + d.getDate()).slice(-2);
      a.href = url;
      a.download = "BeGrace_CEOHub_backup_" + stamp + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    resetAll: function () {
      data = blank();
      persist();
    },

    /* ---------- Googleスプレッドシート同期（オプション） ---------- */
    sync: function () { return data.sync; },
    enableSync: function (url) {
      data.sync.enabled = true;
      data.sync.url = url.trim();
      persist();
    },
    disableSync: function () {
      data.sync.enabled = false;
      persist();
    }
  };

  function pushToSheet() {
    try {
      fetch(data.sync.url, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "save", payload: data })
      }).then(function () {
        data.sync.lastSync = new Date().toISOString();
      }).catch(function () { /* オフラインでもローカルは安全 */ });
    } catch (e) { /* noop */ }
  }
  store.pushToSheet = pushToSheet;

  window.BG = window.BG || {};
  window.BG.store = store;
})();
