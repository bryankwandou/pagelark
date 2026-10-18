# Pagelark strategy research

Date: 2026-10-11. Source IDs like [S2] point to `docs/sources.md`. Anything without a source is my judgment and is labelled as such.

## Summary

Pagelark is a free, no-account, ad-free document scanner that runs in the browser and as an Android APK. All processing, including OCR in 100+ languages, happens on the device, and an optional hash stamp on Solana devnet lets someone later check that an exported PDF is unchanged. The founder's reason is real: Adobe Scan's Indonesian store listing charges in Rupiah for OCR beyond 5 pages, Magic eraser and extract pages [S2], and people who cannot pay go to cracked APKs, which research shows are far likelier to be flagged as malicious [S15]. The problem is genuine and the product is useful, but it has no moat and no revenue. Google, Apple and several open-source apps already scan for free [S7][S8][S9][S13]. The strongest version is not "another scanner". It is the free scanner that works fully offline in Indonesian and English for paperwork (KTP, ijazah, surat, KKP forms), with a third-party verification page for the proof stamp, aimed at campuses and small offices. Raw idea: 34/100. After the changes below: 58/100, and only if three assumptions are tested.

## Roast

Weaknesses, in rough order of how likely each is to kill it.

1. The free alternatives are already good enough. Google Drive scans to searchable PDF [S7], Files by Google has a scanner [S8], Apple Notes and Files scan on iPhone [S9]. Most Indonesian students have an Android phone where Drive is a tap away. "Free scanner" is not a reason to switch.
2. Open source already covers the privacy angle. FairScan is GPLv3, processes locally, asks only for the camera permission, and is on F-Droid [S13]. OSS Document Scanner appears to be maintained [S14, search summary only]. "No account, no ads" is not unique.
3. Browser OCR is the weak point. tesseract.js on a low-end phone is slow and generally worse than native on-device models on blurry, skewed or handwritten pages. 100+ languages sounds good, but each language pack is a download, and accuracy on Indonesian phone photos of stamped, photocopied documents is untested. I have not measured it; it must be measured before any claim is made.
4. IndexedDB is not a safe archive. Browsers can evict site data under storage pressure, users clear data, and iOS Safari is aggressive about it (my knowledge, not sourced here). With no sync and no backup, someone's only copy of a scanned ijazah can vanish. A scanner that loses documents is worse than none.
5. Zero moat. The code is open source, the features are standard, anyone can fork it. No network effect, no data, no distribution.
6. "Free" with no revenue. No ads, no accounts, no server means no income and no way to pay for maintenance. Solo-maintained free apps stall; Open Note Scanner is listed as discontinued [S14].
7. The Web3 part reads as a gimmick to most users. A student does not know what a wallet is, and devnet is a test network that can be reset, so a devnet stamp is not durable evidence. Asking for a wallet to scan a form loses most people, and "crypto app" suspicion can taint the whole project.
8. Trust is slower to earn than features. Users hand over IDs and contracts. An unknown app with no company behind it is a harder sell than Google. The cracked-APK users the founder wants to reach are, by definition, not shopping carefully.
9. Distribution is unsolved. A PWA is not discoverable like a Play Store listing, and an APK from GitHub trains users to sideload, which is the habit behind the harm Pagelark wants to reduce. A Play Store listing is needed.
10. Legal exposure from imitating a competitor. Copying Adobe's or CamScanner's layout, icons or wording could draw complaints. Comparative price claims must match current store listings, and my sources disagree on exact tiers [S3][S10][S11][S12].
11. Name risk is unresolved. A web search found no "Pagelark" (see sources.md), but that is not trademark clearance and Indonesia's DJKI register was not checked.
12. Microsoft Lens is gone: removed from stores 9 Feb 2026, scanning stopped 9 March 2026 [S6]. That shows big vendors treat scanning as a feature, not a product. They will not defend this space, but they also will not build the free niche, and they can drop a tool at will.

Ways it dies: (a) nobody finds it, (b) first impression on a cheap phone is slow OCR, (c) a user loses documents to storage eviction and says so publicly, (d) the founder moves on and it rots, (e) the Web3 stamp is the only thing reviewers remember and they dismiss it.

Raw score: 34/100. A real problem and an honest premise (about 20 points), a working feature set (about 10), a little for open source and low cost, minus everything above. Distribution, retention and revenue are all near zero.

## How to make it strong

**Sharpest wedge.** Not "free scanner", but "scan Indonesian paperwork offline, private by default, and be able to show the copy is unchanged". Concretely:
- Presets for documents people actually scan: KTP/KK, ijazah and transkrip, surat pernyataan, KKP/magang forms, receipts, A4 and F4. Output small enough for upload portals that cap file size (actual portal limits not researched).
- Indonesian-first UI and OCR defaults (Indonesian plus English loaded first, other languages on demand).
- The "printable" filter that keeps blue stamps and ink signatures is a specific, demonstrable advantage for stamped Indonesian paperwork. Make it the headline demo.
- Position against modded APKs with accurate numbers and no scare language: the safe option costs nothing.

**Cut.** The "100+ languages" claim until accuracy is measured per language; the Groq AI summary from the first release (it contradicts "nothing leaves your device" and adds a consent flow to maintain); Word export if layout quality is poor (do TXT and searchable PDF well instead).

**Add.**
1. Full-library backup and export (zip), a visible warning about browser storage, a request for persistent storage (`navigator.storage.persist()`), and a quota display. Without this, weakness 4 stays.
2. A public verification page that needs no wallet: drop a PDF, see whether its hash is on chain, with signer address and time.
3. A benchmark in the repo: 50 real photos of Indonesian documents, per-language character accuracy, seconds per page on a low-end phone. Publish bad numbers too.
4. A Play Store listing, so users do not sideload.
5. Share-target integration so it works from WhatsApp flows (my judgment that this matters; not sourced).
6. Institution mode: campus logo, templates, and a stamp signer key held by the institution.

**Revised score: 58/100.** The wedge is real and narrow, running cost is near zero, and the institutional path gives a plausible way to be funded. It stays below 60 because the moat is still thin, Google's scanner remains the default for most users, revenue is unproven, and Indonesia-specific demand is not measured. If the benchmark shows OCR is poor on low-end phones, the score drops to roughly 40. If two campuses or one government office pilot it, it rises to roughly 70. These adjustments are my estimates, not computed.

## Evidence base

| Item | Finding | Source |
|---|---|---|
| Adobe Scan free | Capture, edge detection, OCR, markup, JPEG export | [S1] |
| Adobe Scan paid (Indonesia listing) | Combine scans, OCR 5 to 100 pages, Magic eraser, extract pages; Rupiah plans listed from Rp 65 ribu to Rp 349 ribu (Plus yearly) and others, billing periods unclear | [S2] |
| Adobe Scan USD | Listing shows USD 9.99, 4.99, 19.99; pairing to plan names unclear | [S3] |
| Adobe Scan Word export | Adobe's page is ambiguous: FAQ lists Word, Pro section says conversion needs Acrobat Pro | [S1] |
| CamScanner | Listing: USD 4.99/month, 49.99/year; free tier has ads and watermark; listings may be dated | [S4] |
| CamScanner 2019 incident | Kaspersky reported a malicious dropper (Trojan-Dropper.AndroidOS.Necro.n) in a third-party ad library inside the free Android app, 100M+ downloads, removed from Google Play. Verified in multiple outlets | [S5] |
| Microsoft Lens | Store removal 9 Feb 2026, scanning stopped 9 March 2026, replacement OneDrive scan; dates moved twice since Aug 2025 | [S6] |
| Modded apps | 146k apps, 13 markets, about 90% altered, about 10x more likely flagged malicious | [S15] |
| Indonesia users | 229.4M internet users, 80.66% penetration (APJII 2025) | [S19] |
| Students | About 10.08M registered students (PDDikti, Oct 2024) | [S21] |
| Piracy | Business software piracy 85 to 86% around 2009 to 2011; a student survey names price as main reason | [S22][S23] |
| Google Trends, "mod apk" Indonesia | Unavailable: fetch returned HTTP 429 | sources.md |

### Modded and cracked APK incidents (dated)
1. 10 July 2019, Check Point: "Agent Smith", about 25 million devices, spread from the third-party store 9Apps, targeted Hindi, Arabic, Russian and Indonesian speakers, replaces installed apps with malicious versions [S18]. No Indonesia-only infection count was found.
2. August 2021, Kaspersky: FMWhatsApp mod carried the Triada trojan via an ad library; follow-on modules could subscribe victims to paid services and intercept SMS login codes [S16].
3. October 2022, Kaspersky: YoWhatsApp mod with Triada, aimed at stealing keys to WhatsApp accounts [S17, secondary coverage].
4. 2024, Cambridge ModZoo study of 146k modded apps [S15] (check exact figures in the paper before quoting).
Context case, not a mod: August 2019, CamScanner's official app shipped a malicious ad module [S5].

I did not find a Kaspersky, ESET or Check Point report specifically about cracked document scanners. The honest claim is "cracked apps in general are riskier", not "cracked scanners have been caught stealing documents". I also did not verify a widely repeated "23% of third-party APKs contain malware" figure attributed to Kaspersky; do not use it.

## Competitive landscape

Prices come from store listings and search summaries; they vary by region and date. "n/v" means not verified.

| App | Price | Ads / watermark | Account | Offline OCR | Searchable PDF | Exports | Platforms | Open source |
|---|---|---|---|---|---|---|---|---|
| Pagelark | Free | No / No | No | Yes, tesseract.js (accuracy unmeasured) | Yes | PDF, Word, TXT, JPG | PWA, Android APK | Yes |
| Adobe Scan [S1][S2] | Free tier; paid plans (USD 4.99 to 9.99 range; Rupiah plans) | n/v | n/v | n/v; OCR capped at 5 pages on Indonesian listing | Yes | PDF, JPEG free; convert/Word paid or unclear | iOS, Android | No |
| CamScanner [S4] | USD 4.99/mo, 49.99/yr (dated listing) | Ads and watermark in free tier | n/v | n/v | n/v | PDF, JPG | iOS, Android | No |
| Microsoft Lens [S6] | Retired March 2026 | n/a | n/a | n/a | n/a | n/a | n/a | No |
| Google Drive scan [S7] | Free (storage limits apply) | No | Google | n/v | Yes (per Google help) | PDF | Android, iOS | No |
| Files by Google [S8] | Free | No | n/v | n/v | n/v | PDF | Android | No |
| Apple Notes/Files [S9] | Free | No | Apple device | n/v | n/v | PDF | iOS | No |
| Genius Scan [S10] | Free; Plus/Ultra paid, prices vary | n/v | n/v (cloud optional) | n/v | n/v | PDF, JPEG | iOS, Android | No |
| SwiftScan [S11] | Free; paid tiers conflict across sources | n/v | n/v | Pro | n/v | PDF, JPG | iOS, Android | No |
| TapScanner [S12] | Free with watermark per one guide; paid roughly USD 5 to 12 | Watermark | n/v | Paid | n/v | PDF | iOS, Android | No |
| FairScan [S13] | Free | No | No | n/v (a Tesseract mention on its page was not confirmed as shipped) | n/v | PDF | Android | Yes, GPLv3 |
| OSS Document Scanner [S14] | Free | No | No | n/v | n/v | PDF | Android | Yes |
| Open Note Scanner [S14] | Free | No | No | n/v | n/v | PDF | Android | Yes, listed discontinued |

Reading the table: Pagelark's combination (browser, OCR, Word export, fill and sign, proof stamp) is unusual, but each piece has a free substitute. Many "n/v" cells mean this table is not ready to publish; installing each app for half a day would fix it.

## Market signals for Indonesia

- 229.4M internet users, 80.66% penetration in 2025 [S19]; DataReportal gives about 230M and 80.5% for end 2025 [S20]. Smartphone-specific penetration was not found.
- About 10.08M students in PDDikti [S21]. Interns and job applicants also need scans, but I found no count.
- Piracy: old business-software rates of 85 to 86% [S22] and a student survey naming price as the main reason [S23]. This supports the price motive but is not data on mod APKs.
- "Mod apk" search interest: unavailable; Google Trends returned HTTP 429. Next step: pull it by hand in a browser.
- Indirect demand evidence: Adobe sells Rupiah plans for scanning [S2].

## Business Model Canvas

1. Customer segments: students and interns in Indonesia; small offices and shops; village and sub-district offices; later, privacy-minded users globally.
2. Value propositions: free, no account, no ads, no watermark; works offline; clean printable output with stamps and signatures kept; optional tamper check.
3. Channels: Play Store, PWA link, campus IT and student organisations, WhatsApp groups, Indonesian tutorial videos, F-Droid, GitHub.
4. Customer relationships: self-service; open issue tracker; Indonesian help page; a named maintainer.
5. Revenue streams: none today. Candidates below.
6. Key resources: the codebase, OCR language data, a trusted name, the maintainer's time.
7. Key activities: OCR benchmarking and tuning, Android packaging, storage safety, localisation, outreach to institutions.
8. Key partners: campus IT units, student organisations, Solana/Superteam grant programs, translators, one institution willing to pilot.
9. Cost structure: static hosting (near zero), Play developer fee, maintainer time, optional signer-key and RPC costs for institutions.

## SWOT

- Strengths: free and ad-free; local processing; open source; a specific feature (stamps and signatures preserved); no server to run or breach.
- Weaknesses: no moat; browser OCR limits; IndexedDB fragility; no sync; no revenue; one maintainer; unknown brand.
- Opportunities: Microsoft Lens gone [S6]; Adobe's Rupiah paywalls [S2]; large student population [S21]; institutions that need a safe default; proof stamp becoming useful with institution keys.
- Threats: Google and Apple improving built-in scanners; existing open-source apps [S13][S14]; a storage-loss incident; app-store policy changes; name conflict; crypto stigma.

## Revenue options that keep the core free

1. Institutional white-label or support contract: campus or village-office edition with their branding, templates and an institution-held stamp signer, priced per institution per year. Most plausible; needs a pilot to learn the real price (no price data sourced).
2. Paid verification service for institutions: hosted verification page with their name, logs and bulk check. The public check stays free.
3. Grants: Solana ecosystem grants and open-source or digital-public-goods funds. Real, but one-off.
4. Donations or sponsorship (GitHub Sponsors, local companies). Small.
5. Training or deployment services for offices. Scales only with founder time.
Not recommended: ads, data sale, watermarks. They would destroy the reason to exist.

## Go-to-market, Indonesia

1. Fix foundations first: storage persistence and export, OCR benchmark, Play Store listing.
2. Make a 60-second Indonesian demo: scan an ijazah with a blue stamp, compare with a plain phone photo, get a small searchable PDF.
3. Pilot with one campus: KKP/magang paperwork, a student organisation as champion, one IT contact. Collect time-to-scan and failure rates.
4. Content: short videos on safe alternatives to mod APKs, citing the sources above rather than scaring people.
5. Pitch one village or sub-district office with a printed one-page guide.
6. Only then go to English-language communities (F-Droid, Privacy Guides forum, Hacker News).

## Metrics

- Activation: share of visitors who complete one export.
- Retention: users who scan again within 14 days.
- Quality: OCR character accuracy per language on the benchmark; seconds per page on a low-end device.
- Safety: reports of lost documents (target zero); share of users with persistent storage granted.
- Distribution: Play installs vs APK downloads vs PWA installs.
- Institutions: pilots started, pilots still active after 3 months.
- Proof stamp: stamps created, and verifications run by someone other than the signer.
- Funding: monthly cost vs monthly income.

## Web3 critique: the proof stamp

What it proves: a signer address wrote a Memo containing this SHA-256 at a given slot and time, so the exact bytes existed no later than that moment, and anyone holding the same file can recompute the hash and compare.

What it does not prove:
- That the content is true or authentic. A forged document stamps just as well as a genuine one.
- Who the signer is. A wallet address is not an identity unless something binds it to a person.
- Legal standing. I did not research Indonesian rules on electronic evidence or certified electronic signatures; assume none until a lawyer says otherwise, and do not claim it.
- Permanence on devnet. Devnet is a test network and can be reset, so devnet stamps are a demo, not evidence.
- That the file existed before it was scanned. It stamps the export, not the paper.
- Privacy: only the hash is public, but signer address and time are public and linkable.

When it is genuinely useful: when someone must later show a file was not edited after a known date, and the verifier can trust the signer address through another channel. Examples: a university issuing transcripts from a published address, a contractor submitting a report, a student proving a deadline file.

What would make it stronger:
1. Mainnet or another durable anchor, with the small fee shown to the user.
2. Institution-held signer keys, with the address published on the institution's own website, so the stamp means "this campus issued this file".
3. A third-party verification page with no wallet needed, and a QR on the PDF linking to it.
4. Batch anchoring (many hashes in one transaction) to cut institutional cost.
5. Honest copy: "tamper check", not "legal proof".
6. Keep it optional and out of the main flow for individuals, so the scanner is not judged by it.

## Caveats

- Prices are from store listings and search summaries, several dated or conflicting; verify before any public comparison.
- Several competitor cells are unverified. FairScan's OCR status is unclear.
- No Indonesia-specific mod APK data and no Google Trends data were obtained.
- Name: no web hits for "Pagelark", but no trademark register (WIPO, DJKI, USPTO) was queried.
- Several facts came from search-engine summaries of pages, not the pages themselves; sources.md marks the weakest ones.
