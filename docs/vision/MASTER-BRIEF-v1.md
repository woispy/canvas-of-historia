# CANVAS OF HISTORIA
## Master Game Architecture & Development Prompt (v1 draft)

> Kaynak: kullanıcının 2026-09-18 tarihli ilk oyun briefi. Bu dosya oyunun
> taslak vizyonudur; birebir uygulanacak spec değil, mimari kararların
> dayanağıdır. Güncel durum için `docs/STATUS.md` geçerlidir.

Sen artık **Canvas of Historia** adlı büyük ölçekli tarihsel grand-strategy oyun projesinin baş mimarı, oyun sistemleri tasarımcısı, tarihsel veri mimarı, WebGPU/WebGL grafik mühendisi, performans mühendisi, UI/UX mimarı ve simulation-engine geliştiricisisin.

Bu proje sıfırdan kurulacaktır.

Mevcut herhangi bir eski kod tabanını, eski mimariyi veya eski proje varsayımını taşımaya çalışma. Eski projelerden yalnızca doğrulanmış tasarım fikirleri ve teknik dersler alınabilir.

---

# 1. OYUNUN ADI

**Canvas of Historia**

Kısa isim: **CoH**

---

# 2. OYUNUN TEMEL VİZYONU

Canvas of Historia;

* Pax Historia'dan ilham alan,
* ancak Pax Historia'nın kopyası olmayan,
* Europa Universalis 5,
* Crusader Kings III,
* Victoria 3

gibi oyunların güçlü yönlerinden esinlenen fakat kendi oyun kimliğine sahip;

**çok derin, tarihsel, dinamik, simülasyon ağırlıklı bir grand-strategy sandbox oyunudur.**

Temel amaç:

> Oyuncuya yalnızca bir ülkenin yöneticisi olmayı değil, tarihsel dünyanın yaşayan ve sürekli değişen bir sistemini yönetme hissini vermek.

Oyuncunun verdiği kararlar: nüfusu, ekonomiyi, şehirleri, ticareti, teknolojiyi, diplomatik ilişkileri, savaşları, kültürleri, dinleri, devlet kurumlarını, hanedanları, şehirleşmeyi, üretimi, kaynak fiyatlarını, devlet gelirlerini, toplumsal sınıfları uzun vadede değiştirmelidir.

Dünya yalnızca oyuncu için hareket etmemelidir. **Oyuncunun olmadığı devletler de kendi kararlarını alan aktif simülasyon aktörleri olmalıdır.**

---

# 3. ANA GELİŞTİRME HEDEFİ

İlk ve senaryosu, ileride farklı senaryolar da eklenebilecek: **1326**

Başlangıç tarihi: **7 Nisan 1326**

Tarihsel başlangıç noktası: **Bursa'nın Osmanlılar tarafından ele geçirilmesinin hemen sonrası.**

Bu tarih oyunun ilk production scenario'sudur. Production dünyası **1326** olacaktır.

---

# 4. 1326 SENARYOSU

Oyuncu oyuna girdiğinde dünya **7 Nisan 1326** tarihindeki tarihsel durumdan başlamalıdır. Bursa başlangıçta Osmanlı kontrolündedir. Nicaea/Nikya ve Nicomedia/İzmit gibi daha sonraki Osmanlı fetihleri 1326 başlangıç durumuna geriye dönük şekilde uygulanmamalıdır. Tarihsel başlangıç durumu ile alternatif tarih başlangıçtan sonra birbirinden ayrılmalıdır:

```text
7 Nisan 1326
       ↓
Tarihsel başlangıç durumu
       ↓
Oyuncunun kararları
       ↓
Alternatif tarih
```

---

# 5. OYUN FELSEFESİ

Oyuncuya tarihsel bir "doğru cevap" zorlatma. Tarihsel gerçeklik **başlangıç koşuludur.** Oyuncu karar verdikten sonra **alternatif tarih özgürlüğü başlar.** Örneğin Bursa başlangıçta Osmanlı kontrolündedir. Oyuncuya Bursa'nın gelecekte başkent yapılıp yapılmayacağı gibi kararlar sunulabilir. Ancak sistem oyuncuya "Tarih böyle oldu, bunu yapmak zorundasın." dememelidir.

---

# 6. HARİTA — PROJENİN EN ÖNEMLİ SİSTEMLERİNDEN BİRİ

Harita Canvas of Historia'nın merkezidir. Harita yalnızca siyasi polygonlardan oluşan düz bir 2D katman olmamalıdır. Harita: fiziksel coğrafya, siyasi coğrafya, terrain, deniz, kıyı, nehir, göl, şehir, yollar, ticaret, ordular, nüfus, kaynaklar, eyaletler, devletler gibi katmanların birleşiminden oluşmalıdır.

---

# 7. HARİTA GÖRSEL REFERANSLARI

EU5, CK3, Victoria 3 görsel hissiyatından ilham al. EU5 benzeri genel harita hissiyatı: temiz, yüksek kaliteli, modern grand-strategy, detaylı, katmanlı, okunabilir, doğal terrain, kaliteli coastline, kaliteli political borders, güçlü zoom deneyimi.

CK3 / Victoria 3 / EU5 benzeri şehir yaklaşımı: haritaya yaklaşıldığında şehirler düz ikon olarak kalmamalıdır — **minimal fakat kaliteli 3D sahneler / modeller** haline gelmelidir:

```text
World View → Regional View → Province View → City View
uzak: city marker / orta: city icon + footprint / yakın: minimal 3D city / çok yakın: detaylı 3D city
```

Şehirler haritanın tamamını dolduran ağır assetler olmamalı. **LOD zorunludur.**

---

# 8. ORDU GÖRSELLERİ

Uzak zoom: army marker. Orta zoom: army formation. Yakın zoom: minimal 3D animated army. Daha yakın: detaylı 3D unit representation. Ordular hareket etmeli, yön değiştirmeli, savaş/kuşatma durumuna göre animasyon değiştirmeli; deniz kuvvetleri için ayrı gemi modelleri. 15.000+ province hedefi nedeniyle **GPU instancing + LOD + visibility culling + batching kullanılmalıdır.**

---

# 9. KIYI VE DENİZ KALİTESİ

Coastline kalitesi Open Historia (https://openhistoria.com/) seviyesinde veya daha yüksek olmalı. Open Historia yalnızca **görsel ve teknik referans** — kodu kopyalanmamalı, lisanslara dikkat. Canvas of Historia kendi veri pipeline'ına ve renderer mimarisine sahip olmalı.

---

# 10. COASTLINE

Coastline: gerçek geometriye yakın, yüksek çözünürlüklü, koyları/yarımadaları/adaları/boğazları koruyan bağımsız bir **fiziksel coğrafya authority katmanı** olmalı. Province polygonundan türetilmiş kaba çizgi olmamalı.

---

# 11. DENİZ

Deniz tek renk mavi background olmamalı:

```text
Sea ├── water geometry ├── coastline ├── islands ├── shallow water ├── bathymetry ├── depth shading ├── coastal transition └── optional atmospheric effects
```

Mümkün olduğunda gerçek coğrafi veriler kullanılmalı.

---

# 12. TERRAIN

Terrain gerçek DEM verilerine dayanmalı: elevation, mountain, valley, ridge, slope, coastal elevation, hillshade, terrain material. Pipeline:

```text
DEM Source → Validation → Normalization → Terrain Tiles → LOD → GPU Residency → Rendering
```

---

# 13. PHYSICAL GEOGRAPHY AUTHORITY

Fiziksel coğrafya siyasi coğrafyadan ayrılmalı. Coastline, Lakes, Rivers, DEM, Mountains, Ridges, Terrain, Bathymetry bağımsız authority katmanlarıdır. Siyasi harita bunları kullanabilir ama yerine geçemez.

---

# 14. HISTORICAL GEOGRAPHY ENGINE

Genel amaçlı **Historical Geography Engine (HGE)** tasarla; ilk implementation yalnızca **1326** senaryosunu destekler. HGE ileride 1350/1400/1453/1500/1600/1700/1800 senaryolarını destekleyebilecek şekilde tasarlanmalı — ama şu anda bu senaryoların datası üretilmemeli.

---

# 15. HGE VERİ MODELİ

City / Province / Region / State / Empire / Influence / Historical Territory birbirinden ayrılmalı. **Historical city ≠ modern administrative boundary.** Şehir koordinatı ≠ tarihsel kontrol alanı polygonu.

---

# 16. HISTORICAL EVIDENCE MODEL

Her kritik historical claim için: source, sourceType, date, confidence (VERY_HIGH/HIGH/MEDIUM/LOW/SPECULATIVE), interpretation, geometryConfidence, provenance. Belirsizlik sistem içinde kaybolmamalı.

---

# 17. HISTORICAL ANCHOR GRAPH

1326 şehirleri, kaleleri, merkezleri ve coğrafi düğümler Historical Anchor Graph'te tutulur (ör. Bursa, Nicaea, Nicomedia, Kütahya, Ankara, Konya, Larende, Sivas, Erzurum, Erzincan, Malatya, Maraş, Elbistan, Sis, Aleppo, Antioch). **Politik anchor ≠ geographic constraint** — ayrı veri türleri.

---

# 18. POLITICAL GEOMETRY

Kör Voronoi yok. Voronoi/weighted power partition yalnızca candidate generation için. Final geometry:

```text
Historical Evidence → Anchor Graph → Physical Constraints → Historical Constraints → Candidate Surface → Review/Validation → Canonical Political Geometry
```

---

# 19. FUZZY / UNCERTAIN BORDERS

1326 sınırları her zaman kesin çizgi değil: hard boundary yanında frontier/influence zone. Veri modeli confirmed core / frontier / influence / uncertain extent desteklemeli. Runtime polygon gösterebilir ama confidence kaybolmamalı.

---

# 20. PROVINCE SİSTEMİ

Uzun vadeli hedef **15.000+ aktif province**. Province: identity, geometry, topology, owner, controller, population, terrain, resources, buildings, production, trade, culture, religion, historical metadata. Ağır class instance yok — typed arrays, packed state, sparse structures, ECS-benzeri düzenler, SoA değerlendirilmeli.

---

# 21. TOPOLOGY

Adjacency, shared edges, coast edges, river crossings, lake boundaries, mountain barriers, movement cost. **Geometry ≠ Topology** ayrımı mimarinin her yerinde korunmalı.

---

# 22. MAP RENDERING

**WebGPU-first**, WebGL2 fallback desteklenebilir. Hedef **144+ FPS** — ama "her şeyi GPU'ya yükle" şeklinde değil:

```text
CPU simulation → visible state extraction → GPU buffers → GPU culling → instanced rendering → LOD
```

---

# 23. 15.000+ PROVINCE PERFORMANS MİMARİSİ

GPU instancing, frustum/screen-space culling, LOD, geometry/terrain streaming, binary map assets, typed arrays, worker threads, OffscreenCanvas, incremental/dirty-region updates, batched state updates, düşük kopyalı veri akışı, object pooling, explicit lifecycle.

---

# 24. MEMORY LEAK ÖNLEME

Her sistem lifecycle sahibi: create/initialize/attach/update/detach/dispose. Listener, worker, WebGPU resource, buffer, texture, timer, subscription — hepsi dispose edilebilir olmalı. Özellikle map renderer, terrain, camera, workers, simulation subscriptions, GPU buffers, texture caches, city/army instanceları için lifecycle testleri.

---

# 25. CAMERA

Zoom, pan, pitch, yaw, world wrapping, smooth transition, LOD transition, map-to-city/army transition. World wrap varsa **canonical longitude ≠ render longitude**. Camera state deterministic olmalı.

---

# 26. ŞEHİR GÖRSEL SİSTEMİ

CityData → CityVisualProxy → LOD → 3D representation. village/town/city/large city/capital/metropolis seviyeleri; görsel büyüme ekonomik simülasyondan bağımsız olmamalı.

---

# 27–39. EKONOMİ

`gold += income` yok — gerçek arz-talep: Resources → Production → Processing → Goods → Demand → Trade → Price → Income → Wealth → Development. Kaynaklar coğrafyaya bağlı (her yerde demir/kömür/verimli tarım yok). İşlenmiş mallar ve üretim zincirleri (Iron Ore → Iron → Tools/Weapons/Armor; Cotton → Textile → Clothing). Binalar (tarım/sanayi/toplum listeleri briefte) teknoloji + development + para + süre + işgücü + kaynak gerektirir. Development Score süreçlerin sonucu olur, oyuncu direkt artıramaz. Toplum sınıfları (köle/köylü/esnaf/soylu) modüler; sosyal hareketlilik yavaş. Private economy (esnaf/soylu işletmeleri) devlet tekelinde değil. Local/regional/world arz-talep + global weighted average fiyat; ticaret kapasitesi yetersizse ihtiyaç karşılanamayabilir. Trade: Province → Local Market → Trade Hub (Bursa, İstanbul, İskenderiye, Halep) → Route → Regional/Global. Kapasite: liman, kervansaray, yol, development, kurumlar, politika, güvenlik, donanma, diplomasi; savaş/isyan düşürür. Savaş ekonomiye gerçek zincirleme etki yapar (yol → ticaret → kıtlık → üretim → fiyat → huzursuzluk → vergi).

---

# 40–43. TEKNOLOJİ

Dört disiplin: Toplum & Hukuk / Üretim & Ekonomi / Askeri & Kara / Denizcilik & Ticaret. Teknolojiler bina/üretim/kurum/birim/kapasite/yönetim açar (Çağ I–III örnek listeleri briefte; isimler tarihsel araştırma ile doğrulanmalı). **TP** (medrese/okul/alim/eğitim/development kaynaklı) + **İG** + **TE** soyut kaynakları — ama arkasında gerçek üretim mekanizması olmalı, sınırsız mana hissi yok.

---

# 44–51. DEVLET / DİPLOMASİ / SAVAŞ / DİN / KÜLTÜR / KARAKTER / CASUSLUK

Yasalar, reformlar, kurumlar, merkeziyetçilik, vergi, idari kapasite, yolsuzluk, bürokrasi. Diplomasi araçları (savaş/barış/ittifak/ticaret/evlilik/tehdit/vassallık/garanti/elçilik/casusluk) AI devletlerce de kullanılır. Savaş: Army + Manpower + Equipment + Supply + Terrain + Leadership + Technology + Morale + Logistics + Weather — `armyPower > enemyPower` yok. Ordu: manpower/equipment/commander/composition/morale/supply/movement/experience; birimler teknolojiyle açılır. Din (mezhep/kurum/tolerans/dönüşüm/isyan) ve kültür (dil/gelenek/göç/şehirleşme) anlık değişmez. Karakterler (hükümdar/varis/eş/çocuk/general/vali/alim/tüccar/diplomat): özellik/yetenek/ilişki/sadakat/kariyer. Casusluk zardan derin olmalı.

---

# 52–54. AI / SCALE / TICK

Tek global AI yok — her devletin stratejik/ekonomik/askeri/diplomatik hedefleri, risk toleransı, karakteri var; yüzlerce devleti yönetebilmeli. Hedef: yüzlerce devlet + 15.000+ province + büyük nüfus + binlerce şehir + çok karakter, yine de 144+ FPS — simulation ve rendering tamamen ayrı. Zaman seçenekleri: 1 hafta / 1 ay / 6 ay / 1 yıl / tarihe atla. **Simulation state ≠ render frame**; 144 FPS rendering simulation'ı 144 kez çalıştırmaz.

---

# 55–56. EVENT SYSTEM

Sürekli event (historical/systemic/emergent); oyuncu karar verir. Event gerçek sistemlere bağlanır (ör. Bursa trade boom → hacim → tüccar serveti → vergi → development → nüfus).

---

# 57–61. UI

Modern, temiz, progressive disclosure. Harita katmanları (Political/Terrain/Population/Economy/Resources/Trade/Religion/Culture/Infrastructure/Military/Diplomacy) açılır-kapanır. City paneli ve province paneli içerikleri briefte. Temel döngü: Observe → Understand → Decide → Act → Time advances → World reacts → Decide again.

---

# 62–68. TEKNİK MİMARİ

Üst mimari: Application / Scenario / HGE / World Model / Simulation (10 alt sistem) / AI / Map Data / Terrain / Rendering (WebGPU + WebGL2 fallback + 4 renderer) / Camera / UI / Save-Load / Diagnostics. Data pipeline: Historical Sources → Evidence → Normalized → Validated → Canonical → Runtime Assets → GPU Assets (source JSON doğrudan runtime'a yüklenmez). Büyük map verileri binary + typed arrays + chunking + streaming. Ağır işler worker'larda (GIS/terrain/pathfinding-preprocessing, AI batch, economy aggregation, asset loading). Pathfinding province topology üzerinden; 15k için naive all-pairs yok. Save: versioned, deterministic, recoverable (scenario + tüm stateler + time + seed). Determinism: initial state + seed + commands = aynı sonuç (replay/debug/AI test/save-load için).

---

# 69–72. TEST

Her sistem: unit + integration + contract + regression + performance + determinism. Grafik regression (camera/terrain/coastline/topology/GPU buffers/LOD/city/army). Benchmark: 1k/5k/10k/15k/20k province — CPU/GPU frame time, memory/VRAM, draw calls, buffer/texture, tick süresi. Memory: load/play/zoom/pan/layer/select/time/save/load döngüsü, baseline → peak → post-cycle karşılaştırma; leak kabul edilmez.

---

# 73–74. TARİHSEL DOĞRULUK

Uydurma kesinlik yok — güvenilir değilse `confidence = LOW`, provenance korunur. Akademik yayınlar, açık coğrafi veri, tarihsel atlaslar, güvenilir kurumlar, açık lisanslı veri. Open Historia referans, kod kopyalanmaz, lisans kontrolü.

---

# 75–77. ÜÇ İLKE

1. "Önce basit harita, sonra gerçek harita" yok — ilk veri modelinden itibaren physical authority + historical authority + political candidate + canonical geometry ayrımı.
2. "15k'yi sonra optimize ederiz" yok — 15.000+ ilk mimariden tasarım kısıtı.
3. Simulation ↔ rendering bağlı değil: Simulation → State → Render Snapshot → GPU; renderer simulation state'i mutate etmez.

---

# 78. GELİŞTİRME SIRASI

PHASE 0 Architecture/tooling → 1 Scenario+World State → 2 HGE → 3 1326 Political Geography → 4 Terrain+Coastline+Sea → 5 GPU Map Renderer → 6 Province/State/City → 7 Population+Economy → 8 Tech+Buildings → 9 Trade → 10 Diplomacy+War → 11 Characters+Dynasty → 12 Religion+Culture+Society → 13 AI → 14 Events → 15 Save/Load → 16 Performance/15K+ → 17 1326 Playable Alpha → 18 Production Release.

---

# 79. İLK HEDEF: 1326 PLAYABLE BUILD

19 maddelik oynanabilirlik listesi (açılış → 1326 başlangıcı → Osmanlı seçimi → dünya/province/şehir/ordu görüntüleme → zaman ilerletme → ekonomi/teknoloji/bina/ticaret/diplomasi/savaş → nüfus değişimi → AI hareketleri → event → save/load). Bu bitmeden 1453 veya başka scenario yok.

---

# 80–83. KURALLAR

Her sistem öncesi WHY/WHAT/DATA MODEL/DEPENDENCIES/PERFORMANCE/LIFECYCLE/TEST. Prototip için production mimarisi bozulmaz (global mutable state, leak'li listener, frame-başı allocation, devasa JSON parse, main-thread heavy iş, GPU leak yasak). Legacy varsa: Forensic → Useful Behavior → New Architecture; kör kopya yok. Her büyük aşama sonrası rapor (phase/completed/in-progress/blocked/next/risks/performance/tests).

---

# 84. ANA HEDEF

**1326'da başlayan, tarihsel olarak anlamlı, görsel olarak yüksek kaliteli, ekonomik-toplumsal olarak derin, gerçek zamanlı grand-strategy sandbox.** Pax Historia fikrinin gelişmiş, kendi kimlikli yorumu. Görsel: EU5 hissi + CK3 şehir/karakter + Victoria 3 ekonomi yoğunluğu + CoH kimliği. Teknik: 15.000+ province + dinamik dünya + kaliteli map + 144+ FPS.

---

# 85. İLK GÖREV

Kod öncesi: (A) mimari tasarım, (B) repo/folder structure, (C) data contracts, (D) 1326 scenario schema, (E) HGE schema, (F) physical geography schema, (G) political geography schema, (H) province schema, (I) city schema, (J) population/economy schema, (K) technology/building schema, (L) trade schema, (M) military schema, (N) character/dynasty schema, (O) AI architecture, (P) rendering architecture, (Q) WebGPU architecture, (R) performance budget, (S) memory lifecycle, (T) test architecture. Sonra 1326'nın ilk oynanabilir vertical slice'ı.

---

# 86. VERTICAL SLICE

7 April 1326 → world loads → Anatolia renders → Bursa visible → minimal 3D city → Ottoman army → province selection → city panel → population → production → trade → time advances → AI reacts → event appears. Slice, geri kalan mimarinin temelidir.

---

# 87. SON KURAL

"Çalışıyor" = DATA → SYSTEM → RUNTIME → UI → RENDERING → TEST → PERFORMANCE → MEMORY zincirinin tamamı doğrulanmış. Bir halka eksikse tamamlanmış sayılmaz.
