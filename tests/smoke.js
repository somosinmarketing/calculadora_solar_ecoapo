// Smoke test end-to-end en Chromium. Requiere playwright.
//   node tests/smoke.js
// playwright puede estar instalado local o globalmente.
function cargarPlaywright(){
  const candidatos=['playwright','/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright','/usr/local/lib/node_modules/playwright'];
  for(const c of candidatos){try{return require(c);}catch(e){}}
  console.error('Falta playwright. Instalalo con:  npm i -D playwright');
  process.exit(2);
}
const {chromium}=cargarPlaywright();
(async()=>{
  const b=await chromium.launch();
  const pg=await b.newPage();
  const errs=[];
  pg.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text());});
  await pg.goto('file://'+require('path').join(__dirname,'..','calculadorasolar.html'));
  let fail=0;
  const chk=(n,c,d)=>{if(!c)fail++;console.log((c?'  OK  ':' FALLA')+'  '+n+(d?'\n          '+d:''));};

  // Paso 1
  await pg.fill('#p-name','García & Hijos');           // prueba el escape de &
  await pg.fill('#p-loc','Mendoza');
  await pg.click('#btn-next');

  // Paso 2: cargar equipos
  await pg.selectOption('#cat-sel','Heladera clase A');
  await pg.click('button:has-text("+ Agregar")');
  await pg.selectOption('#cat-sel','Bomba de agua 1 HP');
  await pg.click('button:has-text("+ Agregar")');
  const filas1=await pg.locator('#items-body tr').count();
  chk('se agregaron 2 equipos', filas1===2, 'filas='+filas1);

  // BUG 1: ir al paso 3 y volver al 2
  await pg.click('#btn-next');
  await pg.click('#btn-prev');
  const filas2=await pg.locator('#items-body tr').count();
  chk('BUG 1: la tabla sigue poblada al volver al Paso 2', filas2===2, 'filas='+filas2);

  // Avanzar hasta el Paso 7
  for(let i=0;i<5;i++) await pg.click('#btn-next');
  const paso=await pg.textContent('#step-counter');
  chk('llegamos al Paso 7', paso.includes('7'), paso);

  // BUG 2: el total no debe cambiar solo al tocar un campo
  await pg.fill('input[placeholder="USD"] >> nth=0','100');
  const t1=await pg.textContent('#q-grand-usd');
  await pg.fill('input[placeholder="USD"] >> nth=1','500');
  const antes=await pg.textContent('#q-sub-usd');
  await pg.click('#tc-val');                      // foco en otro campo, sin cambiar nada
  const despues=await pg.textContent('#q-sub-usd');
  chk('BUG 2: el subtotal no cambia al mover el foco', antes===despues, antes+' -> '+despues);

  // Desglose coherente: neto + markup + IVA = total.
  // El IVA ya no es un campo global: sale del tipo de componente y se ajusta por fila.
  await pg.fill('#markup-val','20');
  const ivasIniciales=await pg.evaluate(()=>S.quoteItems.map(i=>({t:i.type,iva:i.iva})));
  chk('el panel arranca con 10,5% y el resto con 21%',
      ivasIniciales.find(i=>i.t==='panel').iva===10.5 &&
      ivasIniciales.filter(i=>i.t!=='panel').every(i=>i.iva===21),
      JSON.stringify(ivasIniciales.slice(0,3)));
  const num=async id=>parseFloat((await pg.textContent(id)).replace(/[^0-9]/g,''))||0;
  const [net,mk,sale,iva,gr]=await Promise.all(
    ['#q-sub-usd','#q-mark-usd','#q-sale-usd','#q-iva-usd','#q-grand-usd'].map(num));
  chk('BUG 2: neto + markup = precio de venta', Math.abs(net+mk-sale)<=1, `${net} + ${mk} = ${sale}`);
  chk('BUG 2: venta + IVA = total final', Math.abs(sale+iva-gr)<=1, `${sale} + ${iva} = ${gr}`);

  // El ROI debe recalcular sin robarle el foco al campo que se está editando.
  await pg.evaluate(()=>{S.sysType='ongrid';S.inyecta=true;S.results=calc();renderMain();});
  await pg.fill('input[placeholder="USD"] >> nth=0','100');
  await pg.fill('input[placeholder="USD"] >> nth=1','500');
  const repago1=await pg.textContent('#roi-cards .rc2-val');
  await pg.click('#roi-kwh');
  await pg.type('#roi-kwh','0');                    // 190 -> 1900
  const foco=await pg.evaluate(()=>document.activeElement&&document.activeElement.id);
  chk('el campo de precio del kWh conserva el foco al tipear', foco==='roi-kwh', 'foco en: '+foco);
  const repago2=await pg.textContent('#roi-cards .rc2-val');
  chk('el repago se recalcula al cambiar el precio', repago1!==repago2, repago1+' -> '+repago2+' años');
  await pg.evaluate(()=>{S.precioKwh=190;S.sysType='offgrid';S.results=calc();renderMain();});

  // BUG 3: el Paso 8 debe coincidir con el Paso 7
  await pg.click('#btn-next');
  const prop=await pg.textContent('#proposal-text');
  const m=prop.match(/TOTAL ESTIMADO:\s+USD ([\d.,]+)/);
  const totProp=m?parseFloat(m[1].replace(/\./g,'').replace(',','.')):-1;
  chk('BUG 3: el total del Paso 8 coincide con el del Paso 7', Math.abs(totProp-gr)<=1, 'Paso 7='+gr+'  Paso 8='+totProp);
  // La propuesta es para el cliente del instalador: precios de venta, nunca costos.
  chk('la propuesta no muestra el costo ni el markup',
      !/Materiales \(neto\)|Markup/.test(prop), (prop.match(/Markup.*|Materiales.*/)||['(no aparecen)'])[0]);
  const unitVenta=await pg.evaluate(()=>lineasCliente().lineas[0].unit);
  chk('la propuesta muestra el precio unitario de venta',
      prop.includes('USD '+unitVenta.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+' c/u'),
      'venta c/u = '+unitVenta);
  chk('el & del nombre no rompe la propuesta', prop.includes('García & Hijos'),
      (prop.match(/Cliente:.*/)||[''])[0]);

  // BUG 4: editar la propuesta y navegar no debe perder el texto
  await pg.evaluate(()=>{S.proposal='TEXTO EDITADO A MANO';S.proposalEdited=true;renderMain();});
  await pg.click('#btn-prev'); await pg.click('#btn-next');
  const prop2=await pg.textContent('#proposal-text');
  chk('BUG 4: la edición manual sobrevive a la navegación', prop2.includes('TEXTO EDITADO A MANO'),
      prop2.slice(0,40));

  // BUG 7: el PDF incluye la propuesta
  await pg.click('#btn-next');
  // save() es propiedad de la instancia, no del prototipo: se envuelve el constructor.
  // Antes de descargar, avisa lo que falta (acá: los datos del instalador).
  const capturaPDF=async()=>await pg.evaluate(()=>{
    const orig=window.jspdf.jsPDF,conf=window.confirm; let cap=null,aviso='';
    window.jspdf.jsPDF=function(...a){
      const d=new orig(...a);
      d.save=()=>{cap={paginas:d.internal.getNumberOfPages(),b64:d.output('datauristring')};};
      return d;
    };
    window.confirm=m=>{aviso+=m;return true;};
    try{exportPDF();}finally{window.jspdf.jsPDF=orig;window.confirm=conf;}
    return{...cap,aviso};
  });
  const conProp=await capturaPDF();
  chk('sin datos del instalador, avisa antes de descargar', /nombre y contacto/.test(conProp.aviso),
      conProp.aviso.split('\n').filter(Boolean).slice(0,2).join(' | '));
  const crudo=Buffer.from(conProp.b64.split(',')[1],'base64').toString('latin1');
  chk('BUG 7: el PDF contiene el texto de la propuesta',
      /TEXTO EDITADO A MANO/.test(crudo), conProp.paginas+' páginas');
  const sinProp=await pg.evaluate(async()=>{
    const guardada=S.proposal; S.proposal='';
    const orig=window.jspdf.jsPDF,conf=window.confirm; let n=0;
    window.jspdf.jsPDF=function(...a){const d=new orig(...a);d.save=()=>{n=d.internal.getNumberOfPages();};return d;};
    window.confirm=()=>true;
    try{exportPDF();}finally{window.jspdf.jsPDF=orig;window.confirm=conf;S.proposal=guardada;}
    return n;
  });
  chk('BUG 7: la propuesta agrega su propia página', conProp.paginas>sinProp,
      'con propuesta='+conProp.paginas+'  sin propuesta='+sinProp);
  chk('el PDF conserva la cotización', /Cotizaci/.test(crudo)&&/TOTAL/.test(crudo));
  chk('el PDF del cliente no muestra costo ni markup',
      !/Markup|materiales \(neto\)|Neto USD/.test(crudo));
  chk('el PDF del cliente discrimina el IVA por alícuota', /IVA 10,5%/.test(crudo)&&/IVA 21%/.test(crudo));

  chk('sin datos del instalador, el PDF no inventa un bloque vacío', !/PRESUPUESTADO POR/.test(crudo));

  // Datos del instalador: se cargan en el Paso 1 y firman el presupuesto.
  await pg.evaluate(()=>goTo(1));
  await pg.fill('#i-nombre','Solar Cuyo');
  await pg.fill('#i-mat','MP 1234');
  await pg.fill('#i-tel','261 555-1234');
  await pg.fill('#i-email','ventas@solarcuyo.com');
  const conInst=await pg.evaluate(()=>{
    S.proposalEdited=false;goTo(8);
    const txt=document.getElementById('proposal-text').textContent;
    const orig=window.jspdf.jsPDF; let b64=null;
    window.jspdf.jsPDF=function(...a){const d=new orig(...a);d.save=()=>{b64=d.output('datauristring');};return d;};
    const conf=window.confirm; window.confirm=()=>true;
    try{exportPDF();}finally{window.jspdf.jsPDF=orig;window.confirm=conf;}
    return{txt,b64};
  });
  const crudoInst=Buffer.from(conInst.b64.split(',')[1],'base64').toString('latin1');
  chk('la propuesta lleva nombre y contacto del instalador',
      /Solar Cuyo/.test(conInst.txt)&&/261 555-1234/.test(conInst.txt)&&/MP 1234/.test(conInst.txt));
  chk('el PDF del cliente lleva el bloque del instalador',
      /PRESUPUESTADO POR/.test(crudoInst)&&/Solar Cuyo/.test(crudoInst)&&/ventas@solarcuyo.com/.test(crudoInst));

  // Pedido a EcoApo: precio de lista, sin mano de obra ni datos del cliente.
  const pedido=await pg.evaluate(()=>{
    const orig=window.jspdf.jsPDF; let cap=null;
    window.jspdf.jsPDF=function(...a){
      const d=new orig(...a);
      d.save=(fn)=>{cap={fn,b64:d.output('datauristring')};};
      return d;
    };
    try{exportPedido();}finally{window.jspdf.jsPDF=orig;}
    return{cap,txt:textoPedido(),pe:pedidoEcoapo()};
  });
  const crudoPed=Buffer.from(pedido.cap.b64.split(',')[1],'base64').toString('latin1');
  chk('el pedido genera su propio PDF', /Pedido de materiales/.test(crudoPed), pedido.cap.fn);
  chk('el pedido no incluye la mano de obra',
      !/Mano de obra/.test(crudoPed)&&!/Mano de obra/.test(pedido.txt));
  chk('el pedido no lleva datos del cliente final',
      !/Garc/.test(crudoPed)&&!/Garc/.test(pedido.txt)&&!/Garc/.test(pedido.cap.fn));
  const costoPanel=await pg.evaluate(()=>parseFloat(S.quoteItems.find(i=>i.type==='panel').price));
  chk('el pedido va a precio de lista',
      pedido.txt.includes('USD '+costoPanel.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})+' c/u'),
      'lista panel = '+costoPanel);
  chk('el pedido dice quién pide', /Solar Cuyo/.test(crudoPed)&&/Solar Cuyo/.test(pedido.txt));
  await pg.evaluate(()=>goTo(9));
  const tarjeta=await pg.textContent('#main');
  chk('el Paso 9 ofrece el pedido a EcoApo', /Pedido a EcoApo/.test(tarjeta)&&/Descargar pedido/.test(tarjeta));

  // Persistencia
  await pg.reload();
  const nombre=await pg.evaluate(()=>S.project.name);
  const items=await pg.evaluate(()=>S.items.length);
  chk('el estado se restaura tras recargar', nombre==='García & Hijos'&&items===2,
      'cliente="'+nombre+'", equipos='+items);

  // «Nuevo proyecto» borra el proyecto, no los datos del instalador.
  await pg.evaluate(()=>{window.confirm=()=>true;});
  await Promise.all([pg.waitForNavigation(),pg.evaluate(()=>resetAll())]);
  const trasNuevo=await pg.evaluate(()=>({cli:S.project.name,inst:S.instalador.nombre,mail:S.instalador.email}));
  chk('«Nuevo proyecto» borra el cliente pero conserva al instalador',
      trasNuevo.cli===''&&trasNuevo.inst==='Solar Cuyo'&&trasNuevo.mail==='ventas@solarcuyo.com',
      JSON.stringify(trasNuevo));

  chk('sin errores de JavaScript', errs.length===0, errs.slice(0,4).join('\n          ')||'(ninguno)');
  console.log(fail===0?'\n===== SMOKE TEST OK =====':'\n===== '+fail+' FALLAS =====');
  await b.close(); process.exit(fail?1:0);
})();
