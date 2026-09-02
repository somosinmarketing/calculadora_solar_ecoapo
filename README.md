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
node tests/unit.js     # motor de dimensionado y totales de la cotización
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
| Paneles | `Wp = Wh_día ÷ (PR × HSP)`, con PR 0,80 on-grid y 0,75 con baterías |
| Inversor | mayor entre `P_nominal × 1,25` y `P_pico ÷ 2` (sobrecarga de arranque) |
| Baterías | `Wh = (Wh_día ÷ 24 × horas) ÷ DoD ÷ η_bat ÷ η_inv`, η_inv = 0,94 |
| MPPT | `I = P_paneles ÷ V_sistema × 1,25` |
| Cotización | markup sobre el costo neto; IVA sobre el precio de venta |

### Limitaciones conocidas

- El dimensionado usa la **HSP promedio anual**. Para sistemas off-grid lo
  correcto es diseñar sobre el peor mes (junio), o el sistema queda corto en
  invierno. No está implementado.
- El modo **híbrido** se calcula igual que off-grid: no considera el aporte de
  la red.
- No calcula retorno de inversión, ahorro mensual ni superficie de techo.
- El consumo por factura estima la potencia simultánea con un factor de carga;
  es una estimación y conviene cargar la potencia real cuando se conoce.
