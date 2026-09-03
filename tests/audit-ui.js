// Auditoría de interfaz: mide en Chromium a ancho de teléfono y de escritorio,
// recorriendo los 9 pasos con un proyecto cargado.
//   node tests/audit-ui.js
//
// Criterios:
//  - Sin scroll horizontal de página.
//  - Objetivos táctiles de 44px o más (mínimo recomendado para uso con el dedo).
//    Se mide el área ACTIVA: si el control está dentro de un <label>, el área
//    es la del label, no la del control nativo.
//  - Campos de texto con font-size de 16px o más: por debajo de eso, Safari en
//    iPhone hace zoom automático al enfocarlos. No aplica a checkbox ni radio,
//    que no abren teclado.
function cargarPlaywright(){
  const c=['playwright','/opt/node22/lib/node_modules/playwright',
    '/usr/lib/node_modules/playwright','/usr/local/lib/node_modules/playwright'];
  for(const x of c){try{return require(x);}catch(e){}}
  console.error('Falta playwright. Instalalo con:  npm i -D playwright');process.exit(2);
}
const {chromium}=cargarPlaywright();
const FILE='file://'+require('path').join(__dirname,'..','calculadorasolar.html');

const seed=()=>{
  localStorage.clear();
  Object.assign(S,{project:{name:'Familia Gómez',location:'Mendoza',type:'Vivienda'},
    items:[{id:1,device:'Heladera clase A',w:150,qty:1,hd:8,pk:3,esencial:true},
           {id:2,device:'Luces interior conjunto',w:360,qty:1,hd:5,pk:1,esencial:true},
           {id:3,device:'Aire acond. 3500 inverter',w:2000,qty:1,hd:6,pk:2.5},
           {id:4,device:'Termotanque electrico',w:2000,qty:1,hd:3,pk:1}],
    sysType:'hybrid',inyecta:true,batId:'lfe200-48',autonomy:8,respaldo:'esenciales'});
  S.results=calc(); S.quoteItems=[];
};

async function auditar(pg){
  const out=[];
  for(let paso=1;paso<=9;paso++){
    await pg.evaluate(p=>{CUR=p;if(p>=7)S.results=calc();
      renderMain();renderStepper();
      if(p===7){S.quoteItems.forEach((it,i)=>{it.price=String([230,1500,1100,340,95,180,700][i]||100);});renderMain();}
    },paso);
    await pg.waitForTimeout(120);
    out.push({paso,...await pg.evaluate(()=>{
      const areaActiva=el=>{
        const lb=el.closest('label');            // el label amplía el área tocable
        return (lb||el).getBoundingClientRect();
      };
      const chicos=[];
      document.querySelectorAll('#main button, #main select, #main input, #main .rc, #main .rg-btn, #bot-nav button, #scorm-bar button, .stp')
        .forEach(el=>{const b=areaActiva(el);
          if(b.height>0&&b.height<44)chicos.push({t:el.tagName.toLowerCase()+(el.className?'.'+String(el.className).split(' ')[0]:''),h:Math.round(b.height)});});
      const zoomIOS=[];
      document.querySelectorAll('input,select,textarea').forEach(el=>{
        if(/checkbox|radio/i.test(el.type||''))return;   // no abren teclado
        const fs=parseFloat(getComputedStyle(el).fontSize);
        if(fs<16&&el.offsetParent)zoomIOS.push(Math.round(fs*10)/10);});
      const chico=[];
      document.querySelectorAll('#main *').forEach(el=>{
        if(!el.children.length&&el.textContent.trim()){
          const fs=parseFloat(getComputedStyle(el).fontSize);
          if(fs<12)chico.push(Math.round(fs*10)/10);}});
      return {scrollH:document.documentElement.scrollWidth>window.innerWidth+1,
        tactilChicos:chicos.length, peorTactil:chicos.length?Math.min(...chicos.map(c=>c.h)):null,
        ejemplos:chicos.slice(0,3),
        inputsZoom:zoomIOS.length, minInput:zoomIOS.length?Math.min(...zoomIOS):null,
        textoChico:chico.length, minTexto:chico.length?Math.min(...chico):null};
    })});
  }
  return out;
}

(async()=>{
  const b=await chromium.launch(); let problemas=0;
  for(const [nombre,vp,mob] of [['TELÉFONO 375x812',{width:375,height:812},true],
                                ['ESCRITORIO 1440x900',{width:1440,height:900},false]]){
    const pg=await b.newPage({viewport:vp,isMobile:mob,hasTouch:mob});
    await pg.goto(FILE); await pg.evaluate(seed);
    const res=await auditar(pg);
    console.log('\n===== '+nombre+' =====');
    console.log('paso | scroll horiz | táctil<44px (peor) | campos<16px | texto<12px');
    res.forEach(r=>{
      if(r.scrollH||r.tactilChicos||r.inputsZoom)problemas++;
      console.log(` ${r.paso}   |     ${r.scrollH?'SÍ ⚠':'no '}      | ${String(r.tactilChicos).padStart(3)} (${String(r.peorTactil??'-').padStart(3)}px) |`+
        ` ${String(r.inputsZoom).padStart(3)} (${r.minInput??'-'}px) | ${String(r.textoChico).padStart(3)} (${r.minTexto??'-'}px)`);
      if(r.tactilChicos)console.log('      ejemplos:',JSON.stringify(r.ejemplos));
    });
    await pg.close();
  }
  await b.close();
  console.log(problemas===0
    ? '\n===== SIN PROBLEMAS DE ERGONOMÍA =====\n(texto<12px es P2 del plan y no cuenta como problema acá)'
    : '\n===== '+problemas+' paso(s) con problemas =====');
  process.exit(problemas?1:0);
})();
