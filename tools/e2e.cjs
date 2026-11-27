// Browsertest mit Playwright (nicht Teil von npm test, braucht Chromium und einen laufenden Server):
//   python3 -m http.server 8765 --bind localhost &
//   node tools/e2e.cjs <Ausgabeordner>      (andere Adresse: APP_URL=http://localhost:8765/skill-atelier/index.html)
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const OUT = process.argv[2];
const APP = process.env.APP_URL || 'http://localhost:8765/index.html';
const ORIGIN = new URL(APP).origin;
const res = []; const ok = (n, c, d='') => { res.push([c ? 'PASS' : 'FAIL', n, d]); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror ' + e.message));
  page.on('requestfailed', r => errs.push('requestfailed ' + r.url()));
  const external = [];
  page.on('request', r => { if (!r.url().startsWith(ORIGIN) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) external.push(r.url()); });
  await page.goto(APP);
  await page.waitForSelector('#editor');
  const txt = (s) => page.locator(s).innerText();
  const set = async (t) => { await page.fill('#editor', t); };
  ok('Start: Vorlage ist unfertig (Platzhalter-Fehler)', /^1 Fehler/.test(await txt('#counts')) && (await txt('#issues')).includes('Vorlagen-Platzhalter'), await txt('#counts'));
  await page.click('#export');
  ok('Unfertige Vorlage wird nicht exportiert', (await txt('#status')).startsWith('Nicht exportiert'), await txt('#status'));
  ok('Start: Zeilenzähler', /^Zeilen \d+\/35$/.test(await txt('#lines')), await txt('#lines'));
  const GOOD = '---\nname: browser-test\ndescription: Test. Nutzen bei "x".\n---\n\n# Test\n\nZiel: prüfen.\n';
  await set(GOOD);
  ok('Gültiger Skill: Prüfung bestanden', (await txt('#issues')).includes('Alle Prüfungen bestanden'));
  ok('Auswahl zeigt Häkchen und Namen', (await txt('#select')).includes('✓ browser-test'));
  await set(GOOD + '\nSatz – mit Strich.\nTODO');
  const iss = await txt('#issues');
  ok('Warnung Gedankenstrich + Platzhalter', iss.includes('Gedankenstrich') && iss.includes('Platzhalter'), iss.replace(/\n/g,' | '));
  await set(GOOD + '\n<!-- versteckt -->\n' + 'a​b');
  const scan = await txt('#scan');
  ok('Scan findet Kommentar und unsichtbares Zeichen', scan.includes('HTML-Kommentar') && scan.includes('U+200B'), scan.replace(/\n/g,' | ').slice(0,200));
  await set(GOOD + '\n' + Array.from({length: 40}, (_, i) => '- p' + i).join('\n'));
  ok('Zeilenlimit: Fehlerchip', (await page.locator('#lines').getAttribute('class')).includes('err'));
  await page.click('#export');
  ok('Export bei Fehler blockiert', (await txt('#status')).startsWith('Nicht exportiert'), await txt('#status'));
  await set(GOOD);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export')]);
  const f1 = OUT + '/' + dl.suggestedFilename(); await dl.saveAs(f1);
  ok('Export: Dateiname', dl.suggestedFilename() === 'browser-test.zip', dl.suggestedFilename());
  let unz = ''; try { unz = execFileSync('unzip', ['-p', f1, 'browser-test/SKILL.md']).toString(); } catch (e) { unz = 'FEHLER ' + e.message; }
  ok('Export: unzip liest SKILL.md identisch', unz === GOOD, unz.slice(0, 60));
  await page.click('#new');
  ok('Neu: zwei Skills in der Auswahl', (await page.locator('#select option').count()) === 2);
  await set(GOOD.replace('browser-test', 'zweiter-test'));
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#bundle')]);
  const f2 = OUT + '/' + dl2.suggestedFilename(); await dl2.saveAs(f2);
  const list = execFileSync('unzip', ['-Z1', f2]).toString().trim().split('\n');
  ok('Bündel: enthält beide ZIPs', list.sort().join() === 'browser-test.zip,zweiter-test.zip', list.join());
  await page.reload(); await page.waitForSelector('#editor');
  ok('Speicherung überlebt Neuladen', (await page.locator('#select option').count()) === 2 && (await page.inputValue('#editor')).includes('zweiter-test'));
  // Doppelter Name blockiert Bündel
  await set(GOOD); // zweiter Skill bekommt Namen browser-test, erster hat ihn auch
  await page.click('#bundle');
  ok('Doppelte Namen blockieren das Bündel', (await txt('#status')).includes('doppelt'), await txt('#status'));
  // Löschen zweistufig
  await page.click('#delete'); ok('Löschen: erst Rückfrage', (await txt('#delete')) === 'Wirklich löschen?');
  await page.click('#delete');
  ok('Löschen: danach ein Skill', (await page.locator('#select option').count()) === 1);
  // Import in frischem Kontext
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const p2 = await ctx2.newPage(); await p2.goto(APP); await p2.waitForSelector('#editor');
  await p2.setInputFiles('#file', f2);
  await p2.waitForFunction(() => document.getElementById('status').textContent.includes('importiert'));
  const st = await p2.locator('#status').innerText();
  ok('Import Bündel: 2 importiert', st.startsWith('2 importiert'), st);
  await p2.setInputFiles('#file', f1);
  await p2.waitForFunction(() => document.getElementById('status').textContent.includes('übersprungen'));
  ok('Import: vorhandener Name wird übersprungen', (await p2.locator('#status').innerText()).startsWith('0 importiert, 1 übersprungen'), await p2.locator('#status').innerText());
  // feindliche ZIPs
  fs.writeFileSync(OUT + '/evil.zip', execFileSync('python3', ['-c', "import zipfile,io,sys; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); z.writestr('../evil/SKILL.md','x'); z.close(); sys.stdout.buffer.write(b.getvalue())"]));
  await p2.setInputFiles('#file', OUT + '/evil.zip');
  await p2.waitForFunction(() => document.getElementById('status').textContent.includes('fehlgeschlagen'));
  ok('Import: Pfad-Trick abgelehnt', (await p2.locator('#status').innerText()).includes('Unsicherer Pfad'), await p2.locator('#status').innerText());
  fs.writeFileSync(OUT + '/junk.zip', 'das ist kein zip');
  await p2.setInputFiles('#file', OUT + '/junk.zip');
  await p2.waitForFunction(() => document.getElementById('status').textContent.includes('fehlgeschlagen') && document.getElementById('status').textContent.includes('Kein ZIP'));
  ok('Import: Müll abgelehnt ohne Absturz', true, await p2.locator('#status').innerText());
  // XSS
  await p2.fill('#editor', '---\nname: <img src=x onerror=window.__xss=1>\ndescription: Nutzen bei x.\n---\nText');
  await p2.waitForTimeout(200);
  ok('XSS im Namen wird nicht ausgeführt', (await p2.evaluate(() => window.__xss)) === undefined);
  // Offline
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  await ctx.setOffline(true);
  await page.reload(); await page.waitForSelector('#editor');
  ok('Offline: Seite lädt aus dem Cache', (await txt('h1')) === 'Skill-Atelier');
  await ctx.setOffline(false);
  await page.screenshot({ path: OUT + '/shot.png' });
  ok('Keine Konsolenfehler', errs.length === 0, errs.join(' || ').slice(0, 300));
  ok('Keine externen Anfragen', external.length === 0, external.join(' ').slice(0, 200));
  await browser.close();
  for (const r of res) console.log(r[0], '|', r[1], r[2] ? '| ' + r[2] : '');
  console.log('\nGesamt:', res.filter(r => r[0] === 'PASS').length, 'PASS,', res.filter(r => r[0] === 'FAIL').length, 'FAIL');
})().catch(e => { console.error('ABBRUCH', e); process.exit(1); });
