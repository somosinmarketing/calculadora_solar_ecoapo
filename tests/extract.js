// Extrae del HTML las partes calculables (constantes, estado y motor) para
// poder testearlas en Node sin navegador. El simulador es un único archivo
// autocontenido, así que no hay módulos que importar: se recortan por marcas
// de comentario. Si movés esas secciones, actualizá los cortes de acá.
const fs=require('fs'),path=require('path'),vm=require('vm');
const HTML=path.join(__dirname,'..','calculadorasolar.html');

function corte(src,desde,hasta){
  const a=src.indexOf(desde), b=src.indexOf(hasta);
  if(a<0||b<0||b<=a)throw new Error('No se encontró la sección: '+desde);
  return src.slice(a,b);
}

module.exports=function cargarMotor(){
  const src=fs.readFileSync(HTML,'utf8');
  const code=
    corte(src,'// ── CONSTANTS','// ── STEPPER RENDER')
      .replace('const $=id=>document.getElementById(id);','const $=()=>null;')
    +corte(src,'// ── CALCULATION ENGINE','// ── STEP 6:')
    +src.match(/function quoteTotals\(\)\{[\s\S]*?\n\}/)[0]
    +src.match(/function calcROI\(R,T\)\{[\s\S]*?\n\}/)[0]
    +src.match(/function paramsModificados\(\)\{[\s\S]*?\n\}/)[0]
    +src.match(/function ivaDeTipo\(tipo\)\{[\s\S]*?\n\}/)[0]
    +corte(src,'// ── QUOTE: QUÉ VE CADA DESTINATARIO','// ── QUOTE: SINCRONIZACIÓN');
  const ctx={module:{},console};
  vm.createContext(ctx);
  vm.runInContext(code+'\n;this.calc=calc;this.quoteTotals=quoteTotals;this.calcROI=calcROI;this.paramsModificados=paramsModificados;this.ivaDeTipo=ivaDeTipo;this.lineasCliente=lineasCliente;this.pedidoEcoapo=pedidoEcoapo;this.itemsSinPrecio=itemsSinPrecio;this.PARAMS_DEF=PARAMS_DEF;this.S=S;',ctx);
  return ctx;
};
