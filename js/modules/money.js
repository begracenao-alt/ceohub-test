/* ===== ① Money｜お金管理（確定申告まで対応） ===== */
(function () {
  "use strict";
  var S = BG.store, U = BG.ui;

  var selYear = String(new Date().getFullYear());

  // 集計（ダッシュボードからも使う）
  function calc() {
    var sales = S.list("sales"), exp = S.list("expenses");
    var mSales = 0, ySales = 0, mExp = 0, yExp = 0, unpaid = 0, monthDue = 0;
    sales.forEach(function (r) {
      var a = U.num(r.amount);
      if (U.inThisYear(r.date)) ySales += a;
      if (U.inThisMonth(r.date)) mSales += a;
      if (!r.paid) {
        unpaid += a;
        if (U.inThisMonth(r.dueDate)) monthDue += a;
      }
    });
    exp.forEach(function (r) {
      var a = U.num(r.amount);
      if (U.inThisYear(r.date)) yExp += a;
      if (U.inThisMonth(r.date)) mExp += a;
    });
    var goal = U.num(S.settings().monthlyGoal);
    return {
      mSales: mSales, ySales: ySales, mExp: mExp, yExp: yExp,
      mProfit: mSales - mExp, yProfit: ySales - yExp,
      unpaid: unpaid, monthDue: monthDue,
      goal: goal, toGoal: Math.max(0, goal - mSales),
      rate: goal > 0 ? Math.min(100, Math.round(mSales / goal * 100)) : 0
    };
  }

  // 確定申告の勘定科目（個人事業主向け・よく使うもの）
  var KANJO = ["広告宣伝費", "旅費交通費", "通信費", "消耗品費", "会議費", "接待交際費", "外注工賃",
    "地代家賃", "水道光熱費", "支払手数料", "研修費", "新聞図書費", "仕入", "減価償却費",
    "租税公課", "損害保険料", "修繕費", "荷造運賃", "福利厚生費", "給料賃金", "雑費"];

  // 一覧から選んでも、その場で打ち込んでもOK（datalist）
  function payOpts() { return S.list("payMethods"); }       // 経費の支払方法
  function recvOpts() { return S.list("receiveMethods"); }   // 売上の入金方法
  function acctOpts() { return S.list("debitAccounts"); }    // 経費の引落口座

  // 打ち込まれた値が一覧になければ、次回のために覚える（自動で追加）
  function remember(kind, val) {
    val = (val || "").trim();
    if (!val) return;
    var map = { pay: "payMethods", recv: "receiveMethods", acct: "debitAccounts" };
    var setter = { pay: "setPayMethods", recv: "setReceiveMethods", acct: "setDebitAccounts" };
    var arr = S.list(map[kind]);
    if (arr.indexOf(val) < 0) S[setter[kind]](arr.concat([val]));
  }
  // 経費の保存時：支払方法と引落口座、両方を覚える
  function rememberExp(v) { remember("pay", v.payMethod); remember("acct", v.debitAccount); }

  // フォームは、その時点の最新リストで作る（関数にしておく）
  function saleFields() {
    return [
      { name: "date", label: "日付", type: "date", value: U.todayStr() },
      { name: "customer", label: "顧客名／取引先名", type: "text" },
      { name: "product", label: "商品／サービス名", type: "text" },
      { name: "amount", label: "売上金額", type: "money" },
      { name: "payMethod", label: "入金方法（選ぶ／自分で入力もOK）", type: "selectadd", options: recvOpts(), placeholder: "入金方法を選ぶ" },
      { name: "dueDate", label: "入金予定日", type: "date" },
      { name: "paidDate", label: "入金日（実際に入金された日）", type: "date" },
      { name: "paid", label: "入金済み", type: "checkbox" },
      { name: "memo", label: "メモ", type: "textarea", full: true }
    ];
  }
  function expFields() {
    return [
      { name: "date", label: "日付", type: "date", value: U.todayStr() },
      { name: "payee", label: "支払先（お店・相手のお名前）", type: "text" },
      { name: "content", label: "内容（何に使ったか）", type: "text" },
      { name: "amount", label: "金額", type: "money" },
      { name: "category", label: "勘定科目（選ぶ／自分で入力もOK）", type: "selectadd", options: KANJO, placeholder: "勘定科目を選ぶ" },
      { name: "usage", label: "事業／共通", type: "select", options: ["事業", "共通"], value: "事業" },
      { name: "payMethod", label: "支払方法（選ぶ／自分で入力もOK）", type: "selectadd", options: payOpts(), placeholder: "支払方法を選ぶ" },
      { name: "debitAccount", label: "引落口座（選ぶ／自分で入力もOK）", type: "selectadd", options: acctOpts(), placeholder: "引落口座を選ぶ" },
      { name: "debitDate", label: "引落予定日", type: "date" },
      { name: "hasReceipt", label: "レシート・領収書あり", type: "checkbox" },
      { name: "docPlace", label: "書類の保存場所メモ", type: "text", placeholder: "例：ファイルA／〇〇フォルダ／写真に保存" },
      { name: "memo", label: "メモ", type: "textarea", full: true }
    ];
  }

  function yearOf(d) { return (d || "").slice(0, 4); }
  function byYear(y) { return function (r) { return yearOf(r.date) === y; }; }

  // 確定申告まとめ（選んだ年）
  function taxSummary(y) {
    var income = 0, expense = 0, byCat = {};
    S.list("sales").filter(byYear(y)).forEach(function (r) { income += U.num(r.amount); });
    S.list("expenses").filter(byYear(y)).forEach(function (r) {
      var a = U.num(r.amount); expense += a;
      var c = r.category || "未分類";
      byCat[c] = (byCat[c] || 0) + a;
    });
    return { income: income, expense: expense, profit: income - expense, byCat: byCat };
  }

  function availableYears() {
    var set = {};
    set[String(new Date().getFullYear())] = true;
    S.list("sales").concat(S.list("expenses")).forEach(function (r) {
      var y = yearOf(r.date); if (y) set[y] = true;
    });
    return Object.keys(set).sort().reverse();
  }

  function render(view) {
    var c = calc();
    var html = "";
    html += '<p class="page-lead">売上＝入ってきたお金　／　経費＝事業のために使ったお金　／　利益＝売上−経費</p>';

    html += '<div class="grid grid-4">' +
      U.stat("今月売上", U.yen(c.mSales), null, "accent") +
      U.stat("今月経費", U.yen(c.mExp)) +
      U.stat("今月利益", U.yen(c.mProfit), null, c.mProfit >= 0 ? "" : "rose") +
      U.stat("目標まで", U.yen(c.toGoal), c.goal ? c.rate + "% 達成" : "目標未設定", "rose") +
      '</div>';

    html += '<div class="grid grid-4 mt">' +
      U.stat("年間売上", U.yen(c.ySales)) +
      U.stat("年間経費", U.yen(c.yExp)) +
      U.stat("年間利益", U.yen(c.yProfit)) +
      U.stat("未入金額", U.yen(c.unpaid), "今月入金予定 " + U.yen(c.monthDue)) +
      '</div>';

    // 確定申告まとめ
    var years = availableYears();
    if (years.indexOf(selYear) < 0) selYear = years[0];
    var sum = taxSummary(selYear);
    var yearBtns = years.map(function (y) {
      return '<button class="choice' + (y === selYear ? " sel" : "") + '" data-year="' + y + '">' + y + '年</button>';
    }).join("");
    var catRows = Object.keys(sum.byCat).sort(function (a, b) { return sum.byCat[b] - sum.byCat[a]; });
    var catBody = catRows.length ? catRows.map(function (k) {
      return '<tr><td>' + U.esc(k) + '</td><td class="num">' + U.yen(sum.byCat[k]) + '</td></tr>';
    }).join("") : U.emptyRow(2, "経費を記録すると、科目べつに集計されます");

    html += '<div class="card mt" style="border-left:3px solid var(--gold)">' +
      '<div class="card-title">確定申告まとめ</div>' +
      '<div class="choices" style="margin-bottom:16px">' + yearBtns + '</div>' +
      '<div class="grid grid-3">' +
      U.stat("収入（売上）", U.yen(sum.income)) +
      U.stat("経費", U.yen(sum.expense)) +
      U.stat("所得（利益）", U.yen(sum.profit), null, "accent") +
      '</div>' +
      '<div style="font-size:13px;font-weight:600;margin:18px 0 8px">経費の内訳（勘定科目べつ）</div>' +
      '<div class="table-wrap"><table><thead><tr><th>勘定科目</th><th class="num">金額</th></tr></thead><tbody>' +
      catBody + '</tbody></table></div>' +
      '<p class="hint" style="margin:14px 0">この数字を、確定申告の「収支内訳書／青色申告決算書」にそのまま書き写せます。正確な区分・控除（家事按分・青色控除など）は、税理士さんや税務署にご確認ください。</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="btn btn-primary" id="csvOut">' + selYear + '年の集計を書き出す（CSV）</button>' +
      '<button class="btn" id="ledgerOut">📒 ' + selYear + '年の帳簿を書き出す（税理士さん用）</button>' +
      '</div>' +
      '<p class="hint" style="margin-top:10px">「帳簿」は、売上・経費を1件ずつ並べた明細です（売上帳・経費帳）。税理士さんに渡すときは、まず「この形でよいか・ほしい項目」を確認してもらうと安心です。青色申告の正式な帳簿（複式簿記での65万円控除など）は、この明細をもとに税理士さん・会計ソフトで仕上げる形になります。</p>' +
      '</div>';

    // 売上テーブル（画面内スクロール＝エンドレス防止）
    html += '<div class="card mt">' + U.sectionHead("売上", "売上を追加", "addSale") + tableSales() + clearBtn("sales", "clrSale", "売上") + '</div>';
    // 経費テーブル
    html += '<div class="card">' + U.sectionHead("経費", "経費を追加", "addExp") + tableExp() + clearBtn("expenses", "clrExp", "経費") + '</div>';
    // 支払方法・受け取り方法の編集
    html += '<div style="text-align:right;margin:2px 0 10px"><button class="btn btn-sm" id="mgMethods">🛠 支払方法・入金方法・引落口座の一覧を整える（削除・並べ替え）</button></div>';
    // 勘定科目の早見表（下に）
    html += hayamiHTML();
    // データを取り込む（コピー＆貼り付け）※いちばん下に
    html += '<div class="card mt"><div class="card-title">前のデータを取り込む（スプレッドシート／エクセル）</div>' +
      '<p class="hint" style="margin-bottom:10px">今までつけていた分を、コピー＆貼り付けで取り込めます。<br>① スプレッドシートで取り込みたい範囲を選んで<strong>コピー</strong> → ② 下の枠をクリックして<strong>貼り付け（⌘V）</strong> → ③ 下の<strong>売上／経費ボタン</strong>を押す。<br>列の順番がちがっても、中身を見て自動で読み取ります。完璧に移さなくても、今日から入れていけば十分です。</p>' +
      '<textarea id="pasteBox" placeholder="ここに、スプレッドシートからコピーした表を貼り付け（⌘V）" style="width:100%;min-height:100px;font-family:inherit;font-size:13px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface-2);color:var(--ink)"></textarea>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">' +
      '<button class="btn btn-primary" id="pasteSale">売上として取り込む</button>' +
      '<button class="btn btn-primary" id="pasteExp">経費として取り込む</button>' +
      '</div></div>';

    view.innerHTML = html;

    view.querySelectorAll("[data-year]").forEach(function (b) {
      b.onclick = function () { selYear = b.getAttribute("data-year"); render(view); };
    });
    document.getElementById("csvOut").onclick = function () { exportCSV(selYear); };
    document.getElementById("ledgerOut").onclick = function () { exportLedger(selYear); };
    document.getElementById("mgMethods").onclick = function () { manageMethods(view); };

    // 取り込み（コピペ）
    function wirePaste(btnId, type) {
      document.getElementById(btnId).onclick = function () {
        var txt = document.getElementById("pasteBox").value;
        if (!txt.trim()) { alert("先に、スプレッドシートからコピーした表を貼り付けてください。"); return; }
        importPaste(txt, type, function () { render(view); });
      };
    }
    wirePaste("pasteSale", "sales");
    wirePaste("pasteExp", "expenses");

    document.getElementById("addSale").onclick = function () {
      U.recordModal({ title: "売上を追加", fields: saleFields(), values: { date: U.todayStr() },
        onSave: function (v) { remember("recv", v.payMethod); S.add("sales", v); U.toast("売上を追加しました"); render(view); } });
    };
    document.getElementById("addExp").onclick = function () {
      U.recordModal({ title: "経費を追加", fields: expFields(), values: { date: U.todayStr() },
        onSave: function (v) { rememberExp(v); S.add("expenses", v); U.toast("経費を追加しました"); render(view); } });
    };
    var cs2 = document.getElementById("clrSale");
    if (cs2) cs2.onclick = function () {
      U.confirmDelete("売上の記録をすべて削除しますか？元に戻せません（取り込みミスのやり直しに）。", function () {
        S.clearCol("sales"); U.toast("売上を全部削除しました"); render(view);
      });
    };
    var ce2 = document.getElementById("clrExp");
    if (ce2) ce2.onclick = function () {
      U.confirmDelete("経費の記録をすべて削除しますか？元に戻せません（取り込みミスのやり直しに）。", function () {
        S.clearCol("expenses"); U.toast("経費を全部削除しました"); render(view);
      });
    };

    bindRows(view);
  }

  // CSV書き出し（Excelで文字化けしないようBOM付き）
  function csvCell(v) {
    var s = (v === undefined || v === null) ? "" : String(v);
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function yesNo(b) { return b ? "あり" : "なし"; }
  function paidLabel(r) { return r.paid ? "入金済" : "未入金"; }
  function exportCSV(y) {
    var sales = S.list("sales").filter(byYear(y)).slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var exp = S.list("expenses").filter(byYear(y)).slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var sum = taxSummary(y);
    var L = [];
    L.push("Be Grace CEO Hub｜" + y + "年 確定申告まとめ");
    L.push("");
    L.push("【まとめ】");
    L.push("収入（売上）," + U.num(sum.income));
    L.push("経費," + U.num(sum.expense));
    L.push("所得（利益）," + U.num(sum.profit));
    L.push("");
    L.push("【経費の内訳（勘定科目べつ）】");
    L.push("勘定科目,金額");
    Object.keys(sum.byCat).sort(function (a, b) { return sum.byCat[b] - sum.byCat[a]; }).forEach(function (k) {
      L.push(csvCell(k) + "," + U.num(sum.byCat[k]));
    });
    L.push("");
    L.push("【売上の明細】");
    L.push("日付,顧客／取引先,商品／サービス,金額,入金,入金予定日,入金日,入金方法,メモ");
    sales.forEach(function (r) {
      L.push([csvCell(r.date), csvCell(r.customer), csvCell(r.product), U.num(r.amount),
        paidLabel(r), csvCell(r.dueDate), csvCell(r.paidDate), csvCell(r.payMethod), csvCell(r.memo)].join(","));
    });
    L.push("");
    L.push("【経費の明細】");
    L.push("日付,支払先,内容,勘定科目,事業区分,金額,支払方法,引落口座,引落予定日,領収書,書類保存場所,メモ");
    exp.forEach(function (r) {
      L.push([csvCell(r.date), csvCell(r.payee), csvCell(r.content), csvCell(r.category), csvCell(r.usage), U.num(r.amount),
        csvCell(r.payMethod), csvCell(r.debitAccount), csvCell(r.debitDate), yesNo(r.hasReceipt), csvCell(r.docPlace), csvCell(r.memo)].join(","));
    });
    var blob = new Blob(["﻿" + L.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "BeGrace_確定申告まとめ_" + y + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    U.toast(y + "年ぶんを書き出しました");
  }

  // 帳簿（取引明細）を書き出す ── 税理士さんに渡せる、1件ずつのきれいな表
  function exportLedger(y) {
    var sales = S.list("sales").filter(byYear(y)).slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var exp = S.list("expenses").filter(byYear(y)).slice().sort(function (a, b) { return (a.date || "").localeCompare(b.date || ""); });
    var L = [];
    L.push("Be Grace CEO Hub｜" + y + "年 帳簿（取引明細）");
    L.push("");
    L.push("【売上帳】");
    L.push("日付,勘定科目,金額,摘要（商品・サービス）,取引先（顧客名）,入金方法,入金予定日,入金日,入金状況,メモ");
    sales.forEach(function (r) {
      L.push([csvCell(r.date), "売上高", U.num(r.amount), csvCell(r.product), csvCell(r.customer),
        csvCell(r.payMethod), csvCell(r.dueDate), csvCell(r.paidDate), paidLabel(r), csvCell(r.memo)].join(","));
    });
    L.push("売上 合計,," + U.num(sales.reduce(function (s, r) { return s + U.num(r.amount); }, 0)));
    L.push("");
    L.push("【経費帳】");
    L.push("日付,支払先,勘定科目,事業区分,金額,摘要（内容）,支払方法,引落口座,引落予定日,領収書,書類保存場所,メモ");
    exp.forEach(function (r) {
      L.push([csvCell(r.date), csvCell(r.payee), csvCell(r.category), csvCell(r.usage), U.num(r.amount), csvCell(r.content),
        csvCell(r.payMethod), csvCell(r.debitAccount), csvCell(r.debitDate), yesNo(r.hasReceipt), csvCell(r.docPlace), csvCell(r.memo)].join(","));
    });
    L.push("経費 合計,,,," + U.num(exp.reduce(function (s, r) { return s + U.num(r.amount); }, 0)));
    var blob = new Blob(["﻿" + L.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "BeGrace_帳簿_" + y + ".csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    U.toast(y + "年の帳簿を書き出しました");
  }

  // 勘定科目の早見表
  var HAYAMI = [
    ["動画編集・デザイン・代行などの外注", "外注工賃"],
    ["講座・セミナー・コンサルの受講", "研修費"],
    ["本・教材・資料", "新聞図書費"],
    ["ネット・携帯・サーバー・Zoomなど", "通信費"],
    ["広告・SNS広告・チラシ・名刺", "広告宣伝費"],
    ["備品・文房具・撮影小物（10万円未満）", "消耗品費"],
    ["移動・電車・ガソリン・駐車場", "旅費交通費"],
    ["打合せのお茶代・軽食・会議室代", "会議費"],
    ["お礼・贈り物・接待のお食事", "接待交際費"],
    ["振込・決済の手数料", "支払手数料"],
    ["家賃・レンタルスペース", "地代家賃"],
    ["電気・ガス・水道", "水道光熱費"],
    ["商品の仕入れ", "仕入"],
    ["高額な機材（10万円以上）", "減価償却費"],
    ["どれにも当てはまらないもの", "雑費"]
  ];
  function hayamiHTML() {
    var body = HAYAMI.map(function (r) {
      return '<tr><td>' + U.esc(r[0]) + '</td><td><span class="badge gray">' + U.esc(r[1]) + '</span></td></tr>';
    }).join("");
    return '<div class="card"><div class="card-title">勘定科目の早見表（どれに入れる？）</div>' +
      '<p class="hint" style="margin-bottom:10px">迷ったら、ここを見てください。「内容」欄には自由に書けます（例：内容「動画編集」＋ 勘定科目「外注工賃」）。</p>' +
      '<div class="table-wrap"><table><thead><tr><th>こんな経費は…</th><th>勘定科目</th></tr></thead><tbody>' +
      body + '</tbody></table></div></div>';
  }

  /* ---- エクセル/CSV 取り込み ---- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, "");
    var rows = [], row = [], cur = "", inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { row.push(cur); cur = ""; }
        else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (ch === "\r") { /* skip */ }
        else cur += ch;
      }
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
  }
  function normAmount(s) {
    var n = parseFloat(String(s).replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? 0 : Math.round(n);
  }
  function normDate(s) {
    s = String(s).trim();
    var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
    m = s.match(/^(\d{1,2})\D+(\d{1,2})$/);
    if (m) return String(new Date().getFullYear()) + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
    return "";
  }
  function findCol(headers, keys) {
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).trim();
      for (var k = 0; k < keys.length; k++) if (h.indexOf(keys[k]) >= 0) return i;
    }
    return -1;
  }
  function looksHeader(row) {
    return row.some(function (c) { return /日付|金額|顧客|内容|科目|商品|取引先|費目|カテゴリ/.test(String(c)); });
  }
  function parseTable(text) {
    text = text.replace(/^﻿/, "");
    if (text.indexOf("\t") >= 0) {
      return text.split(/\r?\n/).map(function (l) { return l.split("\t"); })
        .filter(function (r) { return r.some(function (c) { return String(c).trim() !== ""; }); });
    }
    return parseCSV(text);
  }
  function importCSV(text, type, done, year) { importRows(parseCSV(text), type, done, year); }
  function importPaste(text, type, done, year) { importRows(parseTable(text), type, done, year); }

  // 中身で判断して列を読み取る（列の順番・分かれた日付に強い）
  function isIntInRange(s, lo, hi) { s = String(s).trim(); return /^\d{1,2}$/.test(s) && +s >= lo && +s <= hi; }
  function pickDate(cells, year) {
    var i;
    for (i = 0; i < cells.length; i++) { var d = normDate(cells[i]); if (d) return { date: d, used: [i] }; }
    for (i = 0; i < cells.length - 2; i++) {
      var y = String(cells[i]).trim();
      if (/^\d{4}$/.test(y) && +y >= 2000 && isIntInRange(cells[i + 1], 1, 12) && isIntInRange(cells[i + 2], 1, 31))
        return { date: y + "-" + ("0" + cells[i + 1]).slice(-2) + "-" + ("0" + cells[i + 2]).slice(-2), used: [i, i + 1, i + 2] };
    }
    for (i = 0; i < cells.length - 1; i++) {
      if (isIntInRange(cells[i], 1, 12) && isIntInRange(cells[i + 1], 1, 31))
        return { date: year + "-" + ("0" + cells[i]).slice(-2) + "-" + ("0" + cells[i + 1]).slice(-2), used: [i, i + 1] };
    }
    return { date: "", used: [] };
  }
  function isKanjoish(s) { s = String(s).trim(); return KANJO.indexOf(s) >= 0 || /(費|料)$/.test(s); }
  function smartRow(cells, type, year) {
    var used = {}, i;
    var dr = pickDate(cells, year);
    dr.used.forEach(function (k) { used[k] = 1; });
    var amt = 0, amtIdx = -1;
    for (i = 0; i < cells.length; i++) {
      if (used[i]) continue;
      var t = String(cells[i]).replace(/[,，¥￥\s]/g, "");
      if (/^-?\d+(\.\d+)?$/.test(t)) { var n = Math.abs(parseFloat(t)); if (n >= amt) { amt = n; amtIdx = i; } }
    }
    if (amtIdx >= 0) used[amtIdx] = 1;
    var cat = "", catIdx = -1;
    if (type !== "sales") {
      for (i = 0; i < cells.length; i++) { if (used[i]) continue; if (isKanjoish(cells[i])) { cat = String(cells[i]).trim(); catIdx = i; break; } }
      if (catIdx >= 0) used[catIdx] = 1;
    }
    var texts = [];
    for (i = 0; i < cells.length; i++) { if (used[i]) continue; var s = String(cells[i]).trim(); if (s) texts.push(s); }
    if (type === "sales") {
      return { date: dr.date, customer: texts[0] || "", product: texts[1] || "", amount: Math.round(amt), dueDate: "", paid: true, memo: texts.slice(2).join(" ") };
    }
    return { date: dr.date, content: texts.join(" "), amount: Math.round(amt), category: cat || "雑費", memo: "" };
  }

  function importRows(rows, type, done, year) {
    if (!rows.length) { alert("データが見つかりませんでした。"); return; }
    year = year || String(new Date().getFullYear());
    var start = looksHeader(rows[0]) ? 1 : 0;
    var items = [];
    for (var j = start; j < rows.length; j++) {
      var it = smartRow(rows[j], type, year);
      if (!it.date && !it.amount) continue;
      items.push(it);
    }
    if (!items.length) { alert("取り込める行がありませんでした。日付と金額がある表か、ご確認ください。"); return; }
    if (!confirm(items.length + "件を取り込みます。よろしいですか？\n（あとで1件ずつ編集・削除できます。ちがっていたら「全部削除」でやり直せます）")) return;
    var col = type === "sales" ? "sales" : "expenses";
    items.forEach(function (it) { S.add(col, it); });
    U.toast(items.length + "件を取り込みました");
    done();
  }

  // 方法（支払・受け取り）のセル表示。未選択は「—」
  function methodCell(v) {
    return v ? '<span class="badge gray">' + U.esc(v) + '</span>' : '<span class="muted">—</span>';
  }

  function tableSales() {
    var rows = S.list("sales").slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var body = rows.length ? rows.map(function (r) {
      return '<tr>' +
        '<td>' + U.fmtDate(r.date) + '</td>' +
        '<td>' + U.esc(r.customer) + '</td>' +
        '<td>' + U.esc(r.product) + '</td>' +
        '<td class="num">' + U.yen(r.amount) + '</td>' +
        '<td>' + (r.paid ? '<span class="badge ok">入金済</span>' : '<span class="badge warn">未入金</span>') + '</td>' +
        '<td>' + U.fmtDate(r.dueDate) + '</td>' +
        '<td>' + methodCell(r.payMethod) + '</td>' +
        '<td class="row-actions">' + editDel("sales", r.id) + '</td>' +
        '</tr>';
    }).join("") : U.emptyRow(8, "売上を追加してみましょう");
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>日付</th><th>顧客</th><th>商品</th><th class="num">金額</th><th>入金</th><th>予定日</th><th>入金方法</th><th></th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  // 事業／個人／共通の表示
  function usageCell(v) {
    return v ? '<span class="badge gray">' + U.esc(v) + '</span>' : '<span class="muted">—</span>';
  }

  function tableExp() {
    var rows = S.list("expenses").slice().sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
    var body = rows.length ? rows.map(function (r) {
      return '<tr>' +
        '<td>' + U.fmtDate(r.date) + '</td>' +
        '<td>' + (r.payee ? U.esc(r.payee) : '<span class="muted">—</span>') + '</td>' +
        '<td>' + U.esc(r.content) + '</td>' +
        '<td><span class="badge gray">' + U.esc(r.category) + '</span></td>' +
        '<td>' + usageCell(r.usage) + '</td>' +
        '<td class="num">' + U.yen(r.amount) + '</td>' +
        '<td>' + methodCell(r.payMethod) + '</td>' +
        '<td class="row-actions">' + editDel("expenses", r.id) + '</td>' +
        '</tr>';
    }).join("") : U.emptyRow(8, "経費を追加してみましょう");
    return '<div class="table-wrap"><table><thead><tr>' +
      '<th>日付</th><th>支払先</th><th>内容</th><th>勘定科目</th><th>区分</th><th class="num">金額</th><th>支払方法</th><th></th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function clearBtn(col, id, label) {
    return S.list(col).length
      ? '<div style="margin-top:12px;text-align:right"><button class="btn btn-sm btn-danger" id="' + id + '">' + label + 'を全部削除</button></div>'
      : '';
  }

  function editDel(col, id) {
    return '<button class="btn btn-sm" data-edit="' + col + '" data-id="' + id + '">編集</button>' +
      '<button class="btn btn-sm btn-danger" data-del="' + col + '" data-id="' + id + '">削除</button>';
  }

  function bindRows(view) {
    view.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () {
        var col = b.getAttribute("data-edit"), id = b.getAttribute("data-id");
        var fields = col === "sales" ? saleFields() : expFields();
        U.recordModal({ title: "編集", fields: fields, values: S.find(col, id),
          onSave: function (v) { if (col === "sales") remember("recv", v.payMethod); else rememberExp(v); S.update(col, id, v); U.toast("更新しました"); render(view); } });
      };
    });
    view.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () {
        var col = b.getAttribute("data-del"), id = b.getAttribute("data-id");
        U.confirmDelete("この項目を削除しますか？", function () { S.remove(col, id); U.toast("削除しました"); render(view); });
      };
    });
  }

  // 支払方法・入金方法・引落口座の管理（追加・削除・並べ替え）
  var METHOD_COL = { pay: "payMethods", recv: "receiveMethods", acct: "debitAccounts" };
  var METHOD_SET = { pay: "setPayMethods", recv: "setReceiveMethods", acct: "setDebitAccounts" };
  var METHOD_EG = { pay: "PayPay・三井住友カード", recv: "Stripe・ゆうちょ", acct: "ゆうちょ・三井住友銀行" };
  function manageMethods(view) {
    function open() {
      function block(title, kind) {
        var arr = S.list(METHOD_COL[kind]);
        var rows = arr.length ? arr.map(function (c, i) {
          return '<div class="check-row" style="justify-content:space-between;border-bottom:1px solid var(--line-2);padding:9px 2px">' +
            '<span>' + U.esc(c) + '</span><span style="display:flex;gap:6px">' +
            '<button class="btn btn-sm" data-up="' + kind + ':' + i + '"' + (i === 0 ? ' disabled' : '') + '>▲</button>' +
            '<button class="btn btn-sm" data-down="' + kind + ':' + i + '"' + (i === arr.length - 1 ? ' disabled' : '') + '>▼</button>' +
            '<button class="btn btn-sm btn-danger" data-rm="' + kind + ':' + U.esc(c) + '">削除</button></span></div>';
        }).join("") : '<p class="hint">まだありません。下から追加してください。</p>';
        return '<div style="font-weight:600;margin:14px 0 4px">' + title + '</div>' + rows +
          '<div class="field" style="margin-top:8px"><input type="text" id="new_' + kind + '" placeholder="新しく追加（例：' + METHOD_EG[kind] + '）"></div>' +
          '<div style="text-align:right"><button class="btn btn-sm btn-primary" data-add="' + kind + '">追加</button></div>';
      }
      var body = '<p class="hint">▲▼で並び替え、削除もできます。削除しても、過去の記録のラベルは残ります。</p>' +
        block("支払方法（経費）", "pay") +
        block("入金方法（売上）", "recv") +
        block("引落口座（経費）", "acct") +
        '<div class="modal-foot"><button class="btn" data-close2>閉じる</button></div>';
      U.openModal("支払方法・入金方法・引落口座の管理", body, function (m) {
        function getArr(k) { return S.list(METHOD_COL[k]); }
        function setArr(k, arr) { S[METHOD_SET[k]](arr); }
        m.querySelector("[data-close2]").onclick = function () { U.closeModal(); render(view); };
        m.querySelectorAll("[data-add]").forEach(function (b) {
          b.onclick = function () {
            var k = b.getAttribute("data-add");
            var val = (m.querySelector("#new_" + k).value || "").trim();
            if (!val) return;
            var arr = getArr(k);
            if (arr.indexOf(val) < 0) arr.push(val);
            setArr(k, arr); U.toast("追加しました"); open();
          };
        });
        m.querySelectorAll("[data-rm]").forEach(function (b) {
          b.onclick = function () {
            var p = b.getAttribute("data-rm").split(":"); var k = p[0], c = p.slice(1).join(":");
            setArr(k, getArr(k).filter(function (x) { return x !== c; }));
            U.toast("削除しました"); open();
          };
        });
        m.querySelectorAll("[data-up]").forEach(function (b) {
          b.onclick = function () { var p = b.getAttribute("data-up").split(":"); var k = p[0], i = +p[1]; var arr = getArr(k); var t = arr[i - 1]; arr[i - 1] = arr[i]; arr[i] = t; setArr(k, arr); open(); };
        });
        m.querySelectorAll("[data-down]").forEach(function (b) {
          b.onclick = function () { var p = b.getAttribute("data-down").split(":"); var k = p[0], i = +p[1]; var arr = getArr(k); var t = arr[i + 1]; arr[i + 1] = arr[i]; arr[i] = t; setArr(k, arr); open(); };
        });
      });
    }
    open();
  }

  BG.modules = BG.modules || {};
  BG.modules.money = { title: "MONEY｜お金管理", render: render };
  BG.calc = BG.calc || {};
  BG.calc.money = calc;
})();
