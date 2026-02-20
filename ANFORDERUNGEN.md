# Anforderungsdokument: Obsidian ↔ Outline Sync Plugin

**Version:** 0.3
**Datum:** 2026-02-20
**Status:** Freigegeben für Implementierung

| Entscheidung | Wert |
|---|---|
| Outline-Instanz | Self-Hosted |
| Sync-Richtung | One-Way: Obsidian → Outline (Push only) |
| Ziel-Struktur | Eine konfigurierbare Ziel-Collection; manuelle Restrukturierung in Outline |
| Konflikt-Strategie | Obsidian gewinnt immer (Overwrite) |
| Bilder im MVP | Ja |
| Store-Konformität | Ja, von Anfang an |

---

## 1. Kritische Beurteilung der Idee

### 1.1 Stärken

- **Sinnvolle Bridge:** Obsidian ist ein lokales, persönliches Notiz-Tool – Outline ist ein kollaboratives Team-Wiki. Die Lücke zwischen persönlichem Wissen und Team-Dokumentation ist real und schmerzhaft.
- **Gemeinsame Basis:** Beide Systeme nutzen Markdown als Speicherformat. Outline speichert Dokumente intern als CommonMark-Markdown, was die Konvertierung vereinfacht.
- **Ausgereifte APIs:** Die Outline REST/RPC-API ist vollständig dokumentiert (OpenAPI Spec verfügbar). Das Obsidian Plugin-System ist stabil und in TypeScript geschrieben.
- **Marktlücke:** Es existiert kein offizielles Plugin für diese Integration – Community-Bedarf ist vorhanden.

### 1.2 Risiken und kritische Herausforderungen

> ⚠️ **Diese Punkte müssen vor der Implementierung geklärt sein.**

#### Markdown-Dialekt-Inkompatibilität (HOCH)
Obsidian verwendet einen eigenen Markdown-Dialekt:
- `[[Wiki-Links]]` → Outline kennt diese nicht nativ; können aber als Outline-Backlinks aufgelöst werden, wenn das Zieldokument bereits in Outline existiert
- `![[Eingebettete Dateien]]` → erfordert separaten Attachment-Upload-Flow
- `> [!NOTE] Callouts` → Outline-spezifische Syntax unterscheidet sich
- `#Tags` im Text → Outline hat eigene Tag-Verwaltung
- YAML-Frontmatter (`---`) → Outline hat `DataAttributes`, aber kein direktes Mapping

**Konsequenz:** Ohne einen Konverter werden Dokumente auf Outline unleserlich oder fehlerhaft dargestellt.

#### Strukturelle Inkompatibilität (ENTSCHÄRFT)
| Obsidian | Outline |
|---|---|
| Vault (Root-Ordner) | Workspace |
| Ordner | Collection |
| Markdown-Datei | Document |
| Attachment-Ordner | Attachments (separater Upload-Flow) |

**Entscheidung:** Kein automatisches Hierarchie-Mapping. Der Nutzer wählt eine Ziel-Collection; alle gepushten Dokumente landen dort flach. Restrukturierung erfolgt manuell in Outline. Das eliminiert das Komplexitätsproblem vollständig.

#### Bidirektionale Synchronisation (BEWUSST AUSGESCHLOSSEN)
Echte Zwei-Wege-Sync ist überentwickelt und fehleranfällig:
- Was passiert, wenn dieselbe Datei in Obsidian **und** auf Outline gleichzeitig geändert wurde?
- Obsidian hat kein natives Conflict-Resolution-System
- **Entscheidung:** Reines One-Way-Push (Obsidian → Outline). Restrukturierung erfolgt manuell in Outline.

> **Hinweis zu Webhooks:** Outline unterstützt Webhooks (Settings → Webhooks). Diese erfordern jedoch einen externen HTTP-Server als Empfänger. Ein Obsidian-Plugin läuft lokal ohne eingehende Verbindungen – Webhooks sind daher für das Plugin selbst nicht direkt nutzbar. Relevant erst bei einem zukünftigen Companion-Server.

#### Attachments / Bilder (MITTEL)
- Bilder in Obsidian sind lokale Dateien
- Outline erfordert einen zweistufigen Upload: erst `attachments.create` aufrufen, dann die Datei per signierter URL hochladen
- Eingebettete Bilder in Markdown müssen nach dem Upload durch Outline-URLs ersetzt werden

#### Rate Limiting (MITTEL)
- Outline begrenzt API-Anfragen (429-Status mit `Retry-After`-Header)
- Bei großen Vaults (100+ Dateien) kann ein initialer Sync die Rate Limits auslösen
- Eine Queue mit Backoff-Strategie ist zwingend erforderlich

#### Sicherheit (MITTEL)
- Der Outline API-Key muss sicher in den Obsidian Plugin-Settings gespeichert werden
- Obsidian speichert Plugin-Daten in `.obsidian/plugins/[plugin-id]/data.json` – diese Datei sollte **nicht** in Git eingecheckt werden

---

## 2. Scope-Definition

### 2.1 In-Scope (MVP – Phase 1)

- One-Way-Push: Obsidian → Outline (manuell ausgelöst)
- Einzelne Markdown-Datei in die konfigurierte Ziel-Collection pushen
- Alle Dateien eines Obsidian-Ordners in die Ziel-Collection pushen (flach, keine Hierarchie)
- Grundlegende Markdown-Konvertierung (Wiki-Links, Frontmatter-Strip, Callouts)
- `[[Wiki-Links]]` auf bereits gepushte Outline-Dokumente als echte Outline-Links auflösen
- Speicherung der Outline-Dokument-ID im Obsidian-Frontmatter (für spätere Updates)
- **Bild/Attachment-Upload zu Outline (bereits im MVP)**
- Plugin-Settings: Self-Hosted API-URL, API-Key, Ziel-Collection
- Konflikt-Strategie: Obsidian überschreibt Outline immer (Overwrite)
- **Obsidian Community Plugin Store-Konformität von Anfang an**

### 2.2 In-Scope (Phase 2)

- Automatischer Push bei Datei-Speicherung (optional, per Setting)
- Frontmatter-Felder als Outline-DataAttributes übertragen
- Sync-Status-Anzeige in der Obsidian-Statusleiste
- Mehrere Ziel-Collections konfigurierbar (pro Obsidian-Ordner eine Collection)

### 2.3 Out-of-Scope (bewusst ausgeschlossen)

- Pull: Outline → Obsidian (zu komplex, Konfliktpotenzial hoch)
- Bidirektionale Sync (überentwickelt, fehleranfällig)
- Automatisches Hierarchie-Mapping (Ordnerstruktur → Collections)
- Obsidian Graph View, Kanban oder andere UI-spezifische Features
- Outline Permissions-Management oder Shares

---

## 3. Funktionale Anforderungen

### 3.1 Authentifizierung & Konfiguration

| ID | Anforderung | Priorität |
|---|---|---|
| F-01 | Der Nutzer kann in den Plugin-Settings eine Outline-Instanz-URL konfigurieren (Cloud oder Self-Hosted) | Muss |
| F-02 | Der Nutzer kann einen Outline API-Key hinterlegen | Muss |
| F-03 | Das Plugin validiert den API-Key beim Speichern und zeigt Feedback an | Muss |
| F-04 | Der Nutzer wählt eine Ziel-Collection aus einer Liste aller verfügbaren Collections (Dropdown) | Muss |
| F-05 | ~~Ordner-Mapping~~ → entfällt (Phase 2) | - |

### 3.2 Push: Einzelnes Dokument

| ID | Anforderung | Priorität |
|---|---|---|
| F-10 | Der Nutzer kann eine aktive Datei per Rechtsklick-Menü oder Command Palette auf Outline pushen | Muss |
| F-11 | Beim ersten Push wird ein neues Outline-Dokument erstellt | Muss |
| F-12 | Bei einem erneuten Push wird das bestehende Outline-Dokument aktualisiert (Update, nicht Duplikat) | Muss |
| F-13 | Die Outline-Dokument-ID wird im YAML-Frontmatter der Obsidian-Datei gespeichert (`outline_id`) | Muss |
| F-14 | Der Nutzer wird nach dem Push mit einem Link zum Outline-Dokument benachrichtigt | Soll |
| F-15 | YAML-Frontmatter wird vor dem Push aus dem Markdown-Inhalt entfernt | Muss |

### 3.3 Push: Ordner-Inhalt

| ID | Anforderung | Priorität |
|---|---|---|
| F-20 | Der Nutzer kann einen Obsidian-Ordner per Rechtsklick pushen – alle Markdown-Dateien landen flach in der Ziel-Collection | Muss |
| F-21 | Bereits gepushte Dokumente (erkennbar an `outline_id` im Frontmatter) werden aktualisiert, neue werden erstellt | Muss |
| F-22 | ~~Hierarchie-Mapping~~ → entfällt; keine automatische Ordnerstruktur-Abbildung | - |
| F-23 | Der Nutzer kann vor dem Ordner-Push eine Vorschau der zu übertragenden Dateien sehen | Kann |
| F-24 | Nicht-Markdown-Dateien werden beim Ordner-Push übersprungen (mit Hinweis) | Muss |

### 3.4 Markdown-Konvertierung

| ID | Anforderung | Priorität |
|---|---|---|
| F-30 | `[[Wiki-Links]]` werden aufgelöst: Existiert ein Obsidian-Dokument mit diesem Namen bereits in Outline (erkennbar an `outline_id`), wird ein echter Outline-Dokumentlink eingefügt; sonst wird der Link-Text als Klartext beibehalten | Muss |
| F-31 | `![[Eingebettete Bilder]]` werden erkannt, die Datei zu Outline hochgeladen und die URL im Markdown ersetzt | Muss |
| F-32 | Obsidian-Callouts (`> [!NOTE]`) werden in Standard-Blockquotes konvertiert | Soll |
| F-33 | `#Tags` im Text werden erkannt und als Outline-Tags gesetzt | Kann |

### 3.5 Fehlerbehandlung

| ID | Anforderung | Priorität |
|---|---|---|
| F-40 | Bei Rate-Limiting (429) wartet das Plugin die `Retry-After`-Zeit ab und wiederholt den Request | Muss |
| F-41 | Netzwerkfehler werden dem Nutzer verständlich kommuniziert | Muss |
| F-42 | Bei einem fehlgeschlagenen Push bleibt die Obsidian-Datei unverändert | Muss |
| F-43 | Das Plugin loggt Sync-Aktivitäten in eine interne Log-Datei (optional aktivierbar) | Kann |

---

## 4. Nicht-Funktionale Anforderungen

| ID | Anforderung |
|---|---|
| NF-01 | Der API-Key wird **nicht** im Klartext in einer versionierbaren Datei gespeichert |
| NF-02 | Das Plugin funktioniert primär mit Self-Hosted-Instanzen; Cloud-Kompatibilität (`app.getoutline.com`) als Bonus |
| NF-03 | Push-Operationen blockieren die Obsidian-UI nicht (asynchrone Ausführung mit Queue und Backoff bei 429) |
| NF-04 | Das Plugin ist kompatibel mit Obsidian ab Version 1.0 (`minAppVersion: "1.0.0"` in `manifest.json`) |
| NF-05 | Kein externes npm-Paket außer dem Obsidian Plugin-SDK – kein jQuery, kein React |
| NF-06 | TypeScript mit striktem Typing (`strict: true`) |
| NF-07 | **Store-Konformität:** Kein `eval()`, kein unsanitiertes `innerHTML`, keine externen CDN-Ressourcen |
| NF-08 | **Store-Konformität:** `manifest.json` enthält alle Pflichtfelder: `id`, `name`, `version`, `minAppVersion`, `description`, `author`, `authorUrl`, `isDesktopOnly` |
| NF-09 | **Store-Konformität:** `README.md` mit Beschreibung, Voraussetzungen, Konfigurationsanleitung und Screenshots |
| NF-10 | **Store-Konformität:** Lizenz-Datei (MIT) im Repository-Root |
| NF-11 | **Store-Konformität:** Plugin-ID ist eindeutig in kebab-case (z.B. `obsidian-outline-sync`) |

---

## 5. Technische Architektur (Überblick)

```
obsidian-outline-sync/
├── src/
│   ├── main.ts               # Plugin-Einstiegspunkt, Obsidian Plugin-Klasse
│   ├── settings.ts           # Plugin-Settings (API-Key, URL, Ziel-Collection)
│   ├── outline-client.ts     # Outline API-Client (fetch-basiert, kein axios)
│   ├── push-engine.ts        # Push-Logik, Queue, Backoff
│   ├── markdown-converter.ts # Obsidian → CommonMark Konvertierung + Link-Auflösung
│   └── frontmatter.ts        # YAML-Frontmatter lesen/schreiben (outline_id)
├── manifest.json             # Pflichtfelder für Store-Konformität
├── README.md                 # Store-Pflicht: Beschreibung + Anleitung
├── LICENSE                   # MIT
├── package.json
└── tsconfig.json
```

### 5.1 Outline API – Relevante Endpunkte

| Endpunkt | Methode | Zweck |
|---|---|---|
| `POST /api/auth.info` | POST | API-Key validieren |
| `POST /api/collections.list` | POST | Verfügbare Collections für Dropdown laden |
| `POST /api/documents.create` | POST | Neues Dokument erstellen |
| `POST /api/documents.update` | POST | Bestehendes Dokument aktualisieren |
| `POST /api/documents.info` | POST | Dokument-Details abrufen |
| `POST /api/attachments.create` | POST | Attachment-Upload initiieren |

> **Hinweis:** Die Outline API ist RPC-Style – **alle** Endpunkte sind `POST`-Requests mit JSON-Body und `Authorization: Bearer <API_KEY>` Header.

### 5.2 Frontmatter-Schema (Obsidian-Datei)

```yaml
---
outline_id: "uuid-des-outline-dokuments"
outline_collection_id: "uuid-der-collection"
outline_last_synced: "2026-02-20T18:00:00Z"
---
```

---

## 6. Offene Fragen (zu klären)

~~1. **Konflikt-Strategie:** → Obsidian gewinnt immer (Overwrite). Entschieden.~~
~~2. **Ordner-Tiefe:** → Mittel (3–4 Ebenen). Entschieden.~~
~~3. **Self-Hosted vs. Cloud:** → Self-Hosted. Entschieden.~~
~~5. **Bilder:** → Bereits im MVP. Entschieden.~~
~~4. **Vault-Größe:** → Mittel (100–500 Dateien). Queue mit Backoff-Strategie wird implementiert. Entschieden.~~
~~6. **Unterordner-Mapping-Strategie:** → Entfällt. Kein Hierarchie-Mapping. Entschieden.~~
~~5. **Plugin-Veröffentlichung:** → Ja, Store-Konformität von Anfang an. Entschieden.~~

> Alle Fragen sind geklärt. Das Dokument ist implementierungsbereit.

---

## 7. Empfohlene Implementierungsreihenfolge

```
Phase 1 (MVP)
├── Plugin-Grundgerüst (manifest.json, README.md, LICENSE, main.ts, Settings-Tab)
├── Outline API-Client (auth.info, documents.create/update, collections.list)
├── Frontmatter-Handler (outline_id lesen/schreiben)
├── Markdown-Konverter (Wiki-Links → Outline-Links, Frontmatter-Strip, Callouts)
├── Attachment-Upload (Bilder: attachments.create + signierter URL-Upload)
├── Push: Einzelnes Dokument (Command Palette + Rechtsklick)
└── Push: Ordner-Inhalt flach in Ziel-Collection

Phase 2
├── Auto-Push bei Datei-Speicherung (optional)
├── Frontmatter → DataAttributes Mapping
├── Sync-Status in Statusleiste
└── Mehrere Ziel-Collections (pro Obsidian-Ordner konfigurierbar)

Phase 3 (optional, hohe Komplexität)
└── Pull: Outline → Obsidian (mit Conflict-Resolution, Webhook-Companion-Server)
```

---

## 8. Abhängigkeiten

| Abhängigkeit | Version | Zweck |
|---|---|---|
| `obsidian` (SDK) | `^1.0.0` | Plugin-API |
| `typescript` | `^5.0` | Sprache |
| `esbuild` | aktuell | Build-Tool |

> Keine weiteren externen Abhängigkeiten. Die Outline API wird über den nativen `fetch`-API angesprochen.
