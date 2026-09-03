# Plan de revisión del front end

Auditoría instrumentada sobre `calculadorasolar.html`, medida en Chromium a
375×812 (teléfono) y 1440×900 (escritorio), recorriendo los 9 pasos con un
proyecto cargado.

La mayoría de los usuarios entra desde el teléfono, así que la prioridad es
mobile. **No hay scroll horizontal de página en ningún paso** — eso está bien.
Todo lo demás está abajo.

## Lo que se midió

| Paso | Objetivos táctiles < 44px (peor) | Inputs < 16px (menor) | Texto < 11px (menor) |
|---|---|---|---|
| 1 | 8 (23px) | 3 (13px) | 4 (10px) |
| 2 | 36 (**8px**) | 23 (11,5px) | 7 (10px) |
| 3 | 5 (23px) | — | 4 (10px) |
| 4 | 9 (23px) | 4 (13px) | 17 (10px) |
| 5 | 11 (23px) | 6 (13px) | 11 (10px) |
| 6 | 5 (23px) | — | 22 (10px) |
| 7 | 47 (**17px**) | 32 (12px) | 22 (**9,5px**) |
| 8 | 5 (23px) | — | 1 (10px) |
| 9 | 6 (23px) | — | 8 (10px) |

Desbordes de tabla a 375px:

- Paso 2: tabla de 460px en un contenedor de 353px
- Paso 7: tabla de 535px en un contenedor de 323px
- Stepper: 793px de ancho en una pantalla de 375px

---

## P0 — Rompe el uso en teléfono

### 1. Los totales de la cotización no se ven en mobile

La tabla del Paso 7 mide 535px dentro de 323px. Las columnas de importes quedan
fuera del área visible, así que el pie muestra "Subtotal materiales", "+ Markup",
"Precio de venta" y "TOTAL FINAL" **sin ningún número**. Hay que scrollear la
tabla en horizontal para ver cuánto sale el sistema. Es un fallo funcional: la
pantalla existe para mostrar un precio y en teléfono no lo muestra.

**Qué hacer:** por debajo de ~600px, reemplazar la tabla por tarjetas apiladas,
una por componente, con el nombre completo en una línea y los campos (cantidad,
precio unitario, IVA) debajo. Los totales pasan a un bloque propio, fuera de la
tabla, siempre visible y legible sin scroll lateral. En escritorio se conserva
la tabla actual.

### 2. La tabla de consumos tiene el mismo problema

460px en 353px: la columna "Wh/día" y el botón de eliminar quedan fuera. El
usuario carga equipos sin ver cuánto consume cada uno.

**Qué hacer:** mismo criterio. En mobile, una tarjeta por equipo con el nombre
completo arriba y los campos W / cantidad / horas / esencial en una grilla
debajo, más el Wh/día calculado bien visible.

### 3. iOS hace zoom cada vez que se toca un campo

Todos los `input`, `select` y `textarea` tienen `font-size` entre 11,5px y 13px.
Safari en iPhone hace zoom automático al enfocar cualquier campo con menos de
16px, y deja la página descuadrada. Con 32 campos en el Paso 7, se repite en
cada toque.

**Qué hacer:** `font-size: 16px` en todos los controles de formulario. Es el
cambio de mayor impacto por línea tocada de todo el plan.

---

## P1 — Ergonomía táctil

### 4. Objetivos táctiles por debajo del mínimo

El mínimo recomendado es 44px de alto (Apple) / 48dp (Material). Acá:

- Checkbox "Resp." del Paso 2: **33×8px**. Prácticamente imposible de acertar.
- Botones de la barra de acciones del Paso 7: 17–25px.
- Botón de eliminar fila: 23px.
- Botones "+ Agregar", "+ Personalizado": 25px.

**Qué hacer:** altura mínima 44px en todo lo tocable. Para los checkbox, ampliar
el área activa con un `<label>` que envuelva la celda entera, no solo el cuadrito.

### 5. La barra superior se apila y come pantalla

En 375px el título parte en dos líneas y los tres botones (Criterios, Nuevo,
Marcar completo) se acomodan abajo. Ocupa ~170px antes de que empiece el
contenido.

**Qué hacer:** en mobile, dejar el logo y un título corto; agrupar las acciones
en un menú compacto o reducirlas a iconos con etiqueta accesible.

### 6. El stepper obliga a scrollear

Necesita 793px para 9 pasos en una pantalla de 375px. Se ve poco más de un
tercio del recorrido y no se percibe dónde estás.

**Qué hacer:** en mobile, reemplazarlo por un indicador compacto —barra de
progreso con "Paso 3 de 9 · Perfil"— y dejar el stepper completo en escritorio.

---

## P2 — Modernización visual

### 7. Escala tipográfica

Base de 14px y textos de hasta 9,5px. Se lee incómodo en teléfono y hace ver la
herramienta anticuada en escritorio.

**Qué hacer:** base 16px, ningún texto por debajo de 12px, y una escala
tipográfica definida en variables CSS en lugar de tamaños sueltos por regla.

### 8. La barra de beneficios ocupa demasiado

Seis píldoras de marketing fijas sobre la navegación, ~150px de alto en mobile,
presentes en los 9 pasos. Compite con la herramienta en la pantalla más chica.

**Qué hacer:** en mobile, mostrarla solo en el Paso 1 y en el 9, o colapsarla a
una línea. En escritorio puede quedarse.

### 9. Sistema visual

Espaciado, radios y sombras aplicados regla por regla. Conviene consolidar en
variables (escala de espaciado, dos niveles de elevación, radios coherentes),
revisar contraste de los grises sobre fondo claro, y dar estado de foco visible
a todo lo interactivo.

### 10. Opcional: modo oscuro

`prefers-color-scheme`. Todo el color ya sale de variables en `:root`, así que
es acotado. Solo si lo anterior está cerrado.

---

## Restricciones — no negociables

1. **Un solo archivo HTML autocontenido.** Sin CDN, sin build, sin frameworks.
   jsPDF, autotable y SheetJS siguen embebidos. Tiene que funcionar offline.
2. **No tocar la lógica de cálculo.** Nada dentro de `calc()`, `quoteTotals()`,
   `calcROI()`, `syncQuoteWithDesign()` ni el parseo de listas de precios.
3. **No cambiar los `id` que el JS busca.** Entre otros: `main`, `step-list`,
   `prog-fill`, `step-counter`, `btn-prev`, `btn-next`, `items-body`,
   `items-foot`, `cons-summary`, `q-sub-usd`, `q-mark-usd`, `q-sale-usd`,
   `q-iva-usd`, `q-grand-usd`, `q-grand-ars`, `roi-cards`, `params-body`,
   `factura-daily`, `factura-result`, `wh-<id>`, `qt-<id>`, `qa-<id>`,
   `iv-<id>`. Si algo se reestructura, los ids deben seguir existiendo y
   actualizándose igual.
4. **No romper el patrón de actualización puntual.** Los campos que se editan
   tipeando (precio, cantidad, IVA, TC, markup, criterios del ROI) actualizan
   celdas concretas y **no** llaman a `renderMain()`, porque eso le saca el foco
   al campo. Hay un test que lo verifica.
5. **SCORM 1.2 intacto:** `scormComplete()`, `btn-scorm-done`, `scorm-time` y el
   `onbeforeunload`.
6. **La URL no cambia.** El archivo se sigue llamando `calculadorasolar.html`.
7. **Los tests tienen que seguir pasando**, sin relajarlos para que pasen:
   ```
   node tests/unit.js     # 60 chequeos de cálculo
   node tests/smoke.js    # recorrido en Chromium
   ```
   `tests/extract.js` recorta secciones del HTML por marcas de comentario: si se
   mueven esas secciones, hay que actualizar los cortes.

## Verificación al terminar

1. `node tests/unit.js` y `node tests/smoke.js` en verde.
2. Re-correr la auditoría a 375×812 y 1440×900: sin scroll horizontal, ningún
   input por debajo de 16px, ningún objetivo táctil por debajo de 44px, ningún
   texto por debajo de 12px.
3. Capturas de los pasos 2, 6 y 7 en ambos anchos.
4. Confirmar a ojo que en el Paso 7 en mobile **se ve el total sin scrollear en
   horizontal**.

## Orden sugerido

P0 completo y verificado antes de tocar P1. P2 al final, que es donde entra el
criterio estético y conviene revisarlo con capturas antes de seguir.
