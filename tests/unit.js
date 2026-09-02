// Tests del motor de dimensionado y del cálculo de totales.
//   node tests/unit.js
const {calc,quoteTotals,calcROI,S}=require('./extract.js')();

let fail=0;
const chk=(n,c,d)=>{if(!c)fail++;console.log((c?'  OK  ':' FALLA')+'  '+n+(d?'\n          '+d:''));};
const base=()=>Object.assign(S,{consumoMode:'equipos',items:[],facturaKwh:0,facturaW:0,
  profile:'equilibrado',hsp:4.5,panWp:500,autonomy:24,autonomyCustom:0,
  batId:'lfe100-48',sysType:'offgrid',voltOv:'auto',markup:20,iva:0,quoteItems:[],
  inyecta:null,respaldo:'auto',hspMin:2.6,hspCriterio:'auto',coberturaObj:100,
  tc:1400,precioKwh:190,porcionEvitable:60});

console.log('\n=== Totales de la cotización ===');
// El markup va sobre el costo neto y el IVA sobre el precio de venta.
base();
S.markup=20;
S.quoteItems=[{price:'100',qty:10,iva:21},{price:'500',qty:1,iva:10.5}];
let T=quoteTotals();
const esp={net:1500,markupAmt:300,sale:1800,ivaAmt:315,grand:2115};
Object.keys(esp).forEach(k=>chk('  '+k+' = '+esp[k], Math.abs(T[k]-esp[k])<1e-9, 'obtenido '+T[k]));
chk('marca la cotización completa', T.allOk===true);
S.quoteItems.push({price:'',qty:1,iva:0});
chk('un ítem sin precio la marca incompleta', quoteTotals().allOk===false);

console.log('\n=== Batería incompatible con la tensión del sistema ===');
base(); S.items=[{id:1,device:'Luces',w:100,qty:2,hd:5,pk:1}];   // 200 W -> sistema 12 V
let R=calc();
chk('en automático eleva la tensión a la de la batería', R.volt===48,
    'volt='+R.volt+' V, banco '+R.batS+'S x '+R.batP+'P');
chk('avisa que la elevó', R.avisos.some(a=>a.includes('elev')));

base(); S.voltOv='12'; S.items=[{id:1,device:'Luces',w:100,qty:2,hd:5,pk:1}];
R=calc();
chk('con la tensión forzada no arma un banco imposible', R.nBat===0, 'nBat='+R.nBat);
chk('y avisa la incompatibilidad', R.avisos.some(a=>a.includes('no entra')));

console.log('\n=== El inversor considera el pico de arranque ===');
base(); S.batId='lfe200-48';
S.items=[{id:1,device:'Bomba 1 HP',w:746,qty:1,hd:3,pk:3},
         {id:2,device:'Heladera',w:150,qty:1,hd:8,pk:3}];
R=calc();
chk('manda el pico (1344 W) sobre el nominal (1120 W)', R.invReq===1344,
    'invReq='+Math.round(R.invReq)+' W -> equipo '+R.invSz+' W');
chk('informa qué criterio mandó', /pico/.test(R.invCrit), R.invCrit);

console.log('\n=== Modo factura: potencia estimada y corregible ===');
base(); S.consumoMode='factura'; S.facturaKwh=350; S.batId='lfe300-48';
R=calc();
chk('potencia simultánea realista, no 1.458 W', R.totW>3000&&R.totW<3500, 'totW='+Math.round(R.totW)+' W');
chk('inversor acorde (antes daba 2.000 W)', R.invSz>=5000, 'invSz='+R.invSz+' W');
S.facturaW=6000; R=calc();
chk('respeta la potencia ingresada a mano', R.totW===6000, 'inversor '+R.invSz+' W');

console.log('\n=== No se recorta en silencio al máximo de la tabla ===');
base(); S.consumoMode='factura'; S.facturaKwh=4000; S.batId='lfe300-48';
R=calc();
chk('marca que el inversor excede la tabla', R.invOver===true, 'invReq='+Math.round(R.invReq)+' W');
chk('y lo avisa', R.avisos.some(a=>a.includes('supera')));

console.log('\n=== Cobertura del consumo ===');
base(); S.items=[{id:1,device:'Varios',w:500,qty:1,hd:10,pk:1}];
R=calc();
chk('la generación se calcula y se puede mostrar', R.cobertura>=1,
    (R.whGen/1000).toFixed(2)+' kWh/día generados sobre '+(R.totWh/1000).toFixed(2)+' consumidos');

console.log('\n=== Caso sano: sin avisos espurios ===');
// Criterio anual explícito: con el peor mes harían falta más paneles de los que
// admite un regulador a 12 V, y el aviso correspondiente sería correcto.
base(); S.batId='agm100-12'; S.voltOv='12'; S.hspCriterio='anual';
S.items=[{id:1,device:'Heladera',w:150,qty:1,hd:8,pk:3},{id:2,device:'Luces',w:200,qty:1,hd:5,pk:1}];
R=calc();
chk('no genera avisos', R.avisos.length===0, R.avisos.join(' | ')||'(ninguno)');
chk('el banco es coherente con la tensión', R.batS*R.bat.V===R.volt, R.batS+'S x '+R.batP+'P a '+R.volt+' V');

console.log('\n=== Consumo durante el respaldo ===');
// Off Grid: las baterías son la única fuente, se respalda todo.
base(); S.sysType='offgrid'; S.batId='lfe300-48'; S.autonomy=8;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];   // 8.000 Wh/día
R=calc();
chk('Off Grid respalda el 100% por defecto', R.fracResp===1, 'respaldo='+Math.round(R.whRespDia)+' Wh/día');
const offStore=R.whStore;

// Híbrido: la batería es respaldo ante cortes, sólo cargas esenciales.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.autonomy=8;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('Híbrido respalda el 50% por defecto', R.fracResp===0.5, 'respaldo='+Math.round(R.whRespDia)+' Wh/día');
chk('el banco híbrido queda a la mitad del off-grid', Math.abs(R.whStore-offStore/2)<1e-6,
    Math.round(R.whStore)+' Wh vs '+Math.round(offStore)+' Wh');

// Cargas esenciales marcadas en el Paso 2.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.respaldo='esenciales';
S.items=[{id:1,device:'Heladera',w:150,qty:1,hd:8,pk:3,esencial:true},   // 1.200 Wh
         {id:2,device:'Termotanque',w:2000,qty:1,hd:2,pk:1}];            // 4.000 Wh
R=calc();
chk('usa sólo las cargas marcadas como esenciales', Math.abs(R.whRespDia-1200)<1e-6,
    Math.round(R.whRespDia)+' Wh/día de 5.200 totales');
chk('lo informa en el detalle', /esenciales/.test(R.respaldoFuente), R.respaldoFuente);

// Porcentaje manual.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.respaldo=30;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('respeta el porcentaje elegido a mano', Math.abs(R.whRespDia-2400)<1e-6, Math.round(R.whRespDia)+' Wh/día');

console.log('\n=== Inyección a la red ===');
base(); S.sysType='ongrid'; S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
chk('sin definir la inyección no dimensiona', calc()===null);

S.inyecta=true; R=calc();
const conIny=R.nPan;
chk('con inyección cubre el consumo de 24 h', Math.abs(R.whFV-R.totWh)<1e-6,
    R.nPan+' paneles para '+Math.round(R.whFV)+' Wh');

S.inyecta=false; S.profile='equilibrado'; R=calc();
chk('sin inyección cubre sólo el consumo diurno', Math.abs(R.whFV-R.totWh*0.5)<1e-6,
    R.nPan+' paneles para '+Math.round(R.whFV)+' Wh (50% diurno)');
chk('sin inyección hacen falta menos paneles', R.nPan<conIny, R.nPan+' vs '+conIny);

S.profile='diurno'; R=calc();
chk('el perfil diurno (70%) pide más que el equilibrado', Math.abs(R.whFV-R.totWh*0.7)<1e-6,
    R.nPan+' paneles para '+Math.round(R.whFV)+' Wh');

base(); S.sysType='offgrid'; S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
chk('Off Grid no necesita definir inyección', calc()!==null);

console.log('\n=== Criterio de irradiación (peor mes vs anual) ===');
base(); S.sysType='offgrid'; S.batId='lfe300-48'; S.voltOv='48';
S.items=[{id:1,device:'Casa',w:500,qty:1,hd:10,pk:1}];
R=calc();
chk('Off Grid usa el peor mes por defecto', R.critHsp==='peor'&&R.hsp===2.6,
    'criterio='+R.critHsp+', HSP='+R.hsp+' -> '+R.nPan+' paneles');
const panPeor=R.nPan;
S.hspCriterio='anual'; R=calc();
chk('el promedio anual usa 4,5 HSP', R.hsp===4.5, R.nPan+' paneles');
chk('el peor mes pide más paneles que el anual', panPeor>R.nPan, panPeor+' vs '+R.nPan);

base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48';
S.items=[{id:1,device:'Casa',w:500,qty:1,hd:10,pk:1}];
R=calc();
chk('con red disponible el automático usa el promedio anual', R.critHsp==='anual', 'HSP='+R.hsp);

console.log('\n=== Aporte de la red (cobertura objetivo) ===');
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48';
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];   // 8.000 Wh/día
R=calc();
const pan100=R.nPan;
chk('por defecto cubre el 100% del consumo', R.cobObj===1&&Math.abs(R.whFV-8000)<1e-6,
    R.nPan+' paneles para '+Math.round(R.whFV)+' Wh');
S.coberturaObj=70; R=calc();
chk('al 70% dimensiona sobre 5.600 Wh', Math.abs(R.whFV-5600)<1e-6,
    R.nPan+' paneles para '+Math.round(R.whFV)+' Wh');
chk('y hacen falta menos paneles', R.nPan<pan100, R.nPan+' vs '+pan100);

base(); S.sysType='offgrid'; S.coberturaObj=50; S.batId='lfe300-48';
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('Off Grid ignora la cobertura parcial: no hay red que aporte', R.cobObj===1,
    'cobObj='+R.cobObj+', cubre '+Math.round(R.whFV)+' Wh');

console.log('\n=== Superficie de techo ===');
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.panWp=500;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('un módulo de 500 Wp ocupa 2,5 m²', Math.abs(R.areaMod/R.nPan-2.5)<1e-9,
    R.nPan+' paneles = '+R.areaMod+' m² de módulos');
chk('el techo agrega separación entre filas', Math.abs(R.areaTecho-R.areaMod*1.3)<1e-9,
    R.areaTecho.toFixed(1)+' m² de techo');

console.log('\n=== Retorno de la inversión ===');
// Off Grid no tiene factura previa contra la cual medir el ahorro.
base(); S.sysType='offgrid'; S.batId='lfe300-48';
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
S.quoteItems=[{price:'5000',qty:1,iva:0}];
let roi=calcROI(R,quoteTotals());
chk('en Off Grid el repago no aplica', roi.aplica===false, roi.motivo.slice(0,60)+'...');

// On Grid con inyección: se aprovecha toda la generación.
base(); S.sysType='ongrid'; S.inyecta=true; S.markup=0;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];   // 8.000 Wh/día
R=calc();
S.quoteItems=[{price:'5000',qty:1,iva:0}];
T=quoteTotals();
roi=calcROI(R,T);
const utilEsperado=Math.min(R.whGen,R.whBase)*365/1000;
chk('sólo cuenta la energía aprovechable', Math.abs(roi.utilAnual-utilEsperado)<1e-6,
    Math.round(roi.utilAnual)+' kWh/año');
chk('aplica la porción evitable de la factura',
    Math.abs(roi.ahorroAnual-roi.utilAnual*190*0.6)<1e-6,
    'ARS '+Math.round(roi.ahorroAnual)+'/año');
chk('la inversión sale de la cotización al TC', Math.abs(roi.inversion-5000*1400)<1e-6,
    'ARS '+Math.round(roi.inversion));
chk('el repago es inversión sobre ahorro anual',
    Math.abs(roi.repago-roi.inversion/roi.ahorroAnual)<1e-9, roi.repago.toFixed(1)+' años');

// Generar de más no ahorra más cuando no se puede inyectar.
base(); S.sysType='ongrid'; S.inyecta=false; S.profile='nocturno'; S.markup=0;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
S.quoteItems=[{price:'5000',qty:1,iva:0}];
roi=calcROI(R,quoteTotals());
chk('sin inyección el ahorro se limita al consumo diurno', roi.utilAnual<=R.whBase*365/1000+1e-6,
    Math.round(roi.utilAnual)+' kWh/año sobre un consumo diurno de '+Math.round(R.whBase*365/1000)+' kWh/año');

console.log(fail===0?'\n===== TESTS UNITARIOS OK =====':'\n===== '+fail+' FALLAS =====');
process.exit(fail?1:0);
