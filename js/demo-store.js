/*
 * demo-store.js
 *
 * Browser-only stand-in for the shared catalogue database and photo storage.
 * It lets the owner try the admin page (add products, upload photos, set stock)
 * on a plain static host. Changes are saved in this browser only (localStorage).
 *
 * It only activates when the page is NOT running inside Claude's artifact viewer
 * (that viewer provides window.claude with a real shared database).
 * For production, replace this file with a Supabase adapter that exposes the
 * same small surface: use("user"), use("db"), use("assets") and url(id).
 */
(function () {
  if (window.claude) return; // real runtime present, nothing to do

  var KEY_DB = "rl-demo-db";      // { "products/<id>": {...}, "meta/catalogue": {...} }
  var KEY_BLOBS = "rl-demo-blobs"; // { "<photoId>": "data:image/jpeg;base64,..." }
  var listeners = [];              // { kind, path, fn }

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; }
  }
  var docs = load(KEY_DB);
  var blobs = load(KEY_BLOBS);

  function persist(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }
  function uid() { return "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* --- snapshots, shaped like the real database's --- */
  function docSnap(path) {
    var data = docs[path];
    return { id: path.split("/").pop(), exists: !!data, data: function () { return data ? clone(data) : undefined; } };
  }
  function collectionSnap(col) {
    var out = [];
    Object.keys(docs).forEach(function (p) {
      if (p.indexOf(col + "/") === 0 && p.split("/").length === 2) out.push(docSnap(p));
    });
    return { docs: out, size: out.length, empty: !out.length };
  }
  function notify() {
    listeners.forEach(function (l) {
      l.fn(l.kind === "doc" ? docSnap(l.path) : collectionSnap(l.path));
    });
  }

  function docRef(path) {
    return {
      id: path.split("/").pop(),
      path: path,
      set: function (data) { docs[path] = clone(data); persist(KEY_DB, docs); notify(); return Promise.resolve(); },
      update: function (patch) {
        if (!docs[path]) return Promise.reject({ code: "invalid_argument", message: "missing" });
        docs[path] = Object.assign({}, docs[path], clone(patch)); persist(KEY_DB, docs); notify(); return Promise.resolve();
      },
      delete: function () { delete docs[path]; persist(KEY_DB, docs); notify(); return Promise.resolve(); },
      onSnapshot: function (next) {
        var l = { kind: "doc", path: path, fn: next }; listeners.push(l);
        setTimeout(function () { next(docSnap(path)); }, 0);
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      }
    };
  }
  function collectionRef(col) {
    return {
      doc: function (id) { return docRef(col + "/" + (id || uid())); },
      onSnapshot: function (next) {
        var l = { kind: "col", path: col, fn: next }; listeners.push(l);
        setTimeout(function () { next(collectionSnap(col)); }, 0);
        return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
      }
    };
  }

  var db = { doc: docRef, collection: collectionRef };

  /* --- photo storage: images become small data URLs kept in localStorage --- */
  var assets = {
    upload: function (blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onerror = function () { reject({ code: "invalid_request", message: "read failed" }); };
        reader.onload = function () {
          var id = uid();
          blobs[id] = reader.result;
          if (!persist(KEY_BLOBS, blobs)) {
            delete blobs[id];
            reject({ code: "quota_or_state", message: "browser storage full" });
            return;
          }
          resolve({ id: id, url: reader.result, sizeBytes: blob.size, contentType: blob.type });
        };
        reader.readAsDataURL(blob);
      });
    },
    delete: function (id) {
      var had = !!blobs[id]; delete blobs[id]; persist(KEY_BLOBS, blobs);
      return Promise.resolve({ deleted: had });
    }
  };

  window.RLDemo = {
    active: true,
    /* Same entry point the real runtime exposes: await use("db") etc. */
    use: function (name) {
      if (name === "db") return Promise.resolve(db);
      if (name === "assets") return Promise.resolve(assets);
      if (name === "user") return Promise.resolve({ canEdit: function () { return true; }, isOwner: function () { return true; } });
      return Promise.resolve(null);
    },
    /* Photo id to image source */
    url: function (id) { return blobs[id] || ""; },
    /* Wipe everything this demo saved in the browser */
    reset: function () {
      docs = {}; blobs = {};
      try { localStorage.removeItem(KEY_DB); localStorage.removeItem(KEY_BLOBS); } catch (e) {}
      notify();
    }
  };
})();
