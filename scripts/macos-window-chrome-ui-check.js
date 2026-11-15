async (page) => {
  const checks = [], errors = [];
  const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  await page.context().addInitScript(() => {
    let id = 0;
    const callbacks = {}, listeners = {}, calls = [];
    let note = {id:1,uid:'chrome-fixture',title:'窗口测试笔记',body:'仅用于隔离窗口检查。',tag:null,reminder_id:null,created_at:'2026-11-15',updated_at:'2026-11-15',deleted_at:null,pinned_at:null};
    window.chromeFixture = {calls, callbacks, listeners};
    window.__TAURI_INTERNALS__ = {
      metadata:{currentWindow:{label:location.pathname.includes('note.html')?'note-1':'main'},currentWebview:{label:'main'}},
      transformCallback:cb=>{callbacks[++id]=cb;return id;}, unregisterCallback:()=>{}, convertFileSrc:p=>p,
      invoke:async(command,args={})=>{
        if(command==='plugin:app|version') return '0.4.8';
        if(command==='plugin:event|listen'){listeners[args.event]=args.handler;return ++id;}
        if(command==='plugin:window|inner_size') return {width:980,height:680};
        if(command==='plugin:window|scale_factor') return 1;
        if(command.startsWith('plugin:')){calls.push(command);return null;}
        if(command==='get_note') return note;
        if(command==='save_note'){calls.push('save_note');note=args.note;return note;}
        const r=await fetch('/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,args})}).then(r=>r.json());
        if(r.error)throw Error(r.error);return r.value;
      }
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
  });
  for (const native of [false,true]) {
    const p = await page.context().newPage();
    p.on('pageerror',e=>errors.push(e.message));
    if(native) await p.addInitScript({path:'apps/desktop/src-tauri/src/macos-window-chrome.js'});
    for(const kind of ['main','note']) {
      await p.goto(`http://127.0.0.1:1421/${kind==='note'?'note.html?id=1':''}`);
      await (kind==='main'?p.locator('#tsearch'):p.locator('.cm-editor')).waitFor();
      const controls=p.locator(kind==='main'?'.tb-wc':'.wctl');
      for(const [width,height] of (kind==='main'?[[760,520],[1040,680],[1440,900]]:[[560,400],[980,680],[1440,900]])) {
        await p.setViewportSize({width,height});
        check(await controls.isVisible()===!native,`${native?'macOS':'Windows'} ${kind} ${width}: custom controls visibility`);
        const toolbar=p.locator(kind==='main'?'.frame > .tb':'.ntb');
        check(await toolbar.evaluate(el=>el.scrollWidth<=el.clientWidth),`${native?'macOS':'Windows'} ${kind} ${width}: toolbar fits`);
        if(native)check(await p.locator('#w-close').isHidden(),`${kind} ${width}: duplicate close is inaccessible`);
        await p.screenshot({path:`output/playwright/macos-window-chrome-20261115/${native?'macos-content':'windows'}-${kind}-${width}.png`});
      }
      if(!native){
        await p.locator('#w-min').click();await p.locator('#w-max').click();
        check(await p.evaluate(()=>window.chromeFixture.calls.includes('plugin:window|minimize')&&window.chromeFixture.calls.includes('plugin:window|toggle_maximize')),`${kind}: Windows minimize/maximize handlers retained`);
      }
      if(native&&kind==='note'){
        await p.locator('#title').fill('关闭前保存的合成标题');
        await p.evaluate(async()=>{const f=window.chromeFixture;await f.callbacks[f.listeners['tauri://close-requested']]({event:'tauri://close-requested',id:1,payload:null});});
        check(await p.evaluate(()=>{const c=window.chromeFixture.calls;return c.indexOf('save_note')>=0&&c.indexOf('save_note')<c.indexOf('plugin:window|destroy');}),'native note close event saves pending edit before destroy (fixture)');
      }
    }
    await p.close();
  }
  check(errors.length===0,'no browser page exceptions');
  return {passed:checks.length,checks,errors,productionWrites:0,nativeMacControls:'not rendered by Chromium; Mac native verification required'};
}
