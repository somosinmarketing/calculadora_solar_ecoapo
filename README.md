# Simulador FV ECOAPO

Simulador de diseño y cotización fotovoltaica en 9 pasos. Es un **único archivo
HTML autocontenido**: jsPDF, jspdf-autotable y SheetJS van embebidos, así que
funciona sin conexión y sin dependencias externas.

## Dónde está publicado

<https://ecoaposolar.com/calculadorasolar.html>

El link se compartió con alumnos de los cursos y se usó en campañas: **no debe
cambiar**. El archivo de este repo se llama igual que en producción para que el
mapeo sea directo.

## Deploy

El sitio `ecoaposolar.com` está en Hostinger y su repo
(`somosinmarketing/ecoapo-landing-kits-solares`) **no incluye este archivo**: la
calculadora se subió a mano y se sigue actualizando así.

1. Descargar `calculadorasolar.html` de este repo.
2. Subirlo por FTP / File Manager a `public_html/calculadorasolar.html`,
   sobrescribiendo el anterior. Permisos `644`.
3. Verificar en <https://ecoaposolar.com/calculadorasolar.html>.

> El `.htaccess` del sitio sirve el HTML con `Cache-Control: max-age=3600`.
> Después de subir, puede tardar hasta **una hora** en verse el cambio para
> quien ya había abierto la página. Para verificar al instante: recarga forzada
> (Ctrl-F5) o ventana de incógnito.

Este repo es la fuente de verdad. Antes de tocar el archivo en el hosting,
commiteá el cambio acá: es lo que permite revertir si algo sale mal.

## Tests

```bash
node tests/unit.js     # motor de dimensionado, respaldo, inyección y totales
node tests/smoke.js    # recorrido end-to-end en Chromium (requiere playwright)
```

`tests/extract.js` recorta las secciones calculables del HTML por marcas de
comentario para poder ejecutarlas en Node. Si reordenás esas secciones, hay que
actualizar los cortes.

## Criterios de cálculo

Las constantes de diseño están juntas arriba del script y los textos de ayuda
las interpolan, para que la fórmula que se muestra sea siempre la que se usa.

| Concepto | Criterio |
|---|---|
| Paneles | `Wp = Wh_a_cubrir ÷ (PR × HSP)`, con PR 0,80 on-grid y 0,75 con baterías |
| Energía a cubrir | Consumo de 24 h con inyección o con baterías; sólo la fracción diurna en On Grid sin inyección. Se multiplica por la cobertura objetivo |
| Cobertura objetivo | % del consumo que cubre el FV; el resto lo aporta la red. Siempre 100% en Off Grid |
| Irradiación | Peor mes (junio) en Off Grid, promedio anual con red disponible. Configurable |
| Fracción diurna | Según el perfil del Paso 3: diurno 70%, equilibrado 50%, nocturno 30% |
| Inversor | mayor entre `P_nominal × 1,25` y `P_pico ÷ 2` (sobrecarga de arranque) |
| Baterías | `Wh = (Wh_respaldo ÷ 24 × horas) ÷ DoD ÷ η_bat ÷ η_inv`, η_inv = 0,94 |
| Consumo respaldado | Cargas marcadas como esenciales, o un porcentaje. Por defecto 100% en Off Grid y 50% en Híbrido |
| Superficie | 200 W/m² de módulo, × 1,3 para separación entre filas |
| Repago | `inversión ÷ (kWh aprovechados × precio kWh × porción evitable)`. No aplica en Off Grid |
| MPPT | `I = P_paneles ÷ V_sistema × 1,25` |
| Cotización | markup sobre el costo neto; IVA sobre el precio de venta |

### Criterios de cálculo

**Ningún criterio está fijo en el código.** Los define el técnico que arma el
presupuesto, desde el botón **⚙ Criterios** de la barra superior: dependen del
equipo que se cotiza, del tipo de montaje y de la política comercial.

`PARAMS_DEF` sólo aporta valores de arranque. Cada campo muestra su valor de
referencia debajo, los modificados quedan resaltados, y hay un botón para
restaurarlos todos.

| Grupo | Criterios |
|---|---|
| Generación | Performance Ratio con baterías y On Grid, W/m² de módulo, factor de superficie de techo |
| Inversor y regulador | Factor de seguridad, sobrecarga de arranque tolerada, rendimiento del inversor, tensión máx. de entrada MPPT |
| Baterías | Round-trip LiFePO4 y AGM/Gel |
| Consumo | Fracción diurna por perfil, factor de carga |
| Retorno de inversión | Precio del kWh, porción evitable de la factura |

Los criterios que se apartan de la referencia quedan asentados en la propuesta
y en el PDF, en una sección aparte, para que la decisión sea trazable.

Fuera del panel, también se definen por proyecto: HSP anual y de invierno más
el criterio de diseño (Paso 4), tipo de sistema, inyección, cobertura solar
objetivo y consumo respaldado (Paso 5), y las cargas esenciales (Paso 2).

**A validar contra datos propios:** las HSP del peor mes (`REGIONS[].hspMin`)
son estimadas por región; para un proyecto ejecutivo conviene cargarlas a mano
desde datos del sitio (SEGEMAR / INTA / PVGIS). El precio del kWh y la porción
evitable mueven el repago directamente: revisarlos al menos cada 3 meses.

### Limitaciones conocidas

- El repago es **simple**: no contempla inflación, actualización de tarifas,
  financiamiento, degradación de los módulos ni mantenimiento.
- La superficie de techo es una estimación por potencia; no considera la
  geometría real del techo, sombras ni obstáculos.
