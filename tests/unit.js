// Tests del motor de dimensionado y del cálculo de totales.
//   node tests/unit.js
const {calc,quoteTotals,calcROI,paramsModificados,ivaDeTipo,PARAMS_DEF,S}=require('./extract.js')();

let fail=0;
const f1v=n=>Math.round(n*10)/10;
const chk=(n,c,d)=>{if(!c)fail++;console.log((c?'  OK  ':' FALLA')+'  '+n+(d?'\n          '+d:''));};
const base=()=>Object.assign(S,{consumoMode:'equipos',items:[],facturaKwh:0,facturaW:0,
  profile:'equilibrado',hsp:4.5,panWp:500,autonomy:24,autonomyCustom:0,
  batId:'lfe100-48',sysType:'offgrid',voltOv:'auto',markup:20,iva:0,quoteItems:[],
  inyecta:null,respaldo:'auto',hspMin:2.6,hspCriterio:'auto',coberturaObj:100,
  tc:1400,params:JSON.parse(JSON.stringify(PARAMS_DEF))});

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

console.log('\n=== Criterios definidos por el técnico ===');
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48';
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('sin cambios no hay criterios ajustados', paramsModificados().length===0);
const panRef=R.nPan, invRef=R.invReq, areaRef=R.areaMod;

// Performance Ratio: lo define el técnico según la instalación.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.params.prBat=0.60;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('bajar el PR pide más paneles', R.nPan>panRef, R.nPan+' con PR 0,60 vs '+panRef+' con 0,75');
chk('el criterio queda marcado como ajustado', paramsModificados().includes('prBat'), paramsModificados().join(', '));

// Factor de seguridad del inversor.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.params.invSec=1.5;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('subir el factor de seguridad agranda el inversor', R.invReq>invRef,
    Math.round(R.invReq)+' W requeridos con 1,5 vs '+Math.round(invRef)+' W con 1,25');

// Superficie según el módulo real.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.params.wPorM2=230;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('un módulo más eficiente ocupa menos', R.areaMod<areaRef,
    R.areaMod.toFixed(1)+' m² con 230 W/m² vs '+areaRef.toFixed(1)+' m² con 200');

// Fracción diurna del perfil.
base(); S.sysType='ongrid'; S.inyecta=false; S.profile='equilibrado';
S.params.fracEquilibrado=40;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('el perfil usa el porcentaje que cargó el técnico', Math.abs(R.fracDia-0.40)<1e-9,
    Math.round(R.fracDia*100)+'% diurno -> '+Math.round(R.whFV)+' Wh a cubrir');

// Rendimiento del inversor en el banco.
base(); S.sysType='offgrid'; S.batId='lfe300-48'; S.params.etaInv=90;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('el rendimiento del inversor entra en el banco', Math.abs(R.ETA_inv-0.90)<1e-9,
    'eta_inv='+R.ETA_inv+' -> '+Math.round(R.whStore)+' Wh a almacenar');

// Supuestos comerciales del repago.
base(); S.sysType='ongrid'; S.inyecta=true; S.markup=0;
S.params.precioKwh=400; S.params.porcionEvitable=80;
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
S.quoteItems=[{price:'5000',qty:1,iva:0}];
roi=calcROI(R,quoteTotals());
chk('el repago usa los supuestos del técnico',
    Math.abs(roi.ahorroAnual-roi.utilAnual*400*0.8)<1e-6,
    'ARS '+Math.round(roi.ahorroAnual)+'/año, repago '+roi.repago.toFixed(1)+' años');
chk('los dos criterios tocados quedan registrados', paramsModificados().length===2,
    paramsModificados().join(', '));

console.log('\n=== IVA diferenciado por componente ===');
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.quoteItems=[];
S.items=[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];
R=calc();
chk('los paneles llevan alícuota reducida', ivaDeTipo('panel')===10.5, ivaDeTipo('panel')+'%');
chk('el resto lleva la alícuota general',
    ['inv','bat','mppt','estr','cab','mdo','extra'].every(t=>ivaDeTipo(t)===21), '21%');
S.params.ivaPaneles=0;
chk('la alícuota de paneles la define el técnico', ivaDeTipo('panel')===0, '0% tras editarla');
S.params.ivaPaneles=10.5;
S.markup=0;
S.quoteItems=[{price:'1000',qty:1,iva:10.5},{price:'1000',qty:1,iva:21}];
T=quoteTotals();
chk('el total mezcla ambas alícuotas', Math.abs(T.ivaAmt-315)<1e-9,
    'IVA = 105 (panel) + 210 (resto) = '+T.ivaAmt);

console.log('\n=== Recarga del banco (lo que la HSP no cubre) ===');
// Banco chico con mucho panel: la corriente supera lo que admite.
base(); S.sysType='offgrid'; S.batId='agm100-12'; S.voltOv='12'; S.hspCriterio='anual';
S.items=[{id:1,device:'Casa',w:300,qty:1,hd:10,pk:1}];
R=calc();
chk('calcula la corriente de carga disponible', R.iCargaDisp>0,
    f1v(R.iCargaDisp)+' A del generador vs '+f1v(R.iMaxBanco)+' A que admite el banco');
chk('avisa si el generador supera lo que el banco tolera',
    R.iCargaDisp<=R.iMaxBanco||R.avisos.some(a=>a.includes('admite')),
    (R.avisos.find(a=>a.includes('admite'))||'(no hace falta avisar)').slice(0,80));

// Autonomía larga: el banco no se repone en una ventana de sol.
base(); S.sysType='offgrid'; S.batId='lfe300-48'; S.autonomy=72; S.hspCriterio='anual';
S.items=[{id:1,device:'Casa',w:500,qty:1,hd:10,pk:1}];
R=calc();
chk('estima el tiempo de recarga desde vacío', R.tRecarga>0, f1v(R.tRecarga)+' h');
chk('avisa cuando no entra en la ventana de sol útil',
    R.tRecarga<=R.horasSolUtiles||R.avisos.some(a=>a.includes('ventana de sol')),
    (R.avisos.find(a=>a.includes('ventana de sol'))||'(entra en la ventana)').slice(0,80));

// La ventana la define el técnico.
S.params.horasSolUtiles=24; R=calc();
chk('ampliar la ventana quita el aviso de recarga',
    !R.avisos.some(a=>a.includes('ventana de sol')),
    'ventana de 24 h para una recarga de '+f1v(R.tRecarga)+' h');

console.log('\n=== Híbrido: los paneles reconocen el aporte de la red ===');
// 8.000 Wh/día, perfil equilibrado (50% diurno = 4.000 Wh).
const casa=()=>[{id:1,device:'Casa',w:1000,qty:1,hd:8,pk:1}];

// Con inyección el excedente va a la red: se cubren las 24 h.
base(); S.sysType='hybrid'; S.inyecta=true; S.batId='lfe300-48'; S.autonomy=8;
S.items=casa(); R=calc();
chk('con inyección cubre las 24 h', Math.abs(R.whBase-8000)<1e-6,
    Math.round(R.whBase)+' Wh -> '+R.nPan+' paneles');
const panIny=R.nPan;

// Sin inyección: consumo diurno + lo que entre en el banco.
base(); S.sysType='hybrid'; S.inyecta=false; S.batId='lfe100-48'; S.autonomy=8;
S.items=casa(); R=calc();
const esperado=Math.min(8000, 8000*0.5 + R.bankUtil);
chk('sin inyección cubre el diurno más el banco útil', Math.abs(R.whBase-esperado)<1e-6,
    '4.000 diurno + '+Math.round(R.bankUtil)+' de banco = '+Math.round(R.whBase)+' Wh');
chk('no dimensiona ya como si cubriera las 24 h', R.whBase<8000,
    Math.round(R.whBase)+' < 8.000 Wh');
chk('lo explica en critFV', /red/.test(R.critFV), R.critFV);

// Donde el efecto se nota: consumo nocturno (sólo 30% diurno) y banco chico.
base(); S.sysType='hybrid'; S.inyecta=true; S.profile='nocturno';
S.batId='lfe100-48'; S.autonomy=8; S.items=casa(); R=calc();
const panIny2=R.nPan;
S.inyecta=false; R=calc();
chk('con perfil nocturno y banco chico, pide menos paneles', R.nPan<panIny2,
    R.nPan+' sin inyección vs '+panIny2+' con inyección  ('+Math.round(R.whBase)+' Wh aprovechables de 8.000)');

// Con un banco grande el excedente entra entero: vuelve a cubrir las 24 h.
base(); S.sysType='hybrid'; S.inyecta=false; S.batId='lfe300-48'; S.autonomy=24;
S.items=casa(); R=calc();
chk('con banco grande vuelve a cubrir las 24 h', Math.abs(R.whBase-8000)<1e-6,
    'banco útil '+Math.round(R.bankUtil)+' Wh -> cubre '+Math.round(R.whBase)+' Wh');

// El cambio no debe afectar a los otros tipos de sistema.
base(); S.sysType='offgrid'; S.batId='lfe300-48'; S.items=casa(); R=calc();
chk('Off Grid sigue cubriendo el 100%', Math.abs(R.whBase-8000)<1e-6, R.critFV);
base(); S.sysType='ongrid'; S.inyecta=false; S.items=casa(); R=calc();
chk('On Grid sin inyección sigue en el diurno', Math.abs(R.whBase-4000)<1e-6, R.critFV);
base(); S.sysType='ongrid'; S.inyecta=true; S.items=casa(); R=calc();
chk('On Grid con inyección sigue en 24 h', Math.abs(R.whBase-8000)<1e-6, R.critFV);

console.log(fail===0?'\n===== TESTS UNITARIOS OK =====':'\n===== '+fail+' FALLAS =====');
process.exit(fail?1:0);
