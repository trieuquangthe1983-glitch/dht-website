/* DHT Thảo Dược — ứng dụng tra cứu bài thuốc & dược liệu (offline, không cần build).
   Kiến trúc: data.js (kho gốc) + gói cập nhật (capnhat.json → localStorage) + bài thuốc cá nhân → DB hợp nhất → tìm kiếm/lọc → giao diện. */
(function(){
"use strict";
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").toLowerCase().replace(/đ/g,"d").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
};
const SAFE={thai:"Đang mang thai",bu:"Đang cho con bú",tre:"Trẻ nhỏ",ha:"Huyết áp cao",dd:"Tiểu đường",cd:"Dùng thuốc chống đông/kháng tiểu cầu",dayday:"Bệnh dạ dày (loét, viêm, trào ngược)",gan:"Bệnh gan / thận",mach:"Bệnh tim mạch",di:"Cơ địa dị ứng (họ Cúc, họ Cà…)"};
const NGUON={"co-truyen":["Cổ truyền","ct"],"dan-gian":["Dân gian","dg"],"nghien-cuu":["Có nghiên cứu","nc"],"ca-nhan":["Cá nhân – chưa kiểm chứng","w"]};
Object.entries(window.DHT_DATA.nguon||{}).forEach(([k,v])=>{NGUON[k]=v});
const LOAI={"boi-bo":"Bồi bổ","co-phuong":"Cổ phương Kampo (kê đơn)",benh:"Chữa bệnh"};
const BC=["","Kinh nghiệm","Có nghiên cứu hỗ trợ","Bằng chứng tốt"];

/* ---------- Dữ liệu hợp nhất ---------- */
const byRank=(a,b)=>(a.loai==="co-phuong")-(b.loai==="co-phuong")||(b.bc||0)-(a.bc||0)||a.ten.localeCompare(b.ten,"vi");
let DB;
function build(){
  const base=window.DHT_DATA;
  const packs=store.get("dht_packs",[]);
  const mine=store.get("dht_mine",[]);
  const H=new Map(),D=new Map(),R=new Map();
  base.herbs.forEach(x=>H.set(x.id,x));base.diseases.forEach(x=>D.set(x.id,x));base.remedies.forEach(x=>R.set(x.id,x));
  packs.sort((a,b)=>a.version-b.version).forEach(p=>{
    (p.herbs||[]).forEach(x=>H.set(x.id,Object.assign({},x,{_v:p.version})));
    (p.diseases||[]).forEach(x=>D.set(x.id,Object.assign({},x,{_v:p.version})));
    (p.remedies||[]).forEach(x=>R.set(x.id,Object.assign({},x,{_v:p.version})));
    const rm=p.removed||{};
    (rm.remedies||[]).forEach(id=>R.delete(id));(rm.herbs||[]).forEach(id=>H.delete(id));
  });
  mine.forEach(x=>R.set(x.id,Object.assign({},x,{nguon:"ca-nhan",bc:1,_mine:true})));
  DB={herbs:[...H.values()],diseases:[...D.values()],remedies:[...R.values()],H,D,R,
      version:Math.max(base.version,...packs.map(p=>p.version||0)),
      updated:packs.length?packs.map(p=>p.date||"").sort().pop():base.updated,groups:base.groups,packs};
  DB.remedies.forEach(r=>{
    const s=new Set(r.cd||[]);r.tp.forEach(t=>{const h=H.get(t[0]);if(h)(h.cd||[]).forEach(c=>s.add(c))});
    r._cd=[...s];
    r._names=r.tp.map(t=>t[0]==="_"?t[2]:(H.get(t[0])||{ten:t[0]}).ten);
  });
  DB.herbs.forEach(h=>{h._r=DB.remedies.filter(r=>r.tp.some(t=>t[0]===h.id))});
  DB.diseases.forEach(d=>{d._r=DB.remedies.filter(r=>(r.benh||[]).includes(d.id)).sort(byRank)});
  index();
}

/* ---------- Tìm kiếm ---------- */
const clean=s=>String(s||"").replace(/hỗ trợ/gi," ");
const pwords=s=>String(s||"").toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(Boolean);
function words(s){return norm(s).split(" ").filter(Boolean)}
let IDX=[];
function index(){
  IDX=[];
  const mk=(txt,w)=>{const t=clean(Array.isArray(txt)?txt.join(" "):txt);return{w,ws:words(t),pw:pwords(t),full:norm(t)}};
  const add=(type,o,fields)=>{IDX.push({type,o,f:fields.map(([txt,w])=>mk(txt,w))})};
  DB.diseases.forEach(d=>add("d",d,[[d.ten,10],[d.tk||[],8],[d.nhom,3],[d.mota,1]]));
  DB.remedies.forEach(r=>{
    const ds=(r.benh||[]).map(id=>DB.D.get(id)).filter(Boolean);
    add("r",r,[[r.ten,10],[ds.map(d=>d.ten),7],[ds.flatMap(d=>d.tk||[]),5],[r._names,6],[r.mota||"",2],[r.luuY||"",0.5],[r.gt||"",0.3]]);
  });
  DB.herbs.forEach(h=>add("h",h,[[h.ten,10],[h.khac||[],9],[h.latin||"",5],[h.congDung||[],4],[h.nhanBiet||"",1],[DB.groups[h.nhom]||"",2]]));
}
// Khớp một từ khóa với một trường: từ khóa có dấu thì khớp theo từ có dấu (đầu ≠ đau); không dấu thì khớp bỏ dấu.
function fieldScore(f,tk,raw){
  const acc=raw!==tk, ws=acc?f.pw:f.ws, t=acc?raw:tk;
  if(ws.some(w=>w===t))return f.w*2;
  if(t.length>=3&&ws.some(w=>w.startsWith(t)))return f.w*1.0;
  return 0;
}
function search(q){
  const toks=words(q), raws=pwords(q).slice(0,toks.length);if(!toks.length)return[];
  const out=[];
  IDX.forEach(it=>{
    let tot=0,all=true;
    toks.forEach((tk,i)=>{let best=0;it.f.forEach(f=>{const s=fieldScore(f,tk,raws[i]||tk);if(s>best)best=s});if(!best)all=false;tot+=best});
    if(!all)return;
    if(toks.length>1)it.f.forEach(f=>{if(toks.every((tk,i)=>fieldScore(f,tk,raws[i]||tk)>0))tot+=f.w*3});
    if(it.f[0].full===norm(q))tot+=25;
    out.push({it,s:tot+(it.type==="d"?2:0)-(it.o.loai==="co-phuong"?4:0)});
  });
  return out.sort((a,b)=>b.s-a.s).map(x=>x.it);
}
window.DHT_SEARCH=q=>search(q).map(x=>x.type+":"+(x.o.ten));

/* ---------- Hồ sơ an toàn & yêu thích ---------- */
const profile=()=>store.get("dht_profile",[]);
const favs=()=>new Set(store.get("dht_favs",[]));
function toggleFav(id){const f=favs();f.has(id)?f.delete(id):f.add(id);store.set("dht_favs",[...f])}
function conflicts(cd){const p=profile();return(cd||[]).filter(c=>p.includes(c))}
function profileBadge(){const n=profile().length;$("#profileCount").textContent=n||""}

/* ---------- Thành phần giao diện ---------- */
const stars=n=>'<span class="stars" title="'+esc(BC[n]||"")+'">'+"★".repeat(n||1)+"☆".repeat(3-(n||1))+"</span>";
const DB_BASE=1;
const newTag=o=>o._v&&o._v>=DB.version&&DB.version>DB_BASE?'<span class="tag new">Mới</span>':"";
function srcTag(r){const n=NGUON[r.nguon]||NGUON["dan-gian"];return`<span class="tag ${n[1]}">${esc(n[0])}</span>`}
function remedyCard(r){
  const c=conflicts(r._cd);
  const f=favs().has(r.id);
  return`<a class="card" href="#/bai-thuoc/${esc(r.id)}"><h4>${esc(r.ten)}</h4><p>${esc(r._names.join(" · "))}</p>
  <div class="meta">${srcTag(r)}${newTag(r)}<span class="tag">${stars(r.bc)}</span>${c.length?`<span class="tag r" title="${esc(c.map(x=>SAFE[x]).join(", "))}">⚠ Lưu ý với hồ sơ của bạn</span>`:""}</div>
  <button class="fav ${f?"on":""}" data-fav="${esc(r.id)}" aria-label="Yêu thích">${f?"★":"☆"}</button></a>`}
function herbCard(h){
  const c=conflicts(h.cd);
  return`<a class="card" href="#/thao-duoc/${esc(h.id)}"><span class="em">${esc(h.e||"🌿")}</span><h4>${esc(h.ten)}</h4>${h.latin?`<p><i>${esc(h.latin)}</i></p>`:""}
  <p>${esc((h.congDung||[])[0]||"")}</p>
  <div class="meta">${h.tinh?`<span class="tag">${esc(h.tinh)}</span>`:""}${h.vi?`<span class="tag">${esc(h.vi)}</span>`:""}${h.nguon==="bo-y-te"?srcTag(h):""}${newTag(h)}${c.length?'<span class="tag r">⚠ Lưu ý với hồ sơ của bạn</span>':""}</div></a>`}
function diseaseCard(d){return`<a class="card" href="#/benh/${esc(d.id)}"><h4>${esc(d.ten)}</h4><p>${esc((d.mota||"").slice(0,95))}…</p>
  <div class="meta"><span class="tag">${esc(d.nhom)}</span><span class="tag">${d._r.length} bài thuốc</span>${newTag(d)}</div></a>`}
const cards=(arr,fn,emptyMsg)=>arr.length?`<div class="grid">${arr.map(fn).join("")}</div>`:`<div class="empty">${emptyMsg||"Không có kết quả."}</div>`;

/* ---------- Các màn hình ---------- */
const TABS=[["","Tìm kiếm"],["benh","Theo bệnh"],["bai-thuoc","Bài thuốc"],["boi-bo","Bồi bổ"],["thao-duoc","Kho dược liệu"],["yeu-thich","Yêu thích"],["cap-nhat","Cập nhật"]];
function viewHome(){
  const pop=["cam-lanh","ho","dau-hong","day-bung","mat-ngu","dau-da-day","xuong-khop","huyet-ap"].map(id=>DB.D.get(id)).filter(Boolean);
  const latest=DB.remedies.filter(r=>r._v).slice(0,4);
  return`<div class="hero"><h1>Tìm bài thuốc đúng bệnh, đúng người</h1><p>Gõ tên bệnh, triệu chứng hoặc vị thuốc. Có đủ bài thuốc cổ truyền, dân gian, bồi bổ — kèm cảnh báo an toàn theo thể trạng của bạn.</p></div>
  <div class="chips">${pop.map(d=>`<a class="chip" href="#/benh/${esc(d.id)}">${esc(d.ten.replace(/\s*\(.*$/,"").split(",")[0])}</a>`).join("")}</div>
  <div class="sec-h"><h2>Bồi bổ sức khỏe</h2><a href="#/boi-bo">Xem tất cả</a></div>${cards(DB.remedies.filter(r=>r.loai==="boi-bo").slice(0,4),remedyCard)}
  ${latest.length?`<div class="sec-h"><h2>Mới cập nhật</h2><a href="#/cap-nhat">Nhật ký</a></div>${cards(latest,remedyCard)}`:""}
  <div class="sec-h"><h2>Nhận biết dược liệu</h2><a href="#/thao-duoc">Mở kho</a></div>${cards(DB.herbs.slice(0,4),herbCard)}
  <footer>Kho: ${DB.herbs.length} dược liệu · ${DB.diseases.length} nhóm bệnh · ${DB.remedies.length} bài thuốc · phiên bản dữ liệu ${DB.version} (${esc(DB.updated)}).</footer>`;
}
function viewSearch(q){
  const res=search(q);
  const g={d:[],r:[],h:[]};res.forEach(x=>g[x.type].push(x.o));
  if(!res.length)return`<h2>Kết quả cho “${esc(q)}”</h2><div class="empty">Không tìm thấy. Thử từ ngắn hơn (vd: “ho”, “mất ngủ”, “gừng”), hoặc <a href="#/cap-nhat">thêm bài thuốc của bạn</a>.</div>`;
  return`<h2>Kết quả cho “${esc(q)}” <small style="color:var(--mut);font-weight:400">(${res.length})</small></h2>
  ${g.d.length?`<h3>Bệnh / triệu chứng</h3>${cards(g.d.slice(0,6),diseaseCard)}`:""}
  ${g.r.length?`<h3>Bài thuốc (${g.r.length})</h3>${cards(g.r.slice(0,30),remedyCard)}`:""}
  ${g.h.length?`<h3>Dược liệu (${g.h.length})</h3>${cards(g.h.slice(0,24),herbCard)}`:""}`;
}
function viewDiseases(){
  const by={};DB.diseases.forEach(d=>(by[d.nhom]=by[d.nhom]||[]).push(d));
  return`<h2>Tra cứu theo bệnh</h2>`+Object.keys(by).map(k=>`<h3>${esc(k)}</h3>${cards(by[k],diseaseCard)}`).join("");
}
function viewRemedies(params,boi){
  const fl=params.get("nguon")||"",lo=params.get("loai")||(boi?"boi-bo":"");
  let arr=DB.remedies.filter(r=>(!fl||r.nguon===fl)&&(!lo||r.loai===lo)).sort(byRank);
  const total=arr.length,lim=Math.max(60,parseInt(params.get("n"))||60);arr=arr.slice(0,lim);
  const base=boi?"#/boi-bo":"#/bai-thuoc";
  const chip=(k,l)=>`<a class="chip ${fl===k?"on":""}" href="${base}${k?"?nguon="+k:""}">${l}</a>`;
  return`<h2>${boi?"Bài thuốc bồi bổ sức khỏe":"Tất cả bài thuốc"} <small style="color:var(--mut);font-weight:400">(${total})</small></h2>
  <div class="chips">${chip("","Tất cả")}${chip("co-truyen","Cổ truyền")}${chip("dan-gian","Dân gian")}${chip("nghien-cuu","Có nghiên cứu")}${chip("bo-y-te","Sách Bộ Y tế")}${chip("kampo","Cổ phương Kampo")}${chip("ca-nhan","Của tôi")}</div>
  ${cards(arr,remedyCard,"Chưa có bài thuốc nào trong nhóm này.")}${total>lim?`<p class="row" style="justify-content:center"><a class="btn o" href="${base}?${fl?"nguon="+fl+"&":""}n=${lim+120}">Xem thêm (${total-lim} bài)</a></p>`:""}`;
}
function viewHerbs(params){
  const g=params.get("nhom")||"",t=params.get("tinh")||"";
  let arr=DB.herbs.filter(h=>(!g||h.nhom===g)&&(!t||norm(h.tinh).startsWith(norm(t)))).sort((a,b)=>a.ten.localeCompare(b.ten,"vi"));
  const chip=(k,l)=>`<a class="chip ${g===k?"on":""}" href="#/thao-duoc${k?"?nhom="+k:""}">${esc(l)}</a>`;
  return`<h2>Kho dược liệu — nhận biết &amp; phân loại <small style="color:var(--mut);font-weight:400">(${arr.length})</small></h2>
  <div class="chips">${chip("","Tất cả")}${Object.entries(DB.groups).map(([k,v])=>chip(k,v)).join("")}</div>
  ${cards(arr,herbCard)}`;
}
function viewFavs(){
  const f=favs();const arr=DB.remedies.filter(r=>f.has(r.id));
  return`<h2>Bài thuốc yêu thích</h2>${cards(arr,remedyCard,"Chạm vào ☆ trên thẻ bài thuốc để lưu lại tại đây (lưu trên thiết bị này).")}`;
}
function viewDisease(id){
  const d=DB.D.get(id);if(!d)return nf();
  const herbs=[...new Set(d._r.flatMap(r=>r.tp.map(t=>t[0])))].map(i=>DB.H.get(i)).filter(Boolean);
  return`<div class="crumb"><a href="#/benh">← Theo bệnh</a></div><h2 style="margin-top:6px">${esc(d.ten)}</h2><div class="meta"><span class="tag">${esc(d.nhom)}</span></div>
  <p>${esc(d.mota)}</p>
  <div class="box red"><h3>🚩 Đi khám ngay khi có dấu hiệu</h3><ul>${(d.canKham||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
  <h3>Bài thuốc gợi ý (${d._r.length})</h3>${cards(d._r,remedyCard,"Chưa có bài thuốc.")}
  ${herbs.length?`<h3>Dược liệu thường dùng</h3>${cards(herbs,herbCard)}`:""}`;
}
function safetyBox(cd,what){
  const c=conflicts(cd);
  let h="";
  if(c.length)h+=`<div class="box red"><h3>⚠ Không phù hợp / cần hỏi thầy thuốc trước</h3><p>Theo hồ sơ của bạn: <b>${esc(c.map(x=>SAFE[x]).join("; "))}</b>. ${what} có thể không an toàn với tình trạng này.</p></div>`;
  else if((cd||[]).length)h+=`<div class="box warn"><h3>Thận trọng với</h3><p>${esc(cd.map(x=>SAFE[x]).join("; "))}</p></div>`;
  return h;
}
function viewRemedy(id){
  const r=DB.R.get(id);if(!r)return nf();
  const ds=(r.benh||[]).map(i=>DB.D.get(i)).filter(Boolean);
  const f=favs().has(r.id);
  return`<div class="crumb"><a href="javascript:history.back()">← Quay lại</a></div>
  <div class="row" style="justify-content:space-between"><h2 style="margin:6px 0">${esc(r.ten)}</h2><div class="row"><button class="btn o" data-fav="${esc(r.id)}">${f?"★ Đã lưu":"☆ Lưu"}</button><button class="btn o" id="shareBtn">Chia sẻ</button></div></div>
  <div class="meta">${srcTag(r)}<span class="tag">${stars(r.bc)} ${esc(BC[r.bc||1])}</span><span class="tag">${esc(LOAI[r.loai]||"Chữa bệnh")}</span>${newTag(r)}</div>
  ${r.mota?`<p>${esc(r.mota)}</p>`:""}
  ${r.loai==="co-phuong"?`<div class="box red"><h3>Bài thuốc kê đơn — không tự dùng</h3><p>Cổ phương Nhật Bản được chỉ định theo “chứng” (thể trạng, triệu chứng) của từng người. Chỉ dùng khi có thầy thuốc y học cổ truyền thăm khám và kê đơn.</p></div>`:""}
  ${safetyBox(r._cd,"Bài thuốc này")}
  <div class="box"><h3 style="margin-top:0">Thành phần</h3><ul class="ing">${r.tp.map(t=>{const h=DB.H.get(t[0]);return`<li>${h?`<a href="#/thao-duoc/${esc(h.id)}">${esc(h.e||"")} ${esc(h.ten)}</a>`:`<span>${esc(t[2]||t[0])}</span>`}<span>${esc(t[1])}</span></li>`}).join("")}</ul></div>
  <div class="box"><dl class="dl"><dt>Cách làm</dt><dd>${esc(r.lam)}</dd><dt>Cách dùng</dt><dd>${esc(r.dung)}</dd><dt>Lưu ý</dt><dd>${esc(r.luuY)}</dd></dl></div>
  ${r.gt?`<details class="box"><summary><b>Giải thích theo sách</b></summary>${r.gt.split("\n").map(p=>`<p>${esc(p)}</p>`).join("")}</details>`:""}
  ${ds.length?`<h3>Dùng cho</h3><div class="chips">${ds.map(d=>`<a class="chip" href="#/benh/${esc(d.id)}">${esc(d.ten)}</a>`).join("")}</div>
  <div class="box red"><h3>🚩 Đi khám khi</h3><ul>${[...new Set(ds.flatMap(d=>d.canKham||[]))].slice(0,6).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
  ${r._mine?`<button class="btn d" data-del="${esc(r.id)}">Xóa bài thuốc này</button>`:""}`;
}
function viewHerb(id){
  const h=DB.H.get(id);if(!h)return nf();
  return`<div class="crumb"><a href="javascript:history.back()">← Quay lại</a></div>
  <h2 style="margin:6px 0">${esc(h.e||"")} ${esc(h.ten)}</h2>${h.latin?`<p style="margin:0;color:var(--mut)"><i>${esc(h.latin)}</i>${h.ho?" — "+esc(h.ho):""}</p>`:""}
  <div class="meta"><span class="tag">${esc(DB.groups[h.nhom]||"")}</span>${h.tinh?`<span class="tag">Tính: ${esc(h.tinh)}</span>`:""}${h.vi?`<span class="tag">Vị: ${esc(h.vi)}</span>`:""}${h.nguon==="bo-y-te"?srcTag(h):""}${newTag(h)}</div>
  ${safetyBox(h.cd,"Dược liệu này")}
  <div class="box"><dl class="dl"><dt>Tên gọi khác</dt><dd>${esc((h.khac||[]).join(", ")||"—")}</dd><dt>Bộ phận dùng</dt><dd>${esc(h.bo)}</dd>
  <dt>Công dụng</dt><dd><ul style="margin:0;padding-left:18px">${(h.congDung||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul></dd>
  ${h.nhanBiet?`<dt>🔍 Cách nhận biết</dt><dd>${esc(h.nhanBiet)}</dd>`:""}${h.trong?`<dt>🌱 Cách trồng</dt><dd>${esc(h.trong)}</dd>`:""}${h.thuHai?`<dt>Thu hái, chế biến</dt><dd>${esc(h.thuHai)}</dd>`:""}<dt>Liều dùng tham khảo</dt><dd>${esc(h.lieu)}${h.lieuSach&&h.lieuSach!==h.lieu?`<br><small>Theo sách “Cây rau cây thuốc”: ${esc(h.lieuSach)}</small>`:""}</dd><dt>Lưu ý</dt><dd>${esc(h.luuY)}</dd></dl></div>
  <h3>Bài thuốc có dùng ${esc(h.ten)} (${h._r.length})</h3>${cards(h._r,remedyCard,"Chưa có bài thuốc.")}`;
}
const nf=()=>`<div class="empty">Không tìm thấy nội dung. <a href="#/">Về trang chủ</a></div>`;

/* ---------- Cập nhật & đóng góp ---------- */
function viewUpdate(){
  const last=store.get("dht_lastcheck","chưa kiểm tra");
  const mine=DB.remedies.filter(r=>r._mine);
  const log=DB.packs.sort((a,b)=>b.version-a.version);
  return`<h2>Cập nhật kho dữ liệu</h2>
  <div class="box"><p style="margin-top:0">Phiên bản dữ liệu: <b>${DB.version}</b> (${esc(DB.updated)}). Lần kiểm tra gần nhất: ${esc(last)}.</p>
  <div class="row"><button class="btn" id="chk">⟳ Kiểm tra bài thuốc mới</button><label class="btn o" for="imp" style="cursor:pointer">Nhập gói .json</label><input id="imp" type="file" accept=".json,application/json" hidden></div>
  <p style="color:var(--mut);font-size:13px;margin-bottom:0">Ứng dụng tự kiểm tra khi có mạng (tối đa 1 lần/ngày). Gói mới chỉ <b>thêm/cập nhật theo mã</b>, không xóa dữ liệu cá nhân. Mọi bài thuốc mới đều qua biên tập, ghi rõ nguồn và mức bằng chứng.</p></div>
  <h3>Nhật ký cập nhật</h3><div class="box"><ul>${log.map(p=>`<li><b>v${p.version}</b> (${esc(p.date||"")}) — ${esc(p.note||"")}: +${(p.remedies||[]).length} bài thuốc, +${(p.herbs||[]).length} dược liệu</li>`).join("")||"<li>Chưa có gói cập nhật nào được áp dụng.</li>"}<li><b>v1</b> — Kho khởi tạo.</li></ul></div>
  <h2>Bài thuốc của tôi (dân gian gia truyền)</h2>
  <div class="box"><p style="margin-top:0;color:var(--mut)">Lưu bài thuốc bạn biết để tra cứu nhanh. Bài thuốc cá nhân được gắn nhãn <b>“chưa kiểm chứng”</b> và chỉ lưu trên thiết bị này.</p>
  <form id="mineForm">
   <label class="f">Tên bài thuốc *</label><input type="text" name="ten" required maxlength="120">
   <label class="f">Dùng cho bệnh/triệu chứng</label><select name="benh">${DB.diseases.map(d=>`<option value="${esc(d.id)}">${esc(d.ten)}</option>`).join("")}</select>
   <label class="f">Thành phần (mỗi dòng một vị: tên – liều)*</label><textarea name="tp" required placeholder="Gừng tươi – 5 lát&#10;Mật ong – 1 thìa"></textarea>
   <label class="f">Cách làm *</label><textarea name="lam" required></textarea>
   <label class="f">Cách dùng</label><textarea name="dung"></textarea>
   <label class="f">Lưu ý / kiêng kỵ</label><textarea name="luuY"></textarea>
   <p style="margin-bottom:0"><button class="btn" type="submit">Lưu bài thuốc</button></p></form></div>
  ${mine.length?`<h3>Đã lưu (${mine.length})</h3>${cards(mine,remedyCard)}<p><button class="btn o" id="exp">⬇ Xuất bài thuốc của tôi (.json)</button></p>`:""}
  <h3>Dữ liệu trên thiết bị</h3><p><button class="btn d" id="reset">Xóa gói cập nhật &amp; dữ liệu cá nhân</button></p>`;
}
function validPack(p){return p&&typeof p==="object"&&Number.isInteger(p.version)&&["herbs","diseases","remedies"].every(k=>p[k]==null||Array.isArray(p[k]))&&
  (p.remedies||[]).every(r=>r&&r.id&&r.ten&&Array.isArray(r.tp)&&r.tp.every(t=>Array.isArray(t)&&t.length>=2)&&r.lam)&&(p.herbs||[]).every(h=>h&&h.id&&h.ten)&&(p.diseases||[]).every(d=>d&&d.id&&d.ten)}
function applyPack(p){
  if(!validPack(p))throw new Error("Gói dữ liệu không hợp lệ");
  const packs=store.get("dht_packs",[]).filter(x=>x.version!==p.version);
  packs.push(p);
  if(!store.set("dht_packs",packs))throw new Error("Không đủ bộ nhớ để lưu gói cập nhật");
  build();
}
async function checkUpdate(silent){
  const url=store.get("dht_update_url","capnhat.json");
  try{
    const res=await fetch(url+(url.includes("?")?"&":"?")+"_="+Date.now(),{cache:"no-store"});
    if(!res.ok)throw new Error("HTTP "+res.status);
    const p=await res.json();
    store.set("dht_lastcheck",new Date().toLocaleString("vi-VN"));
    if(p.version>DB.version){const n=(p.remedies||[]).length;applyPack(p);toast(`Đã cập nhật v${p.version}: +${n} bài thuốc`);return true}
    if(!silent)toast("Bạn đang dùng bản mới nhất");
  }catch(e){if(!silent)toast("Không kiểm tra được: "+e.message)}
  return false;
}

/* ---------- Router ---------- */
const view=$("#view");
function route(){
  const raw=location.hash.slice(2);const [path,qs]=raw.split("?");const parts=path.split("/").filter(Boolean).map(decodeURIComponent);
  const params=new URLSearchParams(qs||"");const top=parts[0]||"";
  let html;
  if(top==="tim")html=viewSearch(params.get("q")||"");
  else if(top==="benh")html=parts[1]?viewDisease(parts[1]):viewDiseases();
  else if(top==="bai-thuoc")html=parts[1]?viewRemedy(parts[1]):viewRemedies(params,false);
  else if(top==="boi-bo")html=viewRemedies(params,true);
  else if(top==="thao-duoc")html=parts[1]?viewHerb(parts[1]):viewHerbs(params);
  else if(top==="yeu-thich")html=viewFavs();
  else if(top==="cap-nhat")html=viewUpdate();
  else html=viewHome();
  view.innerHTML=html;
  $("#tabs").innerHTML=TABS.map(([k,l])=>`<a href="#/${k}" class="${k===top||(top==="tim"&&k==="")?"on":""}">${l}</a>`).join("");
  document.title=top==="tim"?"Tìm: "+(params.get("q")||"")+" – DHT Thảo Dược":"DHT Thảo Dược – Kho bài thuốc & dược liệu";
  scrollTo(0,0);
}
function toast(m){const t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove("on"),2800)}
function openProfile(){
  const p=profile();
  $("#sheet").innerHTML=`<h2 style="margin-top:0">🛡️ Hồ sơ an toàn của tôi</h2><p style="color:var(--mut)">Chọn tình trạng của bạn. Ứng dụng sẽ gắn cảnh báo đỏ trên bài thuốc/dược liệu cần thận trọng. Chỉ lưu trên thiết bị này.</p>
  ${Object.entries(SAFE).map(([k,v])=>`<label class="pf"><input type="checkbox" value="${k}" ${p.includes(k)?"checked":""}><span>${esc(v)}</span></label>`).join("")}
  <p class="row" style="margin-bottom:0"><button class="btn" id="pfOk">Lưu</button><button class="btn o" id="pfX">Đóng</button></p>`;
  $("#modal").hidden=false;
}
const closeModal=()=>{$("#modal").hidden=true};

/* ---------- Sự kiện ---------- */
document.addEventListener("click",e=>{
  const fav=e.target.closest("[data-fav]");
  if(fav){e.preventDefault();e.stopPropagation();toggleFav(fav.dataset.fav);route();return}
  const del=e.target.closest("[data-del]");
  if(del&&confirm("Xóa bài thuốc này?")){store.set("dht_mine",store.get("dht_mine",[]).filter(x=>x.id!==del.dataset.del));build();location.hash="#/cap-nhat";return}
  const id=e.target.id;
  if(id==="pfOk"){store.set("dht_profile",[...document.querySelectorAll("#sheet input:checked")].map(i=>i.value));profileBadge();closeModal();route();toast("Đã lưu hồ sơ an toàn")}
  else if(id==="pfX"||e.target.id==="modal")closeModal();
  else if(id==="chk")checkUpdate(false).then(()=>route());
  else if(id==="reset"&&confirm("Xóa toàn bộ gói cập nhật và bài thuốc cá nhân trên thiết bị này?")){["dht_packs","dht_mine","dht_favs","dht_lastcheck"].forEach(k=>localStorage.removeItem(k));build();route();toast("Đã đặt lại")}
  else if(id==="exp"){const b=new Blob([JSON.stringify({version:0,remedies:store.get("dht_mine",[])},null,1)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="bai-thuoc-cua-toi.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
  else if(id==="shareBtn"){const r=DB.R.get(location.hash.split("/")[2]);const txt=r?`${r.ten}\nThành phần: ${r.tp.map(t=>(t[2]||(DB.H.get(t[0])||{}).ten||t[0])+" "+t[1]).join("; ")}\nCách làm: ${r.lam}\nCách dùng: ${r.dung}\nLưu ý: ${r.luuY}\n(Chỉ để tham khảo, không thay thế tư vấn y tế)`:"";
    if(navigator.share)navigator.share({title:r.ten,text:txt}).catch(()=>{});else if(navigator.clipboard)navigator.clipboard.writeText(txt).then(()=>toast("Đã sao chép nội dung"))}
});
document.addEventListener("submit",e=>{
  if(e.target.id==="searchForm"){e.preventDefault();const q=$("#q").value.trim();if(q)location.hash="#/tim?q="+encodeURIComponent(q)}
  else if(e.target.id==="mineForm"){
    e.preventDefault();const f=new FormData(e.target);
    const tp=String(f.get("tp")).split("\n").map(s=>s.trim()).filter(Boolean).map(s=>{const [a,...b]=s.split(/\s*[–—-]\s*/);return["_",b.join(" – ")||"vừa đủ",a]});
    const r={id:"ca-nhan-"+Date.now().toString(36),ten:String(f.get("ten")).trim(),benh:[f.get("benh")],loai:"benh",tp,lam:String(f.get("lam")).trim(),dung:String(f.get("dung")).trim()||"—",luuY:String(f.get("luuY")).trim()||"Chưa được kiểm chứng. Hỏi thầy thuốc trước khi dùng.",mota:"Bài thuốc do người dùng thêm."};
    const arr=store.get("dht_mine",[]);arr.push(r);store.set("dht_mine",arr);build();route();toast("Đã lưu bài thuốc của bạn")}
});
document.addEventListener("change",e=>{
  if(e.target.id==="imp"&&e.target.files[0]){
    const fr=new FileReader();
    fr.onload=()=>{try{const p=JSON.parse(fr.result);
      if(p.version===0){const mine=store.get("dht_mine",[]);(p.remedies||[]).forEach(r=>{if(r&&r.id&&r.ten&&Array.isArray(r.tp)&&!mine.some(m=>m.id===r.id))mine.push(r)});store.set("dht_mine",mine);build()}
      else applyPack(p);route();toast("Đã nhập dữ liệu")}catch(err){toast("Lỗi: "+err.message)}};
    fr.readAsText(e.target.files[0]);
  }
});
window.addEventListener("hashchange",route);
window.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});
$("#profileBtn").addEventListener("click",openProfile);

/* ---------- Khởi động ---------- */
build();profileBadge();
route();
if("serviceWorker" in navigator&&location.protocol.startsWith("http"))navigator.serviceWorker.register("sw.js").catch(()=>{});
const today=new Date().toISOString().slice(0,10);
if(navigator.onLine&&store.get("dht_autochk","")!==today){store.set("dht_autochk",today);checkUpdate(true).then(u=>{if(u)route()})}
})();
