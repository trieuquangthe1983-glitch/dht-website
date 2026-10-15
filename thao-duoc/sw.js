const IMGS=["img/bac-ha.jpg", "img/bi-ngo.jpg", "img/bi-xanh.jpg", "img/cai-canh.jpg", "img/cai-cu.jpg", "img/can-tay.jpg", "img/dau-van-trang.jpg", "img/diep-ca.jpg", "img/gai.jpg", "img/gung.jpg", "img/hanh.jpg", "img/he.jpg", "img/hung-chanh.jpg", "img/hung-gioi.jpg", "img/kinh-gioi.jpg", "img/ky-tu.jpg", "img/la-lot.jpg", "img/ma-de.jpg", "img/mo-tam-the.jpg", "img/mong-toi.jpg", "img/mui.jpg", "img/muop.jpg", "img/muop-dang.jpg", "img/nghe.jpg", "img/rau-ma.jpg", "img/rau-ngot.jpg", "img/rau-ram.jpg", "img/rieng.jpg", "img/tho-cao-ly-sam.jpg", "img/tia-to.jpg", "img/to.jpg"];
const V="thao-duoc-v3",FILES=IMGS.concat(["./","index.html","app.css","app.js","data.js","data-rau.js","data-kampo.js","icon.svg","manifest.webmanifest"]);
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
  const u=new URL(e.request.url);if(e.request.method!=="GET"||u.origin!==location.origin)return;
  // Gói cập nhật: luôn thử mạng trước. Còn lại: mạng trước, rơi về cache khi offline.
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&!u.pathname.endsWith("capnhat.json")){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match("index.html"))));
});
