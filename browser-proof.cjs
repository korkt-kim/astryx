const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = path.resolve(process.env.SLIDER_EVIDENCE_DIR || 'slider-evidence');
fs.mkdirSync(output, {recursive: true});

(async () => {
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const evidence = {browser: browser.version(), viewport: {width: 960, height: 480}, capturedAt: new Date().toISOString(), runs: []};
  for (const [name, base] of [['before', 'https://facebook.github.io/astryx/storybook'], ['after', 'http://localhost:6007']]) {
    const context = await browser.newContext({viewport: evidence.viewport, colorScheme: 'light', reducedMotion: 'reduce', recordVideo: {dir: path.join(output, 'raw-video'), size: evidence.viewport}});
    const page = await context.newPage();
    const url = `${base}/iframe.html?id=core-slider--custom-step&viewMode=story&args=step:3`;
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 90000});
    const slider = page.getByRole('slider');
    await slider.waitFor({state: 'visible', timeout: 90000});
    await page.evaluate(({name}) => {
      const panel = document.createElement('aside');
      panel.id = 'evidence-panel';
      panel.style.cssText = 'position:fixed;left:16px;right:16px;top:130px;padding:20px 24px;background:#f7f8fa;color:#17212f;border:1px solid #d7dee7;border-radius:12px;font:15px/1.5 system-ui;pointer-events:none;z-index:2147483647';
      panel.innerHTML = `<h1 style="font-size:22px;margin:0 0 4px">${name === 'before' ? 'AS-IS · Published Storybook' : 'TO-BE · Local fix'}</h1><p style="margin:0 0 12px">Core / Slider / Custom Step · min = 0 · max = 100 · step = 3</p><table style="width:100%;text-align:left;border-collapse:collapse"><thead><tr><th>Real browser action</th><th>aria-valuenow</th><th>aria-valuemax</th></tr></thead><tbody id="evidence-rows"></tbody></table><p style="font-size:12px;color:#586779;margin:14px 0 0">Diagnostic panel added by the probe. Values read from the live DOM after each action; Slider is unmodified.</p>`;
      document.body.appendChild(panel);
    }, {name});
    const observations = [];
    const observe = async action => {
      const actual = await slider.evaluate(el => ({value: el.getAttribute('aria-valuenow'), min: el.getAttribute('aria-valuemin'), max: el.getAttribute('aria-valuemax')}));
      observations.push({action, ...actual});
      await page.evaluate(({action, actual}) => {
        const row = document.createElement('tr');
        for (const text of [action, actual.value, actual.max]) {
          const cell = document.createElement('td'); cell.textContent = text; cell.style.padding = '4px 0'; row.appendChild(cell);
        }
        document.querySelector('#evidence-rows').appendChild(row);
      }, {action, actual});
      await page.waitForTimeout(700);
      return actual.value;
    };
    await page.waitForTimeout(600);
    await slider.focus();
    await page.keyboard.press('End');
    assert.equal(await observe('End'), name === 'before' ? '99' : '100');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await observe('ArrowLeft'), name === 'before' ? '96' : '99');
    await page.keyboard.press('ArrowRight');
    assert.equal(await observe('ArrowRight'), name === 'before' ? '99' : '100');
    await page.keyboard.press('Home');
    assert.equal(await observe('Home'), '0');
    const thumb = await slider.boundingBox();
    const track = await slider.evaluate(el => { const r = el.parentElement.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; });
    const sx = thumb.x + thumb.width / 2;
    const sy = thumb.y + thumb.height / 2;
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    for (let n = 1; n <= 35; n++) {
      await page.mouse.move(sx + ((track.x + track.width - 1) - sx) * n / 35, sy);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    assert.equal(await observe('Drag to right endpoint'), name === 'before' ? '99' : '100');
    await page.screenshot({path: path.join(output, `${name}.png`)});
    await page.waitForTimeout(800);
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(output, `${name}.webm`));
    evidence.runs.push({name, url, observations});

    const checks = await browser.newContext({viewport: evidence.viewport, colorScheme: 'light'});
    const p = await checks.newPage();
    const representative = [];
    for (const [label, args, expectedEnd, expectedLeft] of [
      ['aligned step 10', 'step:10', '100', '90'],
      ['off-grid endpoint already reachable with step 6', 'step:6', '100', '96'],
      ['offset minimum, aligned step 3', 'min:1;max:100;step:3', '100', '97'],
      ['off-grid negative minimum', 'min:-1;max:100;step:3', '100', '98'],
    ]) {
      await p.goto(`${base}/iframe.html?id=core-slider--custom-step&viewMode=story&args=${args}`, {waitUntil:'domcontentloaded',timeout:90000});
      const s = p.getByRole('slider'); await s.waitFor({state:'visible',timeout:90000}); await s.focus();
      await p.keyboard.press('End');
      const end = await s.getAttribute('aria-valuenow'); assert.equal(end, expectedEnd, label);
      await p.keyboard.press('ArrowLeft');
      const left = await s.getAttribute('aria-valuenow'); assert.equal(left, expectedLeft, label);
      representative.push({case:label,min:await s.getAttribute('aria-valuemin'),max:await s.getAttribute('aria-valuemax'),end,left});
    }
    evidence.runs[evidence.runs.length - 1].representative = representative;
    await checks.close();
    fs.writeFileSync(path.join(output,'browser-results.json'), JSON.stringify(evidence,null,2));
  }
  await browser.close();
  console.log(JSON.stringify(evidence,null,2));
  console.log('BROWSER_PROOF_PASSED');
})().catch(error => {console.error(error); process.exit(1);});
