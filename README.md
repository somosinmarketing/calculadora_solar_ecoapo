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

### Supuestos a validar

Estos valores son de referencia y conviene que EcoApo los revise contra sus
propios datos. Están todos juntos arriba del script, como constantes.

- **HSP del peor mes** (`REGIONS[].hspMin`): estimados por región. Para un
  proyecto ejecutivo hay que validarlos con datos del sitio (SEGEMAR / INTA /
  PVGIS) y cargarlos a mano en el Paso 4.
- **Precio del kWh** (`PRECIO_KWH_DEF`, ARS 190) y **porción evitable de la
  factura** (`PORCION_EVITABLE_DEF`, 60%): mueven el repago directamente.
  Revisar al menos cada 3 meses; las tarifas argentinas se mueven.
- **Superficie** (`W_POR_M2`, `FACTOR_TECHO`): asumen módulo cristalino actual
  y montaje con separación entre filas.
- **Factor de carga** (`FACTOR_CARGA`, 15%): estima la potencia simultánea a
  partir de la energía cuando el consumo se carga desde la factura. Conviene
  cargar la potencia real cuando se conoce.

### Limitaciones conocidas

- El repago es **simple**: no contempla inflación, actualización de tarifas,
  financiamiento, degradación de los módulos ni mantenimiento.
- La superficie de techo es una estimación por potencia; no considera la
  geometría real del techo, sombras ni obstáculos.
