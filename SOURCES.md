## 1) URLs to scrape

### Official Israeli / security / alerting

* `https://alerts-history.oref.org.il/12481-he/Pakar.aspx` — official Home Front Command alert history page. Good fallback if JSON changes. ([alerts-history.oref.org.il][2])
* `https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he` — official districts JSON used by the alert history site. ([alerts-history.oref.org.il][3])
* `https://www.oref.org.il/WarningMessages/alert/alerts.json` — current alert JSON endpoint used by open-source relays; send `Referer: https://www.oref.org.il/` and `X-Requested-With: XMLHttpRequest`. ([GitHub][1])
* `https://www.oref.org.il/WarningMessages/alert/History/AlertsHistory.json` — alert history JSON endpoint used by open-source relays. ([GitHub][1])
* `https://www.idf.il/en/idf-media-releases/?page=1` — IDF media releases. ([IDF][4])
* `https://www.idf.il/en/mini-sites/idf-press-releases-israel-at-war/` — IDF war press-release hub. ([IDF][5])
* `https://www.idf.il/en/mini-sites/israel-at-war/real-time-updates/` — IDF real-time updates for the Hamas/Gaza war. ([IDF][6])
* `https://www.idf.il/en/mini-sites/iran-israel-war-2026/iran-israel-war-2026-live-updates/` — IDF Iran/Israel live-updates hub. ([IDF][7])
* `https://www.shabak.gov.il/en/terror/` — ISA/Shabak terrorism portal. Useful for West Bank/internal terror monitoring. ([Shabak][8])
* `https://www.shabak.gov.il/en/reports/` — ISA/Shabak reports index, including monthly reports. ([Shabak][9])
* `https://www.gov.il/en/pages/rss-gov` — gov.il RSS discovery page. Good for finding other official ministries/units that expose feeds. ([Government of Israel][10])
* `https://gaza-aid-data.gov.il/mainhome` — official Israeli/COGAT humanitarian data site for Gaza. ([COGAT][11])
* `https://gaza-aid-data.gov.il/mainhome/see-more/` — weekly reports and document archive behind that Gaza aid site. ([COGAT][12])

### Official public Telegram pages that are scrapeable as plain HTML

* `https://t.me/s/PikudHaOref_all` — official Home Front Command alert channel mirror page. ([Telegram][13])
* `https://t.me/s/HanhayotPikudHaOref` — official Home Front Command instructions channel mirror page. ([Telegram][14])
* `https://t.me/s/idfofficial` — official IDF Telegram mirror page. ([Telegram][15])

### Palestinian / humanitarian / West Bank / Gaza context

* `https://www.ochaopt.org/updates` — OCHA oPt updates. Very useful for Gaza + West Bank incident cadence. ([OCHA OPT][16])
* `https://www.ochaopt.org/publications/situation-reports` — OCHA oPt situation reports index. ([OCHA OPT][17])
* `https://www.ochaopt.org/publications` — OCHA publications index; includes West Bank monthly snapshots and Gaza reports. ([OCHA OPT][18])
* `https://english.wafa.ps/` — WAFA English home page. ([WAFA Agency][19])
* `https://english.wafa.ps/Pages/LastNews` — WAFA “last news” stream. ([WAFA Agency][20])
* `https://english.wafa.ps/Regions/Details/2` — WAFA occupation section, useful for raids/arrests/settler violence/West Bank incidents. ([WAFA Agency][21])
* `https://www.maannews.net/` — Ma’an main page. ([Maan News][22])
* `https://www.maannews.net/news/latest` — Ma’an latest news. ([Maan News][23])
* `https://www.maannews.net/gaza` — Ma’an Gaza section. ([Maan News][24])
* `https://www.maannews.net/ticker-news` — Ma’an ticker/newswire page. ([Maan News][25])

### OSINT / research / Iran / geolocated incident maps

* `https://israelpalestine.liveuamap.com/` — geolocated conflict map for Israel/Palestine. Good as an enrichment layer, not as sole truth source. ([israelpalestine.liveuamap.com][26])
* `https://www.inss.org.il/publication/iran-assets-map/` — INSS real-time Iran strike/asset map; explicitly says it is updated from OSINT and media reports. ([INSS][27])
* `https://www.inss.org.il/publication/lions-roar-data/` — INSS Iran campaign dashboard. ([INSS][28])
* `https://www.inss.org.il/publication/iran-real-time/` — INSS “Operation Rising Lion” dashboard. ([INSS][29])
* `https://www.inss.org.il/dasboard-2-years/` — INSS multi-front war dashboard covering Gaza, Iran, Lebanon, Syria, Judea/Samaria, Yemen. ([INSS][30])
* `https://www.criticalthreats.org/analysis/ctp-iran-updates` — CTP/ISW Iran updates hub. ([Critical Threats][31])
* `https://www.criticalthreats.org/locations/iran` — CTP Iran story stream/archive. ([Critical Threats][32])
* `https://www.iaea.org/topics/iran` — IAEA Iran topic page. ([IAEA][33])
* `https://www.iaea.org/newscenter/focus/iran/chronology-of-key-events` — IAEA chronology page for Iran. ([IAEA][34])
* `https://www.iaea.org/newscenter/focus/iran/reports` — IAEA Iran reports page. ([IAEA][35])
* `https://en.radiofarda.com/rssfeeds` — Radio Farda RSS hub for Iran. ([RadioFreeEurope/RadioLiberty][36])

### Aviation / movement tracking

* `https://www.flightradar24.com/` — good watch-only website, but its official API is commercial. ([fr24api.flightradar24.com][37])
* `https://www.flightaware.com/live/` — good watch-only website, but AeroAPI / Firehose are commercial. ([FlightAware][38])
* `https://opensky-network.org/data/api` — OpenSky API docs / data portal. ([OpenSky Network][39])
* `https://api.adsb.lol/docs` — free API docs for ADSB.lol. ([api.adsb.lol][40])

## 2) RSS feeds to scrape

### Israeli / regional news

* `https://www.timesofisrael.com/feed/` — Times of Israel main feed. ([The Times of Israel][41])
* `https://rss.jpost.com/rss/rssfeedsheadlines.aspx` — Jerusalem Post breaking headlines. ([rss.jpost.com][42])
* `https://rss.jpost.com/rss/rssfeedsisraelnews.aspx` — Jerusalem Post Israel news. ([rss.jpost.com][43])
* `https://rss.jpost.com/rss/rssfeedsgaza.aspx` — Jerusalem Post Gaza feed. ([rss.jpost.com][44])
* `https://rss.jpost.com/rss/rssfeedsmiddleeastnews.aspx` — Jerusalem Post Middle East feed. ([rss.jpost.com][45])
* `https://rss.jpost.com/rss/rssfeedsarabisraeliconflict.aspx` — Jerusalem Post Arab-Israeli conflict feed. ([rss.jpost.com][46])
* `https://rss.jpost.com/rss/israel-hamas-war` — Jerusalem Post Israel-Hamas war feed. ([rss.jpost.com][47])
* `https://www.israelnationalnews.com/Rss.aspx` — Israel National News / Arutz Sheva general feed. ([Israel National News][48])
* `https://www.israelnationalnews.com/Rss.aspx?act=.1&cat=25` — Israel National News category feed for security/defense-type coverage. ([Israel National News][49])
* `https://www.ynet.co.il/Integration/StoryRss3254.xml` — Ynet breaking news. 
* `https://www.ynet.co.il/Integration/StoryRss3082.xml` — Ynet all news. 

Ynet’s RSS page says the feeds are free RSS 2.0 feeds, but also states personal/non-commercial-style restrictions and attribution rules, so check terms before redistributing at scale. ([ynetglobal][50])

### International / regional

* `https://feeds.bbci.co.uk/news/world/middle_east/rss.xml` — BBC Middle East feed. ([BBC Feeds][51])
* `https://www.aljazeera.com/xml/rss/all.xml?region=middle-east` — Al Jazeera Middle East-region RSS. ([Al Jazeera][52])
* `https://www.aljazeera.com/xml/rss/all.xml` — Al Jazeera global feed. ([Al Jazeera][53])

### Iran / official / military

* `https://en.radiofarda.com/rssfeeds` — Radio Farda RSS hub; the page exposes topic-specific subscribe links for Iran News / Iran In-Depth / Analysis / Spotlight on Iran. ([RadioFreeEurope/RadioLiberty][36])
* `https://www.iaea.org/feeds` — IAEA RSS feed directory. ([IAEA][54])
* `https://www.centcom.mil/RSS/` — CENTCOM RSS directory. ([Central Command][55])
* `https://www.dvidshub.net/rss/unit/72/?mkt=en-us` — DVIDS RSS for U.S. Central Command Public Affairs. ([DVIDS][56])
* `https://www.dvidshub.net/rss/unit/70/?hl=en-US` — DVIDS RSS for U.S. Army Europe and Africa. ([DVIDS][57])
* `https://www.nato.int/cps/en/natolive/RSS.htm` — NATO RSS directory. ([NATO][58])
* `https://www.act.nato.int/article-rss-xml/` — NATO ACT article RSS. ([NATO ACT][59])

### Public alert-system reference feeds

* `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-israel` — MeteoAlarm Atom feed for Israel. The feed list page says legacy RSS feeds were sunset on 2026-01-14 and Atom is the maintained format. ([feeds.meteoalarm.org][60])
* `https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-rss-europe` — still exposed on the feeds page, but the service says legacy RSS is deprecated; prefer Atom. ([feeds.meteoalarm.org][60])
* `https://api.weather.gov/alerts/active.atom` — NWS active alerts Atom feed pattern; NWS says alerts are available through the API in GeoJSON, JSON-LD, Atom, and CAP XML. ([National Weather Service][61])

## 3) APIs and systems that can push information into your system

### Best fit for your dashboard

* **Pikud Oref via open-source webhook relay**: `yosef-770/oref-alerts-webhook` polls the official public Home Front Command alert history API and sends structured webhooks. It explicitly notes the Israeli-IP requirement. ([GitHub][62])
* **Pikud Oref via local proxy**: `danielrosehill/Oref-Alert-Proxy` exposes local relay endpoints like `/api/alerts`, `/api/history`, `/api/status`; the repo notes there is no official public developer API and that the upstream is geo-restricted. ([GitHub][63])
* **Another Oref proxy microservice**: `dmatik/oref-alerts-proxy-ms` exposes `/current` and `/history`. ([GitHub][64])
* **Home Assistant event source**: `amitfin/oref_alert` normalizes multiple alert channels and emits events you can bridge into Kafka/NATS/webhooks. ([GitHub][65])

### Public alert-system models you can mirror architecturally

* **FEMA IPAWS All-Hazards Information Feed** — public CAP feed for official safety messages; FEMA describes it as a simple HTTP interface for internet-connected devices/services. ([FEMA][66])
* **NWS Alerts API** — machine-friendly alerts in GeoJSON / JSON-LD / Atom / CAP XML. ([National Weather Service][67])
* **MeteoAlarm feeds** — public Atom feeds; useful as a European CAP-style model. ([feeds.meteoalarm.org][60])

### Aviation / movement

* **ADSB.lol API** — free, open-source API returning JSON; docs say “available to everyone,” and the project publishes its infra/code openly on GitHub. ([adsb.lol][68])
* **OpenSky REST API** — live aircraft state vectors / flights / tracks; official docs say it is for research and non-commercial use. ([Open Sky Network][69])

## 4) APIs you can sample for war / security information about Israel

These are the ones I would actually put behind a collector first:

* **Pikud Oref current alerts JSON**
  `https://www.oref.org.il/WarningMessages/alert/alerts.json`
  Use with the browser-like headers above; practical route is often to run an Israel-based proxy because the upstream is geo-restricted to Israeli IPs. ([GitHub][1])

* **Pikud Oref history JSON**
  `https://www.oref.org.il/WarningMessages/alert/History/AlertsHistory.json` ([GitHub][1])

* **Pikud Oref districts JSON**
  `https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he` ([alerts-history.oref.org.il][3])

* **OpenSky REST API**
  Root: `https://opensky-network.org/api`
  Docs: `https://openskynetwork.github.io/opensky-api/rest.html` ([Open Sky Network][70])

* **ADSB.lol API**
  Root: `https://api.adsb.lol`
  Docs: `https://api.adsb.lol/docs`
  OpenAPI: `https://api.adsb.lol/api/openapi.json` ([adsb.lol][68])

* **GDELT DOC/GEO APIs**
  Docs/examples: `https://api.gdeltproject.org/api/v2/summary/summary`, `https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/`, `https://blog.gdeltproject.org/gdelt-geo-2-0-api-debuts/`
  Good for machine-sampling open news coverage about Israel/Iran/Gaza/Lebanon/West Bank without scraping every outlet individually. ([GDELT API][71])

* **NWS Alerts API**
  Root: `https://api.weather.gov`
  Alerts: `https://api.weather.gov/alerts` / `https://api.weather.gov/alerts/active`
  Good as a model for CAP-style alert ingestion and machine parsing. ([National Weather Service][72])

* **FEMA IPAWS All-Hazards feed**
  Docs page: `https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers/all-hazards-information-feed`
  Good reference design for public CAP ingestion. ([FEMA][66])

## 5) Other suggestions to add to your system

### Best source stack for your exact use case

I would combine:

* **official alerts**: Oref JSON + HFC Telegram HTML mirror,
* **official Israeli ops/statements**: IDF + Shabak + COGAT,
* **Palestinian / humanitarian context**: OCHA oPt + WAFA + Ma’an,
* **Iran OSINT**: INSS + CTP/ISW + IAEA + Radio Farda,
* **air picture**: OpenSky + ADSB.lol,
* **media layer**: JPost + TOI + Arutz 7 + Ynet + BBC + Al Jazeera. ([GitHub][1])

### Practical schema

Normalize everything into one event format:
`source`, `source_type` (`official_alert`, `official_statement`, `news`, `osint`, `aviation`), `published_at`, `headline`, `body`, `lang`, `area_name`, `lat`, `lon`, `severity`, `confidence`, `raw_url`, `tags[]`.

That lets you build:

* a red-alert timeline,
* a geospatial map,
* a “claims vs confirmations” panel,
* a per-front board: `iran`, `gaza`, `lebanon`, `west_bank`, `internal`.

### Corroboration rule

For anything operationally important, do not fire your “critical” tile off a single media source. Require either:

* one **official** source, or
* two independent sources from different categories, such as **news + OSINT**, or **humanitarian + official**.

### Oref caveat

The biggest technical caveat is Oref: the practical endpoints exist, but the commonly used route is still an **unofficially documented website JSON** plus an **Israel-based proxy/relay**, because the upstream is geo-restricted and there is no stable official developer API. ([GitHub][63])

### Good open-source building blocks

* `danielrosehill/Oref-Alert-Proxy` — relay/proxy for Oref. ([GitHub][73])
* `yosef-770/oref-alerts-webhook` — push/webhook relay. ([GitHub][62])
* `dmatik/oref-alerts-proxy-ms` — lightweight proxy microservice. ([GitHub][64])
* `barlevalon/mklat.news` — open-source real-time news + alert aggregation idea. ([GitHub][74])
* `danielrosehill/Red-Alert-Geodash` — a dashboard concept close to your screenshot. ([GitHub][75])
* `readsb` + `tar1090` + `dump1090-fa` — self-hosted ADS-B stack if you want your own local aviation layer instead of relying only on public trackers. ([GitHub][76])

## Useful but **not** suitable under your strict “free + no-login” rule

* **Flightradar24 API** — commercial paid tiers. The website is still useful for manual monitoring. ([fr24api.flightradar24.com][37])
* **FlightAware AeroAPI / Firehose** — commercial. The website is still useful for manual monitoring. ([FlightAware][38])
* **DVIDS JSON API** — useful, but docs indicate an API account/key is required. For your rules, prefer DVIDS RSS instead. ([api.dvidshub.net][77])
* **LiveUAMap API** — official API pricing page shows paid access; the public site is still scrapeable. ([Liveuamap][78])
* **MeteoAlarm EDR/MQTT API** — current docs show token-based access; public Atom feeds are the no-login option. ([MeteoAlarm API][79])
* **ReliefWeb API** — still public, but current docs say a pre-approved `appname` is required from 1 Nov 2025 onward. ([Reliefweb API Documentation][80])
* **NASA FIRMS API** — useful for fire/impact detection, but current docs are key-based (`map_key`). ([NASA FIRMS][81])

If you want, I can turn this into a cleaner **implementation blueprint** next: a recommended ingest pipeline, update intervals, dedupe rules, and a first-pass source priority order.

[1]: https://github.com/danielrosehill/Oref-Alert-Proxy/blob/main/server.py "https://github.com/danielrosehill/Oref-Alert-Proxy/blob/main/server.py"
[2]: https://alerts-history.oref.org.il/12481-he/Pakar.aspx?utm_source=chatgpt.com "פיקוד העורף | התרעות פיקוד העורף"
[3]: https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he "https://alerts-history.oref.org.il/Shared/Ajax/GetDistricts.aspx?lang=he"
[4]: https://www.idf.il/en/idf-media-releases/?page=1 "https://www.idf.il/en/idf-media-releases/?page=1"
[5]: https://www.idf.il/en/mini-sites/idf-press-releases-israel-at-war/?utm_source=chatgpt.com "IDF Press Releases: Israel at War"
[6]: https://www.idf.il/en/mini-sites/israel-at-war/real-time-updates/?utm_source=chatgpt.com "Hamas - Israel War Hamas - Israel War: Real-time Official IDF Updates"
[7]: https://www.idf.il/en/mini-sites/iran-israel-war-2026/iran-israel-war-2026-live-updates/?utm_source=chatgpt.com "Live Updates: Iran-Israel War 2026 | IDF"
[8]: https://www.shabak.gov.il/en/terror/ "https://www.shabak.gov.il/en/terror/"
[9]: https://shabak.gov.il/en/reports/ "https://shabak.gov.il/en/reports/"
[10]: https://www.gov.il/en/pages/rss-gov "https://www.gov.il/en/pages/rss-gov"
[11]: https://gaza-aid-data.gov.il/mainhome?utm_source=chatgpt.com "Israel Humanitarian efforts - Swords of Iron - COGAT"
[12]: https://gaza-aid-data.gov.il/mainhome/see-more/?utm_source=chatgpt.com "Relevant documents - gaza-aid-data.gov.il"
[13]: https://t.me/s/PikudHaOref_all "https://t.me/s/PikudHaOref_all"
[14]: https://t.me/s/HanhayotPikudHaOref?before=1113 "https://t.me/s/HanhayotPikudHaOref?before=1113"
[15]: https://t.me/s/idfofficial "https://t.me/s/idfofficial"
[16]: https://www.ochaopt.org/updates?utm_source=chatgpt.com "Updates - United Nations Office for the Coordination of Humanitarian ..."
[17]: https://www.ochaopt.org/publications/situation-reports?utm_source=chatgpt.com "Publications | United Nations Office for the Coordination of ..."
[18]: https://www.ochaopt.org/publications?utm_source=chatgpt.com "Publications | United Nations Office for the Coordination of ..."
[19]: https://english.wafa.ps/ "https://english.wafa.ps/"
[20]: https://english.wafa.ps/Pages/LastNews "https://english.wafa.ps/Pages/LastNews"
[21]: https://english.wafa.ps/Regions/Details/2 "https://english.wafa.ps/Regions/Details/2"
[22]: https://www.maannews.net/?utm_source=chatgpt.com "وكـالـة مـعـا الاخـبـارية"
[23]: https://www.maannews.net/news/latest?utm_source=chatgpt.com "أخــبـــــار"
[24]: https://www.maannews.net/gaza?utm_source=chatgpt.com "غزة - وكـالـة مـعـا الاخـبـارية"
[25]: https://www.maannews.net/ticker-news?utm_source=chatgpt.com "آخر الأخبار"
[26]: https://israelpalestine.liveuamap.com/ "https://israelpalestine.liveuamap.com/"
[27]: https://www.inss.org.il/publication/iran-assets-map/?utm_source=chatgpt.com "War with Iran – Real-Time Update Map | The INSS"
[28]: https://www.inss.org.il/publication/lions-roar-data/?utm_source=chatgpt.com "Dashboard: The Military Campaign Against Iran | INSS"
[29]: https://www.inss.org.il/publication/iran-real-time/?utm_source=chatgpt.com "Dashboard: Operation Rising Lion | INSS"
[30]: https://www.inss.org.il/dasboard-2-years/?utm_source=chatgpt.com "Dashboard | INSS"
[31]: https://www.criticalthreats.org/analysis/ctp-iran-updates?utm_source=chatgpt.com "Iran Updates | Critical Threats"
[32]: https://www.criticalthreats.org/locations/iran?utm_source=chatgpt.com "Iran | Story Stream | Critical Threats"
[33]: https://www.iaea.org/topics/monitoring-and-verification-in-iran "https://www.iaea.org/topics/monitoring-and-verification-in-iran"
[34]: https://www.iaea.org/newscenter/focus/iran/chronology-of-key-events "https://www.iaea.org/newscenter/focus/iran/chronology-of-key-events"
[35]: https://www.iaea.org/newscenter/focus/iran/iaea-and-iran-iaea-board-reports "https://www.iaea.org/newscenter/focus/iran/iaea-and-iran-iaea-board-reports"
[36]: https://en.radiofarda.com/rssfeeds "https://en.radiofarda.com/rssfeeds"
[37]: https://fr24api.flightradar24.com/subscriptions-and-credits "https://fr24api.flightradar24.com/subscriptions-and-credits"
[38]: https://www.flightaware.com/commercial/aeroapi/ "https://www.flightaware.com/commercial/aeroapi/"
[39]: https://opensky-network.org/data/api?utm_source=chatgpt.com "OpenSky API"
[40]: https://api.adsb.lol/docs?utm_source=chatgpt.com "adsb.lol API"
[41]: https://www.timesofisrael.com/feed/?utm_source=chatgpt.com "The Times of Israel"
[42]: https://rss.jpost.com/rss/rssfeedsheadlines.aspx "https://rss.jpost.com/rss/rssfeedsheadlines.aspx"
[43]: https://rss.jpost.com/rss/rssfeedsisraelnews.aspx "https://rss.jpost.com/rss/rssfeedsisraelnews.aspx"
[44]: https://rss.jpost.com/rss/rssfeedsgaza.aspx "https://rss.jpost.com/rss/rssfeedsgaza.aspx"
[45]: https://rss.jpost.com/rss/rssfeedsmiddleeastnews.aspx "https://rss.jpost.com/rss/rssfeedsmiddleeastnews.aspx"
[46]: https://rss.jpost.com/rss/rssfeedsarabisraeliconflict.aspx "https://rss.jpost.com/rss/rssfeedsarabisraeliconflict.aspx"
[47]: https://rss.jpost.com/rss/israel-hamas-war "https://rss.jpost.com/rss/israel-hamas-war"
[48]: https://www.israelnationalnews.com/Rss.aspx "https://www.israelnationalnews.com/Rss.aspx"
[49]: https://www.israelnationalnews.com/Rss.aspx?act=.1&cat=25 "https://www.israelnationalnews.com/Rss.aspx?act=.1&cat=25"
[50]: https://www.ynetnews.com/articles/0%2C7340%2CL-3124381%2C00.html "https://www.ynetnews.com/articles/0%2C7340%2CL-3124381%2C00.html"
[51]: https://feeds.bbci.co.uk/news/world/middle_east/rss.xml "https://feeds.bbci.co.uk/news/world/middle_east/rss.xml"
[52]: https://www.aljazeera.com/xml/rss/all.xml?region=middle-east&utm_source=chatgpt.com "Al Jazeera – Breaking News, World News and Video from Al Jazeera"
[53]: https://www.aljazeera.com/xml/rss/all.xml?utm_source=chatgpt.com "Al Jazeera – Breaking News, World News and Video from Al Jazeera"
[54]: https://www.iaea.org/feeds "https://www.iaea.org/feeds"
[55]: https://www.centcom.mil/RSS/ "https://www.centcom.mil/RSS/"
[56]: https://www.dvidshub.net/rss/unit/72/?mkt=en-us&utm_source=chatgpt.com "DVIDS Unit RSS Feed: U.S. Central Command Public Affairs"
[57]: https://www.dvidshub.net/rss/unit/70/?hl=en-US&utm_source=chatgpt.com "DVIDS Unit RSS Feed: U.S. Army Europe and Africa"
[58]: https://www.nato.int/cps/en/SID-48F7A319-A0886E1E/natolive/RSS.htm "https://www.nato.int/cps/en/SID-48F7A319-A0886E1E/natolive/RSS.htm"
[59]: https://www.act.nato.int/article-rss-xml/ "https://www.act.nato.int/article-rss-xml/"
[60]: https://feeds.meteoalarm.org/ "Feeds | MeteoAlarm Feeds"
[61]: https://www.weather.gov/media/notification/pdf_2025/scn25-73_alerts_webpage_termination.pdf?utm_source=chatgpt.com "NOUS41 KWBC 181650 PNSWSH - National Weather Service"
[62]: https://github.com/yosef-770/oref-alerts-webhook "https://github.com/yosef-770/oref-alerts-webhook"
[63]: https://github.com/danielrosehill/Oref-Alert-Proxy/blob/main/README.md "https://github.com/danielrosehill/Oref-Alert-Proxy/blob/main/README.md"
[64]: https://github.com/dmatik/oref-alerts-proxy-ms/ "https://github.com/dmatik/oref-alerts-proxy-ms/"
[65]: https://github.com/amitfin/oref_alert "https://github.com/amitfin/oref_alert"
[66]: https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers/all-hazards-information-feed?utm_source=chatgpt.com "IPAWS All-Hazards Information Feed - FEMA.gov"
[67]: https://www.weather.gov/documentation/services-web-alerts?utm_source=chatgpt.com "Alerts Web Service - National Weather Service"
[68]: https://www.adsb.lol/docs/open-data/api/?utm_source=chatgpt.com "API ADSB.lol"
[69]: https://openskynetwork.github.io/opensky-api/?utm_source=chatgpt.com "The OpenSky Network API documentation - GitHub Pages"
[70]: https://openskynetwork.github.io/opensky-api/rest.html?utm_source=chatgpt.com "OpenSky REST API — The OpenSky Network API 1.4.0 documentation"
[71]: https://api.gdeltproject.org/api/v2/summary/summary?utm_source=chatgpt.com "GDELT Summary: Online News"
[72]: https://www.weather.gov/documentation/services-web-api?prevfmt=application%2Fcap%2Bxml&prevopt=id%3DNWS-IDP-PROD-KEEPALIVE-8823&utm_source=chatgpt.com "API Web Service - National Weather Service"
[73]: https://github.com/danielrosehill/Oref-Alert-Proxy "https://github.com/danielrosehill/Oref-Alert-Proxy"
[74]: https://github.com/barlevalon/mklat.news "https://github.com/barlevalon/mklat.news"
[75]: https://github.com/danielrosehill/Red-Alert-Geodash "https://github.com/danielrosehill/Red-Alert-Geodash"
[76]: https://github.com/wiedehopf/readsb?utm_source=chatgpt.com "GitHub - wiedehopf/readsb: ADS-B decoder swiss knife"
[77]: https://api.dvidshub.net/ "https://api.dvidshub.net/"
[78]: https://livemapdata.com/promo/api?utm_source=chatgpt.com "Liveuamap API - Discovery Explorer"
[79]: https://api.meteoalarm.org/edr/v1/collections/warnings?f=html&utm_source=chatgpt.com "MeteoAlarm API Portal | Early Warnings for Europe"
[80]: https://apidoc.reliefweb.int/?utm_source=chatgpt.com "Reliefweb API - Documentation"
[81]: https://firms.modaps.eosdis.nasa.gov/api/?utm_source=chatgpt.com "NASA | LANCE | FIRMS"

