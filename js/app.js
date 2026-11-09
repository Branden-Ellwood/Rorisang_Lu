/*
 * app.js
 *
 * Storefront behaviour for the Rorisang Lu boutique:
 *  - catalogue grid with category filter and sorting
 *  - product sheet with size picker and photo gallery
 *  - bag drawer, checkout form and payment options (prototype, no real payments)
 *  - owner admin page: add/edit/hide/delete products, stock per size, photo upload
 *
 * Data comes from a shared database when one is available (Claude's runtime, or
 * js/demo-store.js in the browser). With neither, the sample pieces below are shown.
 */
(function(){
  var DEFAULTS=[
    {id:1,name:"Angelo Hat",cat:"Hats",price:650,fig:"hat",hue:"#7A1F3D",tag:"New",sizes:["S","M","L"],stock:{S:5,M:3,L:0},blurb:"A paperboy silhouette refined for a modern wardrobe. Structured, soft, and made to finish a look without taking it over."},
    {id:2,name:"Bang Sang Statement Bag",cat:"Bags",price:1450,fig:"bag",hue:"#B8862B",tag:"New",sizes:["One size"],stock:{"One size":6},blurb:"From The Bang Sang collection by Is It Sang? Designed for the woman who doesn't believe in entering a room quietly."},
    {id:3,name:"Masaai Sugar Dress",cat:"Womenswear",price:3800,fig:"dress",hue:"#D4537E",tag:"",sizes:["XS","S","M","L","XL"],stock:{XS:2,S:4,M:5,L:3,XL:0},blurb:"Luminous sugar-pink satin with sculptural cut-outs and a sweeping train that turns every movement into a moment."},
    {id:4,name:"Platinum Muse Gown",cat:"Womenswear",price:5200,fig:"gown",hue:"#5C7A62",tag:"Runway",sizes:["XS","S","M","L"],stock:{XS:1,S:2,M:2,L:1},blurb:"Flowing sage green with a long, fluid line. Shown on the runway and now available made to order."},
    {id:5,name:"Noir Sculpted Handbag",cat:"Handbags",price:1950,fig:"handbag",hue:"#2F2A2D",tag:"",sizes:["One size"],stock:{"One size":4},blurb:"A structured top-handle bag with a clean, architectural shape. Fits a tablet, phone and the essentials."},
    {id:6,name:"Silver Blue Couture Dress",cat:"Womenswear",price:4600,fig:"dress",hue:"#2E5FA8",tag:"Runway",sizes:["XS","S","M","L"],stock:{XS:0,S:2,M:2,L:1},blurb:"Deep blue couture with silver-accented detailing, cut for the runway and worn well off it."},
    {id:7,name:"Angelo Hat in Ink",cat:"Hats",price:650,fig:"hat",hue:"#1E1B1D",tag:"",sizes:["S","M","L"],stock:{S:3,M:4,L:2},blurb:"The Angelo in a deep ink tone. Same paperboy shape, quieter attitude."},
    {id:8,name:"Bang Sang Mini",cat:"Bags",price:1150,fig:"bag",hue:"#8C2E4F",tag:"New",sizes:["One size"],stock:{"One size":2},blurb:"The Bang Sang scaled down for evenings. Small enough to carry, loud enough to be noticed."}
  ];
  DEFAULTS.forEach(function(p,i){p.id="p"+p.id;p.order=i+1;p.photos=[];p.hidden=false});
  var PRODUCTS=[],ready=false;
  var CAPS={db:null,assets:null,canEdit:false,live:false};
  var CATS=["All","Womenswear","Bags","Handbags","Hats"];
  var state={cat:"All",sort:"featured",cart:[],wish:[]};
  var FREE_OVER=2500, DELIVERY={gab:{label:"Gaborone courier",fee:60},col:{label:"Collect in Gaborone",fee:0},nat:{label:"Elsewhere in Botswana",fee:120},intl:{label:"International",fee:450}};
  try{var s=JSON.parse(localStorage.getItem("rl-state")||"null");if(s){state.cart=s.cart||[];state.wish=s.wish||[]}}catch(e){}
  function save(){try{localStorage.setItem("rl-state",JSON.stringify({cart:state.cart,wish:state.wish}))}catch(e){}}
  var $=function(s,r){return(r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  function money(n){return "P"+Math.round(n).toLocaleString("en-US")}
  function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  /* Photo id to image source: Claude's blob store when published there, browser storage in the demo */
  function photoUrl(id){return window.RLDemo?window.RLDemo.url(id):'/_blob/'+id}
  function prod(id){return PRODUCTS.filter(function(p){return String(p.id)===String(id)})[0]}
  var VB={hat:"0 0 120 100",bag:"0 0 120 110",handbag:"0 0 120 110",dress:"0 0 120 150",gown:"0 0 120 170"};
  function fig(p){
    if(p.photos&&p.photos[0])return '<img class="ph" src="'+photoUrl(p.photos[0])+'" alt="'+esc(p.name)+'" loading="lazy">';
    var f=VB[p.fig]?p.fig:"dress";return '<svg class="fig" viewBox="'+VB[f]+'" aria-hidden="true"><use href="#s-'+f+'"/></svg>'}
  function picHtml(p){
    var h=fig(p);
    if(p.photos&&p.photos.length>1){
      h=h.replace('<img class="ph"','<img id="mainPh" class="ph"')+'<div class="gal">'+p.photos.map(function(id){return '<button type="button" data-ph="'+id+'" aria-label="Show photo"><img src="'+photoUrl(id)+'" alt=""></button>'}).join("")+'</div>'}
    return h}
  function toast(msg){var t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},2200)}

  function renderChips(){
    $("#chips").innerHTML=CATS.map(function(c){return '<button class="chip" data-chip="'+c+'" aria-pressed="'+(state.cat===c)+'">'+c+'</button>'}).join("");
  }
  function renderGrid(){
    if(!ready){$("#grid").innerHTML='<p class="empty" style="grid-column:1/-1">Loading the collection...</p>';return}
    var list=PRODUCTS.filter(function(p){return !p.hidden&&(state.cat==="All"||p.cat===state.cat)});
    if(state.sort==="low")list=list.slice().sort(function(a,b){return a.price-b.price});
    if(state.sort==="high")list=list.slice().sort(function(a,b){return b.price-a.price});
    $("#showing").textContent="Showing "+list.length+" of "+PRODUCTS.length;
    var html=list.map(function(p,i){
      var w=state.wish.indexOf(p.id)>-1;
      var card='<article class="card"><div class="tile" style="--hue:'+p.hue+'">'+fig(p)+(p.tag?'<span class="tag">'+p.tag+'</span>':'')+(p.photos&&p.photos[0]?'':'<span class="sample">Sample image</span>')+
        '<button class="heart" data-wish="'+p.id+'" aria-pressed="'+w+'" aria-label="Save '+esc(p.name)+'"><svg viewBox="0 0 24 24"><use href="#i-heart"/></svg></button>'+
        '<button class="quick" data-open="'+p.id+'" aria-label="Choose size for '+esc(p.name)+'"><svg viewBox="0 0 24 24"><use href="#i-bag"/></svg></button></div>'+
        '<button class="name" data-open="'+p.id+'"><h3>'+esc(p.name)+'</h3></button><div class="row"><span class="price">'+money(p.price)+'</span><span class="sub">'+p.cat+'</span></div></article>';
      if(i===3&&state.cat==="All"&&list.length>4)card+='<aside class="promo" style="grid-column:span 2"><span class="caps">The Bang Sang</span><span class="big">Make an<br>entrance</span><span class="caps">Statement accessories by Is It Sang?</span><button class="btn light" data-cat="Bags" style="margin-top:8px">Shop bags</button></aside>';
      return card}).join("");
    $("#grid").innerHTML=html||'<p class="empty">Nothing here yet.</p>';
  }
  function badges(){
    var n=state.cart.reduce(function(a,l){return a+l.qty},0), b=$("#bagCount");b.textContent=n;b.hidden=!n;
    var w=$("#wishCount");w.textContent=state.wish.length;w.hidden=!state.wish.length;
  }
  function setCat(c){state.cat=c;renderChips();renderGrid();showStore();$("#shop").scrollIntoView()}

  /* product sheet */
  var sel={size:null,qty:1};
  function openProduct(id){
    var p=prod(id);sel={size:p.sizes.length===1?p.sizes[0]:null,qty:1};
    function sizesHtml(){return p.sizes.map(function(s){var out=p.stock[s]===0;return '<button class="size" data-size="'+s+'" '+(out?'disabled':'')+' aria-pressed="'+(sel.size===s)+'">'+s+'</button>'}).join("")}
    var el=document.createElement("div");
    el.innerHTML='<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true" aria-label="'+esc(p.name)+'"><div class="panel" style="--hue:'+p.hue+'">'+
      '<div class="pic">'+picHtml(p)+'<button class="close" data-close aria-label="Close">&times;</button></div>'+
      '<div class="info"><div><span class="caps muted">'+p.cat+'</span><h2 class="display" style="margin-top:6px">'+esc(p.name)+'</h2></div>'+
      '<div class="price" style="font-size:18px">'+money(p.price)+(CAPS.live?'':' <span class="muted" style="font-size:12px">sample price</span>')+'</div>'+
      '<div><div class="row" style="margin-bottom:8px"><span class="caps">Size</span><span class="low" id="stockNote"></span></div><div class="sizes" id="sizes">'+sizesHtml()+'</div></div>'+
      '<div class="err" id="sizeErr" role="alert"></div>'+
      '<button class="btn block" id="addBtn">Add to bag</button>'+
      '<div class="acc"><b>Details</b>'+esc(p.blurb)+'</div>'+
      '<div class="acc"><b>Delivery and returns</b>Free delivery in Gaborone over P2,500. Pieces are finished by hand; made-to-measure orders confirm timing before payment.</div>'+
      '</div></div></div>';
    el.id="productLayer";$("#overlay").appendChild(el);
    $("#addBtn").focus();
    el.addEventListener("click",function(e){var g=e.target.closest("[data-ph]"),m=$("#mainPh");if(g&&m)m.src=photoUrl(g.dataset.ph)});
    $("#sizes").addEventListener("click",function(e){var b=e.target.closest(".size");if(!b||b.disabled)return;sel.size=b.dataset.size;$$(".size").forEach(function(x){x.setAttribute("aria-pressed",x===b)});
      var left=p.stock[sel.size];$("#stockNote").textContent=left<=3?"Only "+left+" left in stock":"";$("#sizeErr").textContent=""});
    $("#addBtn").addEventListener("click",function(){
      if(!sel.size){$("#sizeErr").textContent="Choose a size to add this to your bag.";return}
      addToCart(p.id,sel.size);closeLayers();openBag()});
  }
  function closeLayers(){$("#overlay").innerHTML=""}
  function addToCart(id,size){
    var hit=state.cart.filter(function(l){return l.id===id&&l.size===size})[0];
    if(hit)hit.qty+=1;else state.cart.push({id:id,size:size,qty:1});
    save();badges()}

  /* bag drawer */
  function subtotal(){return state.cart.reduce(function(a,l){return a+prod(l.id).price*l.qty},0)}
  function openBag(){
    closeLayers();var el=document.createElement("div");el.id="bagLayer";
    el.innerHTML='<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-label="Your bag"><div class="head"><span class="caps">Your bag</span><button class="linkbtn" data-close style="font-size:13px">Close</button></div><div class="body" id="bagBody"></div><div class="foot" id="bagFoot"></div></aside>';
    $("#overlay").appendChild(el);renderBag()}
  function renderBag(){
    var body=$("#bagBody"),foot=$("#bagFoot");if(!body)return;
    if(!state.cart.length){body.innerHTML='<p class="empty">Your bag is empty.</p>';foot.innerHTML='<button class="btn block" data-close>Keep shopping</button>';return}
    body.innerHTML=state.cart.map(function(l,i){var p=prod(l.id);return '<div class="line-item" style="--hue:'+p.hue+'"><div class="thumb">'+fig(p)+'</div><div><div style="font-family:var(--display);text-transform:uppercase;font-size:14px;letter-spacing:.03em">'+esc(p.name)+'</div><div class="muted" style="font-size:12px">Size: '+esc(l.size)+'</div><div class="qty"><button data-dec="'+i+'" aria-label="Decrease">&minus;</button><span>'+l.qty+'</span><button data-inc="'+i+'" aria-label="Increase">+</button></div></div><div style="text-align:right"><div>'+money(p.price*l.qty)+'</div><button class="linkbtn" data-rm="'+i+'">Remove</button></div></div>'}).join("");
    var st=subtotal(),left=FREE_OVER-st;
    foot.innerHTML=(left>0?'<div class="muted" style="font-size:12px">Add '+money(left)+' more for free delivery in Gaborone.</div>':'<div style="font-size:12px;color:var(--good)">Free delivery in Gaborone unlocked.</div>')+'<div class="row"><span>Subtotal</span><b>'+money(st)+'</b></div><button class="btn block" id="toCheckout">Checkout</button>';
  }

  /* checkout */
  var order={ship:"gab",pay:"card"};
  function totals(){var st=subtotal(),d=DELIVERY[order.ship],fee=(order.ship==="gab"&&st>=FREE_OVER)?0:d.fee;return{st:st,fee:fee,total:st+fee}}
  function showStore(){$("#storefront").hidden=false;$("#checkoutView").hidden=true;$("#adminView").hidden=true;$("#bar").hidden=false;if(location.hash==="#admin")location.hash="top"}
  function showCheckout(){
    closeLayers();if(!state.cart.length){toast("Your bag is empty");return}
    $("#storefront").hidden=true;$("#checkoutView").hidden=false;window.scrollTo(0,0);renderCheckout()}
  function renderCheckout(){
    var t=totals();
    $("#checkoutView").innerHTML='<div class="gutter"><form class="checkout" id="coForm" novalidate><div>'+
      '<h1 class="display">Checkout</h1><p class="muted" style="margin:0 0 18px"><a href="#" id="backShop">Back to the collection</a></p>'+
      '<div class="proto"><b>Prototype.</b> No real payments are taken here. Payment steps show how each method will work once the accounts are connected.</div>'+
      '<fieldset><legend>Contact</legend><div class="fields"><label class="f full">Full name<input type="text" id="fName" autocomplete="name"></label><label class="f">Email<input type="email" id="fEmail" autocomplete="email"></label><label class="f">Phone or WhatsApp<input type="tel" id="fPhone" autocomplete="tel"></label></div></fieldset>'+
      '<fieldset><legend>Delivery</legend>'+Object.keys(DELIVERY).map(function(k){var d=DELIVERY[k],fee=(k==="gab"&&t.st>=FREE_OVER)?0:d.fee;return '<label class="opt"><input type="radio" name="ship" value="'+k+'" '+(order.ship===k?'checked':'')+'><span><b>'+d.label+'</b></span><span>'+(fee?money(fee):'Free')+'</span></label>'}).join("")+
      '<div class="fields" style="margin-top:12px" id="addr"><label class="f full">Address or pickup note<input type="text" id="fAddr" autocomplete="street-address"></label></div></fieldset>'+
      '<fieldset><legend>Payment</legend>'+
      '<label class="opt"><input type="radio" name="pay" value="card" '+(order.pay==="card"?'checked':'')+'><span><b>Visa, Mastercard or PayPal</b><small>Secure hosted checkout. Works for international buyers.</small></span><span></span></label>'+
      '<label class="opt"><input type="radio" name="pay" value="eft" '+(order.pay==="eft"?'checked':'')+'><span><b>Bank transfer (EFT)</b><small>Pay from your banking app and send proof.</small></span><span></span></label>'+
      '<label class="opt"><input type="radio" name="pay" value="orange" '+(order.pay==="orange"?'checked':'')+'><span><b>Orange Money</b><small>Send to the brand wallet and share the reference.</small></span><span></span></label>'+
      '<label class="opt"><input type="radio" name="pay" value="plan" '+(order.pay==="plan"?'checked':'')+'><span><b>Flexible payment plan</b><small>3 equal payments: today, 30 days, 60 days.</small></span><span>'+money(t.total/3)+' x 3</span></label>'+
      '</fieldset><div class="err" id="coErr" role="alert"></div><button class="btn block" type="submit" id="placeBtn">Place order, '+money(t.total)+'</button></div>'+
      '<aside class="summary"><span class="caps">Order summary</span>'+state.cart.map(function(l){var p=prod(l.id);return '<div class="row" style="font-size:14px"><span>'+esc(p.name)+' <span class="muted">('+esc(l.size)+') x '+l.qty+'</span></span><span>'+money(p.price*l.qty)+'</span></div>'}).join("")+
      '<hr style="border:0;border-top:1px solid var(--line);width:100%"><div class="row"><span class="muted">Subtotal</span><span>'+money(t.st)+'</span></div><div class="row"><span class="muted">Delivery</span><span>'+(t.fee?money(t.fee):'Free')+'</span></div><div class="row" style="font-size:18px"><b>Total</b><b>'+money(t.total)+'</b></div></aside></form></div>';
  }
  function placeOrder(){
    var f={n:$("#fName"),e:$("#fEmail"),p:$("#fPhone"),a:$("#fAddr")},bad=false;
    [f.n,f.e,f.p].forEach(function(i){i.classList.remove("bad")});
    if(!f.n.value.trim()){f.n.classList.add("bad");bad=true}
    if(!/^\S+@\S+\.\S+$/.test(f.e.value.trim())){f.e.classList.add("bad");bad=true}
    if(f.p.value.replace(/\D/g,"").length<7){f.p.classList.add("bad");bad=true}
    if(bad){$("#coErr").textContent="Check the highlighted fields: name, a valid email and a phone number are required.";return}
    var t=totals(),num="RL-"+String(Date.now()).slice(-6),name=f.n.value.trim().split(" ")[0];
    var txt={
      card:'<b>Next step (sandbox)</b>In the live site you would be sent to a secure PayPal or card page to pay '+money(t.total)+'. Your order is held until payment clears.',
      eft:'<b>Pay by bank transfer</b>Amount: '+money(t.total)+'<br>Bank: add bank name<br>Account: add account number<br>Reference: '+num+'<br>Send proof of payment by WhatsApp to confirm.',
      orange:'<b>Pay by Orange Money</b>Amount: '+money(t.total)+'<br>Send to: add wallet number<br>Reference: '+num+'<br>Share the confirmation message on WhatsApp.',
      plan:'<b>Your payment plan</b>Today: '+money(t.total/3)+'<br>In 30 days: '+money(t.total/3)+'<br>In 60 days: '+money(t.total/3)+'<br>Reference: '+num+'. Your order ships after the final payment.'}[order.pay];
    state.cart=[];save();badges();
    $("#checkoutView").innerHTML='<div class="gutter"><div class="done"><span class="caps muted">Order '+num+'</span><h1 class="display">Thank you, '+esc(name)+'.</h1><p class="muted" style="margin:0">We will confirm by email and WhatsApp. This was a prototype order, so nothing was charged.</p><div class="instr">'+txt+'</div><div><a class="btn" href="#" id="backShop">Back to the collection</a></div></div></div>';
    window.scrollTo(0,0)}

  /* events */
  document.addEventListener("click",function(e){
    var t=e.target;
    var c=t.closest("[data-cat]");if(c){e.preventDefault();$("#mobileLinks").classList.remove("open");setCat(c.dataset.cat);return}
    var chip=t.closest("[data-chip]");if(chip){setCat(chip.dataset.chip);return}
    var w=t.closest("[data-wish]");if(w){var id=w.dataset.wish,i=state.wish.indexOf(id);if(i>-1)state.wish.splice(i,1);else{state.wish.push(id);toast("Saved to wishlist")}save();badges();renderGrid();return}
    var o=t.closest("[data-open]");if(o){openProduct(o.dataset.open);return}
    if(t.closest("[data-close]")){closeLayers();return}
    if(t.closest("#bagBtn")){openBag();return}
    if(t.closest("#wishBtn")){state.cat="All";toast(state.wish.length?state.wish.length+" saved piece"+(state.wish.length>1?"s":""):"No saved pieces yet");return}
    var inc=t.closest("[data-inc]");if(inc){state.cart[+inc.dataset.inc].qty++;save();badges();renderBag();return}
    var dec=t.closest("[data-dec]");if(dec){var l=state.cart[+dec.dataset.dec];l.qty--;if(l.qty<1)state.cart.splice(+dec.dataset.dec,1);save();badges();renderBag();return}
    var rm=t.closest("[data-rm]");if(rm){state.cart.splice(+rm.dataset.rm,1);save();badges();renderBag();return}
    if(t.closest("#toCheckout")){showCheckout();return}
    if(t.closest("#backShop")){e.preventDefault();showStore();window.scrollTo(0,0);return}
    if(t.closest("#logo")){e.preventDefault();showStore();window.scrollTo(0,0);return}
    if(t.closest("#menuBtn")){var m=$("#mobileLinks"),open=m.classList.toggle("open");$("#menuBtn").setAttribute("aria-expanded",open);return}
  });
  document.addEventListener("change",function(e){
    if(e.target.id==="sort"){state.sort=e.target.value;renderGrid();return}
    if(e.target.name==="ship"){order.ship=e.target.value;var keep=snap();renderCheckout();restore(keep)}
    if(e.target.name==="pay"){order.pay=e.target.value}
  });
  function snap(){return{n:$("#fName").value,e:$("#fEmail").value,p:$("#fPhone").value,a:$("#fAddr").value}}
  function restore(k){$("#fName").value=k.n;$("#fEmail").value=k.e;$("#fPhone").value=k.p;$("#fAddr").value=k.a}
  document.addEventListener("submit",function(e){if(e.target.id==="coForm"){e.preventDefault();placeOrder()}});
  document.addEventListener("keydown",function(e){if(e.key==="Escape")closeLayers()});

  /* ---- catalogue: shared database, photo uploads and the owner's admin page ---- */
  var DBLIST=[],META=false,editing=null,confirmDel=null,saving=false;
  var STD=["XS","S","M","L","XL","XXL","One size"];
  var FIGS={Hats:"hat",Bags:"bag",Handbags:"handbag",Womenswear:"dress"};
  function recompute(){
    var useDb=DBLIST.length>0||META;
    CAPS.live=useDb;PRODUCTS=useDb?DBLIST:DEFAULTS.slice();ready=true;
    state.cart=state.cart.filter(function(l){return prod(l.id)});save();badges();renderGrid();
    if(!$("#adminView").hidden&&!editing)renderAdmin();
    if($("#bagBody"))renderBag();
  }
  function syncRoute(){
    if(location.hash==="#admin"&&CAPS.canEdit)showAdmin();
    else if(!$("#adminView").hidden&&location.hash!=="#admin")showStore();
  }
  function showAdmin(){
    closeLayers();$("#storefront").hidden=true;$("#checkoutView").hidden=true;$("#adminView").hidden=false;
    editing=null;confirmDel=null;renderAdmin();window.scrollTo(0,0)}
  function connect(){
    var c=window.claude||window.RLDemo;
    if(!c||!c.use){recompute();return}
    setTimeout(function(){if(!ready)recompute()},3500);
    c.use("user").then(function(u){
      if(!u)return;
      return Promise.resolve(u.canEdit()).then(function(v){CAPS.canEdit=!!v;$("#adminLink").hidden=!v;$("#adminBar").hidden=!v;syncRoute()})
    }).catch(function(){});
    c.use("assets").then(function(a){CAPS.assets=a}).catch(function(){});
    c.use("db").then(function(db){
      if(!db){recompute();return}
      CAPS.db=db;
      db.collection("products").onSnapshot(function(snap){
        DBLIST=snap.docs.map(function(d){var x=Object.assign({},d.data());x.id=d.id;return x}).sort(function(a,b){return (a.order||0)-(b.order||0)});
        recompute()},function(){recompute()});
      db.doc("meta/catalogue").onSnapshot(function(s){META=!!s.exists;recompute()},function(){});
    }).catch(function(){recompute()});
  }
  function stockTotal(p){return (p.sizes||[]).reduce(function(a,s){return a+((p.stock&&p.stock[s])||0)},0)}
  function pill(p){
    if(p.hidden)return '<span class="pill off">Hidden</span>';
    var t=stockTotal(p);if(t===0)return '<span class="pill low">Sold out</span>';
    return '<span class="pill live">Live</span>'+(t<=3?' <span class="pill low">Low stock</span>':'')}
  function renderAdmin(){
    var v=$("#adminView");if(editing){renderForm();return}
    var live=CAPS.live,rows=PRODUCTS.map(function(p){
      var acts=live?'<div class="acts"><button class="linkbtn" data-edit="'+p.id+'">Edit</button><button class="linkbtn" data-hide="'+p.id+'">'+(p.hidden?'Show in store':'Hide')+'</button>'+
        (confirmDel===p.id?'<button class="linkbtn" data-del="'+p.id+'" style="color:var(--accent)">Confirm delete</button><button class="linkbtn" data-delno="1">Cancel</button>':'<button class="linkbtn" data-del="'+p.id+'">Delete</button>')+'</div>':'<div></div>';
      return '<div class="arow" style="--hue:'+p.hue+'"><div class="thumb">'+fig(p)+'</div><div style="min-width:0"><b style="font-weight:500">'+esc(p.name)+'</b><div class="muted" style="font-size:12px">'+esc(p.cat)+' &middot; '+money(p.price)+' &middot; '+stockTotal(p)+' in stock</div>'+pill(p)+'</div>'+acts+'</div>'}).join("");
    v.innerHTML='<div class="gutter adm"><div class="row" style="align-items:end;flex-wrap:wrap"><div><span class="caps muted">Owner tools</span><h1 class="display" style="margin:4px 0 0">Catalogue</h1></div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn ghost" href="#top" id="backShop">View store</a><button class="btn" id="addProd" '+(CAPS.db?'':'disabled')+'>Add product</button></div></div>'+
      (window.RLDemo?'<div class="notice"><b>Demo mode.</b><span class="muted">Products and photos you add are saved in this browser only, so you can try the admin freely. The live site will save them for everyone.</span><div><button class="btn ghost" id="resetDemo">Reset the demo</button></div></div>':'')+
      (!CAPS.db?'<div class="notice"><b>Saving is not available in this view.</b><span class="muted">Open the page signed in as an editor to change the catalogue.</span></div>':'')+
      (!live&&CAPS.db?'<div class="notice"><b>You are looking at sample pieces.</b><span class="muted">Import them to start editing, or begin with an empty catalogue and add your own.</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" id="importSamples">Import the samples</button><button class="btn ghost" id="startEmpty">Start empty</button></div></div>':'')+
      '<div style="margin-top:8px">'+(rows||'<p class="empty">No products yet. Add the first one.</p>')+'</div></div>'}
  function newForm(p){
    p=p||{};var sizes={};(p.sizes||[]).forEach(function(s){sizes[s]=String((p.stock&&p.stock[s])||0)});
    if(!p.sizes)sizes={"S":"2","M":"2","L":"2"};
    return{id:p.id||null,orig:(p.photos||[]).slice(),added:[],removed:[],uploading:0,
      f:{name:p.name||"",cat:p.cat||"Womenswear",price:p.price!=null?String(p.price):"",tag:p.tag||"",blurb:p.blurb||"",hue:p.hue||"#7A1F3D",hidden:!!p.hidden,order:p.order,sizes:sizes,photos:(p.photos||[]).slice()}}}
  function sid(s){return "st-"+s.replace(/\s/g,"_")}
  function readForm(){
    if(!editing)return;var f=editing.f,g=function(i){var e=document.getElementById(i);return e?e.value:null};
    if(g("pfName")===null)return;
    f.name=g("pfName");f.cat=g("pfCat");f.price=g("pfPrice");f.tag=g("pfTag");f.blurb=g("pfBlurb");f.hue=g("pfHue");f.hidden=document.getElementById("pfHidden").checked;
    Object.keys(f.sizes).forEach(function(s){var e=document.getElementById(sid(s));if(e)f.sizes[s]=e.value})}
  function renderForm(){
    var f=editing.f,v=$("#adminView");
    var cats=["Womenswear","Bags","Handbags","Hats"].map(function(c){return '<option'+(f.cat===c?' selected':'')+'>'+c+'</option>'}).join("");
    var chips=STD.map(function(s){return '<button type="button" class="chip" data-sz="'+s+'" aria-pressed="'+(f.sizes[s]!==undefined)+'">'+s+'</button>'}).join("");
    var stocks=STD.filter(function(s){return f.sizes[s]!==undefined}).map(function(s){return '<label class="f">'+s+' in stock<input type="number" min="0" id="'+sid(s)+'" value="'+esc(f.sizes[s])+'" inputmode="numeric"></label>'}).join("");
    var photos=f.photos.map(function(id,i){return '<div class="phitem"><div class="box"><img src="'+photoUrl(id)+'" alt="Product photo '+(i+1)+'">'+(i===0?'<span class="cover">Cover</span>':'')+'</div><div style="display:flex;gap:10px;flex-wrap:wrap">'+(i>0?'<button type="button" class="linkbtn" data-cover="'+i+'">Make cover</button>':'')+'<button type="button" class="linkbtn" data-rmph="'+i+'">Remove</button></div></div>'}).join("");
    var canUp=!!CAPS.assets&&f.photos.length<6;
    v.innerHTML='<div class="gutter adm"><p class="muted" style="margin:0"><a href="#" id="cancelForm">Back to the catalogue</a></p><h1 class="display" style="margin:6px 0 0">'+(editing.id?'Edit product':'Add product')+'</h1>'+
      '<form class="aform" id="pForm" novalidate>'+
      '<div class="fields"><label class="f full">Name<input type="text" id="pfName" value="'+esc(f.name)+'"></label>'+
      '<label class="f">Category<select id="pfCat">'+cats+'</select></label><label class="f">Price (P)<input type="number" id="pfPrice" min="0" step="1" inputmode="numeric" value="'+esc(f.price)+'"></label>'+
      '<label class="f">Label on the photo (optional)<input type="text" id="pfTag" value="'+esc(f.tag)+'" placeholder="New, Runway, Sale"></label>'+
      '<label class="f">Placeholder colour<input type="color" id="pfHue" value="'+esc(f.hue)+'"></label></div>'+
      '<label class="f">Description<textarea id="pfBlurb">'+esc(f.blurb)+'</textarea></label>'+
      '<div><span class="caps">Sizes and stock</span><div class="szrow" style="margin-top:10px">'+chips+'</div><div class="stockgrid">'+stocks+'</div></div>'+
      '<div><span class="caps">Photos</span><p class="muted" style="margin:4px 0 10px;font-size:12px">The first photo is the cover. Up to 6 photos. Large photos are resized for you.</p><div class="phgrid">'+photos+
      (editing.uploading?'<div class="drop" style="cursor:default">Uploading '+editing.uploading+'...</div>':'')+
      (canUp?'<label class="drop" for="pfFile">Add photos</label>':'')+'</div>'+
      '<input type="file" id="pfFile" accept="image/*" multiple hidden>'+
      (!CAPS.assets?'<p class="muted" style="font-size:12px">Photo upload is not available in this view.</p>':'')+'</div>'+
      '<label class="f" style="display:flex;gap:10px;align-items:center;font-size:14px;color:var(--ink)"><input type="checkbox" id="pfHidden" '+(f.hidden?'checked':'')+' style="accent-color:var(--accent)"> Hide this product from the store</label>'+
      '<div class="err" id="pfErr" role="alert"></div>'+
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit" id="saveBtn" '+(saving?'disabled':'')+'>'+(saving?'Saving...':'Save product')+'</button><button class="btn ghost" type="button" id="cancelForm2">Cancel</button></div></form></div>'}
  function shrink(file){return new Promise(function(res,rej){
    var url=URL.createObjectURL(file),img=new Image();
    img.onload=function(){var m=window.RLDemo?900:1600,s=Math.min(1,m/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);
      var x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);
      c.toBlob(function(b){b?res(b):rej(new Error("blob"))},"image/jpeg",window.RLDemo?.8:.86)};
    img.onerror=function(){URL.revokeObjectURL(url);rej(new Error("read"))};img.src=url})}
  async function addPhotos(files){
    if(!CAPS.assets||!editing)return;readForm();
    var list=Array.prototype.slice.call(files).slice(0,6-editing.f.photos.length);
    for(var i=0;i<list.length;i++){
      editing.uploading=list.length-i;renderForm();
      try{var b=await shrink(list[i]);var r=await CAPS.assets.upload(b,{type:"image/jpeg"});editing.f.photos.push(r.id);editing.added.push(r.id)}
      catch(e){toast(e&&e.code==="quota_or_state"?"Photo storage is full.":"Could not add "+list[i].name+". Try a JPG or PNG.")}
    }
    editing.uploading=0;renderForm()}
  function dropAssets(ids){if(!CAPS.assets)return;ids.forEach(function(id){CAPS.assets.delete(id).catch(function(){})})}
  async function saveForm(){
    if(saving||!CAPS.db)return;readForm();var f=editing.f,err=$("#pfErr");
    var price=parseFloat(f.price),sizes=STD.filter(function(s){return f.sizes[s]!==undefined});
    if(!f.name.trim()){err.textContent="Give the product a name.";return}
    if(!(price>=0)||f.price===""){err.textContent="Enter a price in pula.";return}
    if(!sizes.length){err.textContent="Choose at least one size.";return}
    var stock={};sizes.forEach(function(s){stock[s]=Math.max(0,parseInt(f.sizes[s],10)||0)});
    var doc={name:f.name.trim(),cat:f.cat,price:price,tag:f.tag.trim(),blurb:f.blurb.trim(),hue:f.hue,sizes:sizes,stock:stock,photos:f.photos,hidden:!!f.hidden,fig:FIGS[f.cat]||"dress",order:f.order!=null?f.order:-Date.now()};
    saving=true;renderForm();
    try{
      var ref=editing.id?CAPS.db.doc("products/"+editing.id):CAPS.db.collection("products").doc();
      await ref.set(doc);
      if(!META)await CAPS.db.doc("meta/catalogue").set({imported:true});
      var gone=editing.removed.filter(function(id){return f.photos.indexOf(id)<0});dropAssets(gone);
      saving=false;editing=null;toast("Saved");renderAdmin();
    }catch(e){saving=false;renderForm();$("#pfErr").textContent="Could not save. Check your connection and try again."}}
  function cancelForm(){if(editing&&editing.added.length)dropAssets(editing.added);editing=null;renderAdmin()}
  async function importSamples(){
    if(!CAPS.db)return;var b=$("#importSamples");if(b){b.disabled=true;b.textContent="Importing..."}
    try{
      for(var i=0;i<DEFAULTS.length;i++){var p=DEFAULTS[i];
        await CAPS.db.doc("products/"+p.id).set({name:p.name,cat:p.cat,price:p.price,tag:p.tag,blurb:p.blurb,hue:p.hue,sizes:p.sizes,stock:p.stock,photos:[],hidden:false,fig:p.fig,order:p.order})}
      await CAPS.db.doc("meta/catalogue").set({imported:true});
    }catch(e){toast("Import did not finish. Try again.");renderAdmin()}}
  async function startEmpty(){if(CAPS.db){try{await CAPS.db.doc("meta/catalogue").set({imported:true})}catch(e){toast("Could not start. Try again.")}}}

  var av=$("#adminView");
  av.addEventListener("click",function(e){
    var t=e.target,b;
    if(t.closest("#addProd")){editing=newForm();renderAdmin();window.scrollTo(0,0);return}
    if(t.closest("#resetDemo")){if(window.RLDemo){window.RLDemo.reset();DBLIST=[];META=false;toast("Demo reset");recompute()}return}
    if(t.closest("#importSamples")){importSamples();return}
    if(t.closest("#startEmpty")){startEmpty();return}
    if((b=t.closest("[data-edit]"))){var p=prod(b.dataset.edit);if(p){editing=newForm(p);renderAdmin();window.scrollTo(0,0)}return}
    if((b=t.closest("[data-hide]"))){var q=prod(b.dataset.hide);if(q&&CAPS.db)CAPS.db.doc("products/"+q.id).update({hidden:!q.hidden}).catch(function(){toast("Could not update. Try again.")});return}
    if((b=t.closest("[data-del]"))){var id=b.dataset.del;
      if(confirmDel!==id){confirmDel=id;renderAdmin();return}
      var d=prod(id);confirmDel=null;
      if(d&&CAPS.db)CAPS.db.doc("products/"+id).delete().then(function(){dropAssets(d.photos||[]);toast("Product deleted")}).catch(function(){toast("Could not delete. Try again.")});return}
    if(t.closest("[data-delno]")){confirmDel=null;renderAdmin();return}
    if(t.closest("#cancelForm")||t.closest("#cancelForm2")){e.preventDefault();cancelForm();return}
    if((b=t.closest("[data-sz]"))){readForm();var s=b.dataset.sz,f=editing.f;
      if(f.sizes[s]!==undefined)delete f.sizes[s];else{if(s==="One size")f.sizes={};f.sizes[s]="1";if(s!=="One size")delete f.sizes["One size"]}
      renderForm();return}
    if((b=t.closest("[data-cover]"))){readForm();var ph=editing.f.photos,i=+b.dataset.cover,x=ph.splice(i,1)[0];ph.unshift(x);renderForm();return}
    if((b=t.closest("[data-rmph]"))){readForm();var r=editing.f.photos.splice(+b.dataset.rmph,1)[0];editing.removed.push(r);renderForm();return}
  });
  av.addEventListener("change",function(e){if(e.target.id==="pfFile"){addPhotos(e.target.files);e.target.value=""}});
  av.addEventListener("submit",function(e){e.preventDefault();saveForm()});
  window.addEventListener("hashchange",syncRoute);

  renderChips();renderGrid();badges();connect();
})();
