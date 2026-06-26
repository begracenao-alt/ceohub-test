/* ============================================================
   Be Grace CEO Hub — 画面部品 (ui.js)
   各モジュールが使う共通ヘルパー
   ============================================================ */
(function () {
  "use strict";

  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function yen(n) {
    n = Number(n) || 0;
    return "¥" + n.toLocaleString("ja-JP");
  }

  function num(v) {
    var n = Number(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(n) ? 0 : n;
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  function ymOf(dateStr) {
    return (dateStr || "").slice(0, 7); // YYYY-MM
  }

  function curYM() { return todayStr().slice(0, 7); }
  function curYear() { return todayStr().slice(0, 4); }

  function inThisMonth(dateStr) { return ymOf(dateStr) === curYM(); }
  function inThisYear(dateStr) { return (dateStr || "").slice(0, 4) === curYear(); }

  function fmtDate(d) {
    if (!d) return "—";
    var p = d.split("-");
    if (p.length < 3) return d;
    return p[1] + "/" + p[2];
  }

  // トースト
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    clearTimeout(toastTimer);
    var S = window.BG && window.BG.store;
    // 「削除しました」のときは『元に戻す』ボタンを出す（押し間違い対策）
    if (/削除/.test(msg) && S && S.hasUndo && S.hasUndo()) {
      t.innerHTML = esc(msg) +
        '<button id="undoBtn" style="margin-left:14px;border:none;background:rgba(255,255,255,.22);' +
        'color:#fff;font-size:13px;padding:5px 14px;border-radius:999px;cursor:pointer;font-family:inherit">' +
        '元に戻す</button>';
      t.hidden = false;
      var btn = document.getElementById("undoBtn");
      btn.onclick = function () {
        clearTimeout(toastTimer);
        t.hidden = true;
        S.restoreLast();
        var act = document.querySelector(".nav-item.active");
        if (window.BG.go) window.BG.go(act ? act.getAttribute("data-key") : "dashboard");
        toast("元に戻しました");
      };
      // 押す時間を長めに（6秒）
      toastTimer = setTimeout(function () { t.hidden = true; }, 6000);
      return;
    }
    t.textContent = msg;
    t.hidden = false;
    toastTimer = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // モーダル
  function openModal(title, bodyHTML, onMount) {
    var bd = document.getElementById("modalBackdrop");
    var m = document.getElementById("modal");
    m.innerHTML =
      '<div class="modal-head"><h3>' + esc(title) + '</h3>' +
      '<button class="modal-close" data-close>&times;</button></div>' +
      '<div class="modal-body">' + bodyHTML + '</div>';
    bd.hidden = false;
    m.querySelector("[data-close]").onclick = closeModal;
    bd.onclick = function (e) { if (e.target === bd) closeModal(); };
    if (onMount) onMount(m);
  }
  function closeModal() {
    document.getElementById("modalBackdrop").hidden = true;
    document.getElementById("modal").innerHTML = "";
  }

  function confirmDelete(msg, onYes) {
    openModal("確認", '<p>' + esc(msg) + '</p>' +
      '<div class="modal-foot"><button class="btn" data-no>キャンセル</button>' +
      '<button class="btn btn-primary btn-danger" data-yes>削除する</button></div>',
      function (m) {
        m.querySelector("[data-no]").onclick = closeModal;
        m.querySelector("[data-yes]").onclick = function () { closeModal(); onYes(); };
      });
  }

  /* フォーム生成
     fields: [{name,label,type,options,full,value,placeholder}]
     type: text|number|date|select|textarea|checkbox
  */
  function formHTML(fields, values) {
    values = values || {};
    var html = '<form class="form-grid" id="bgForm">';
    fields.forEach(function (f) {
      var v = values[f.name] !== undefined ? values[f.name] : (f.value || "");
      var cls = "field" + (f.full ? " full" : "");
      if (f.type === "checkbox") {
        html += '<div class="' + cls + '"><div class="check-row">' +
          '<input type="checkbox" name="' + f.name + '" id="f_' + f.name + '"' + (v ? " checked" : "") + '>' +
          '<label for="f_' + f.name + '">' + esc(f.label) + '</label></div></div>';
        return;
      }
      html += '<div class="' + cls + '"><label for="f_' + f.name + '">' + esc(f.label) + '</label>';
      if (f.type === "checks") {
        var arr = Array.isArray(v) ? v : (v ? [v] : []);
        html += '<div class="checks-group">';
        (f.options || []).forEach(function (o, idx) {
          html += '<label class="check-row" style="display:inline-flex;gap:6px;margin:0 14px 8px 0">' +
            '<input type="checkbox" data-checks="' + f.name + '" value="' + esc(o) + '" id="f_' + f.name + '_' + idx + '"' + (arr.indexOf(o) >= 0 ? " checked" : "") + '>' +
            '<span>' + esc(o) + '</span></label>';
        });
        html += '</div>';
      } else if (f.type === "select") {
        html += '<select name="' + f.name + '" id="f_' + f.name + '">';
        (f.options || []).forEach(function (o) {
          html += '<option value="' + esc(o) + '"' + (String(v) === String(o) ? " selected" : "") + '>' + esc(o) + '</option>';
        });
        html += '</select>';
      } else if (f.type === "selectadd") {
        // 選べるドロップダウン＋「＋ 自分で入力する」（一覧が隠れない）
        var opts = f.options || [];
        var inList = v !== "" && opts.indexOf(v) >= 0;
        var isOther = v !== "" && !inList;
        html += '<select name="' + f.name + '" id="f_' + f.name + '" data-selectadd="' + f.name + '">';
        html += '<option value="">' + esc(f.placeholder || "選んでください") + '</option>';
        opts.forEach(function (o) {
          html += '<option value="' + esc(o) + '"' + ((!isOther && String(v) === String(o)) ? " selected" : "") + '>' + esc(o) + '</option>';
        });
        html += '<option value="__other__"' + (isOther ? " selected" : "") + '>＋ 自分で入力する</option>';
        html += '</select>';
        html += '<input type="text" name="' + f.name + '__other" id="f_' + f.name + '__other" placeholder="ここに打ち込んで追加" value="' + esc(isOther ? v : "") + '" style="margin-top:8px;' + (isOther ? "" : "display:none") + '">';
      } else if (f.type === "datalist") {
        var lid = "dl_" + f.name;
        html += '<input type="text" name="' + f.name + '" id="f_' + f.name + '" list="' + lid + '" autocomplete="off" value="' + esc(v) + '" placeholder="' + esc(f.placeholder || "") + '">';
        html += '<datalist id="' + lid + '">';
        (f.options || []).forEach(function (o) { html += '<option value="' + esc(o) + '"></option>'; });
        html += '</datalist>';
      } else if (f.type === "money") {
        var mv = (v !== "" && v != null) ? Number(String(v).replace(/[^\d]/g, "") || 0).toLocaleString("ja-JP") : "";
        html += '<input type="text" inputmode="numeric" class="money-input" name="' + f.name + '" id="f_' + f.name + '" value="' + mv + '" placeholder="' + esc(f.placeholder || "例：1,000,000") + '">';
      } else if (f.type === "textarea") {
        html += '<textarea name="' + f.name + '" id="f_' + f.name + '" placeholder="' + esc(f.placeholder || "") + '">' + esc(v) + '</textarea>';
      } else {
        html += '<input type="' + (f.type || "text") + '" name="' + f.name + '" id="f_' + f.name +
          '" value="' + esc(v) + '" placeholder="' + esc(f.placeholder || "") + '">';
      }
      html += '</div>';
    });
    html += '</form>';
    return html;
  }

  function readForm(formEl, fields) {
    var out = {};
    fields.forEach(function (f) {
      if (f.type === "checks") {
        var arr = [];
        formEl.querySelectorAll('[data-checks="' + f.name + '"]').forEach(function (n) { if (n.checked) arr.push(n.value); });
        out[f.name] = arr;
        return;
      }
      if (f.type === "selectadd") {
        var selEl = formEl.querySelector('[name="' + f.name + '"]');
        var sval = selEl ? selEl.value : "";
        if (sval === "__other__") {
          var oEl = formEl.querySelector('[name="' + f.name + '__other"]');
          sval = oEl ? oEl.value.trim() : "";
        }
        out[f.name] = sval;
        return;
      }
      var el = formEl.querySelector('[name="' + f.name + '"]');
      if (!el) return;
      if (f.type === "checkbox") out[f.name] = el.checked;
      else if (f.type === "number" || f.type === "money") out[f.name] = num(el.value);
      else out[f.name] = el.value.trim();
    });
    return out;
  }

  // 編集モーダル（追加/更新共通）
  function recordModal(opts) {
    // opts: {title, fields, values, onSave}
    var body = formHTML(opts.fields, opts.values) +
      '<div class="modal-foot"><button class="btn" data-cancel>キャンセル</button>' +
      '<button class="btn btn-primary" data-save>保存</button></div>';
    openModal(opts.title, body, function (m) {
      m.querySelectorAll(".money-input").forEach(function (inp) {
        // 打ちながら欄の中にコンマを表示。カーソル位置はズレないように保つ。
        // 日本語入力（IME）の変換中は処理を止めて、確定したあとに整える。
        var composing = false;
        function reformat() {
          var start = inp.selectionStart;
          var before = inp.value.slice(0, start).replace(/[^\d]/g, "").length;
          var digits = inp.value.replace(/[^\d]/g, "");
          inp.value = digits ? Number(digits).toLocaleString("ja-JP") : "";
          var pos = 0, cnt = 0;
          while (pos < inp.value.length && cnt < before) {
            var ch = inp.value.charCodeAt(pos);
            if (ch >= 48 && ch <= 57) cnt++;
            pos++;
          }
          try { inp.setSelectionRange(pos, pos); } catch (e) {}
        }
        inp.addEventListener("compositionstart", function () { composing = true; });
        inp.addEventListener("compositionend", function () { composing = false; reformat(); });
        inp.addEventListener("input", function () { if (composing) return; reformat(); });
      });
      m.querySelectorAll("[data-selectadd]").forEach(function (sel) {
        var other = m.querySelector("#f_" + sel.getAttribute("data-selectadd") + "__other");
        sel.addEventListener("change", function () {
          if (!other) return;
          var on = sel.value === "__other__";
          other.style.display = on ? "" : "none";
          if (on) other.focus();
        });
      });
      m.querySelector("[data-cancel]").onclick = closeModal;
      m.querySelector("[data-save]").onclick = function () {
        var vals = readForm(m.querySelector("#bgForm"), opts.fields);
        opts.onSave(vals);
        closeModal();
      };
    });
  }

  function stat(label, value, sub, cls) {
    return '<div class="stat ' + (cls || "") + '">' +
      '<div class="stat-label">' + esc(label) + '</div>' +
      '<div class="stat-value">' + value + '</div>' +
      (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  }

  function sectionHead(title, btnLabel, btnId) {
    return '<div class="section-head"><h2>' + esc(title) + '</h2>' +
      (btnLabel ? '<button class="btn btn-primary" id="' + btnId + '">+ ' + esc(btnLabel) + '</button>' : '') +
      '</div>';
  }

  function emptyRow(cols, msg) {
    return '<tr><td colspan="' + cols + '" class="empty">' + esc(msg || "まだデータがありません") + '</td></tr>';
  }

  window.BG = window.BG || {};
  window.BG.ui = {
    esc: esc, yen: yen, num: num, todayStr: todayStr, ymOf: ymOf, curYM: curYM, curYear: curYear,
    inThisMonth: inThisMonth, inThisYear: inThisYear, fmtDate: fmtDate,
    toast: toast, openModal: openModal, closeModal: closeModal, confirmDelete: confirmDelete,
    formHTML: formHTML, readForm: readForm, recordModal: recordModal,
    stat: stat, sectionHead: sectionHead, emptyRow: emptyRow
  };
})();
