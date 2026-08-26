# Teoría y metodología de Umbral

> Contenido fuente para la sección "Teoría" de la app. Cada entrada explica el *por qué* detrás de una regla o cálculo que el motor ya aplica. Los valores numéricos exactos viven en `src/domain/config.ts` — este documento es la explicación en lenguaje humano, no la fuente de los cálculos.

---

## 1. Cómo se mide el esfuerzo

### 1.1 Las dos escalas de RPE

Umbral usa dos escalas subjetivas para registrar cómo se sintió un entrenamiento:

- **Intensidad (1 a 10):** qué tan duro fue el trabajo. 1 es caminar sin esfuerzo, 10 es el máximo esfuerzo absoluto.
- **Sensación (caritas, 1 a 5):** cómo se sintió el cuerpo en general después del entrenamiento, más allá de la intensidad puntual.

Estas dos escalas son el eje principal de la app porque, a diferencia de un sensor de pulsaciones, no dependen del hardware del reloj — dependen de vos, y con calibración se vuelven muy precisas.

### 1.2 Por qué cuesta sentir las zonas intermedias

Es común que al principio solo distingas el 1 (muy fácil) y el 10 (al límite), sin poder ubicar bien las zonas intermedias. Esto se entrena. Un protocolo simple para "despertar" la sensibilidad a las zonas medias:

1. 10 repeticiones de 1 minuto a RPE 5, seguidas de 1 minuto a RPE 1.
2. Luego, 3 repeticiones de 3 minutos a RPE 7, con recuperación trotando a RPE 3.
3. Test de verificación: 5 minutos en Z1, 5 minutos en Z3, 5 minutos en Z5, 5 minutos en Z7 — sin llegar nunca a RPE 10.

Con la práctica, vas a poder ubicar tu esfuerzo en la escala con precisión, sin depender de mirar el reloj.

---

## 2. Los tests de umbral

Se descarta por completo la fórmula "220 − edad" para estimar zonas, porque es una aproximación poblacional que no refleja tu fisiología real. En su lugar, Umbral usa el **modelo de Joe Friel for Running**, anclado en tu propio umbral de lactato.

### 2.1 Test de umbral de FC (para calcular tu LTHR)

Correr de forma constante al máximo esfuerzo sostenible durante 30 minutos, y tomar el promedio de FC de los **últimos 20 minutos**. Alternativa más corta: correr 20 minutos al máximo sostenible y restarle un 5% al promedio.

Ese valor es tu **LTHR** (frecuencia cardíaca de umbral de lactato) — el ancla de la que se derivan las 7 zonas de FC.

### 2.2 Test de umbral de pace (opcional, recomendado)

Correr 20 minutos de forma constante y rápida. Tomar el pace promedio obtenido y sumarle un 5% de tiempo (multiplicar el pace en segundos por 1.05). Ese resultado representa la velocidad exacta que podés sostener durante 60 minutos — el límite superior de la Zona 4.

### 2.3 Por qué 20-30 minutos y no menos

El umbral de lactato es, fisiológicamente, el punto donde el cuerpo deja de poder oxidar lactato a la velocidad que lo produce. Ese punto se ubica, en la mayoría de los corredores, en la zona de los 40 a 60 minutos de esfuerzo máximo sostenible — pero medirlo directamente ahí sería agotador de repetir. Los tests de 20-30 minutos son una forma práctica de aproximarse a ese punto sin necesitar una hora de esfuerzo máximo.

---

## 3. Las 7 zonas de Joe Friel

Cada zona se define como un porcentaje de tu LTHR, y tiene tres referencias distintas para ubicarte: frecuencia cardíaca, pace, y percepción de esfuerzo (RPE + test del habla). Como el sensor de FC de muchos relojes es poco confiable, el RPE y el test del habla son las referencias más robustas.

| Zona | Nombre | % LTHR | RPE | Test del habla |
|------|--------|--------|-----|-----------------|
| Z1 | Recuperación | < 85% | 1-3 | Muy fácil |
| Z2 | Aeróbico | 85-89% | 4-5 | Conversacional |
| Z3 | Tempo | 90-94% | 6 | Incómodo pero sostenible hasta 90 min |
| Z4 | Sub-umbral | 95-99% | 7 | Velocidad controlada, alguna palabra suelta; sostenible 40-60 min máx |
| Z5a | Super-umbral | 100-102% | 8 | Fuerte sostenido, alguna palabra; sostenible ~20-25 min |
| Z5b | Capacidad aeróbica | 103-106% | 9 | Duro, alguna palabra si te esforzás; esfuerzos hasta 4 min máx |
| Z5c | Capacidad anaeróbica | 106%+ | 10 | Muy duro/máximo; 10 segundos máx, no podés hablar |

### 3.1 Qué entrena cada zona

- **Z1-Z2** desarrollan la capacidad aeróbica de base: la habilidad del cuerpo de usar oxígeno eficientemente y quemar grasa como combustible. Es la zona donde se corre la mayoría del volumen.
- **Z3** es una zona de transición — mejora la eficiencia pero no es tan específica como Z4-Z5 para el umbral, ni tan regenerativa como Z1-Z2. Se usa con moderación.
- **Z4-Z5a** entrenan directamente el umbral de lactato: la capacidad de sostener esfuerzos cerca del punto de quiebre sin acumular fatiga descontrolada.
- **Z5b-Z5c** entrenan la capacidad aeróbica máxima y anaeróbica: esfuerzos cortos e intensos que mejoran el techo de potencia, no la base.

---

## 4. Los cuatro gráficos que explican el sistema

### 4.1 Curva de producción de energía

Si graficás cuánta energía puede producir el cuerpo (en pace, FC o potencia) contra cuánto tiempo sostenés ese esfuerzo, obtenés una curva que cae rápido al principio y se aplana después. En los primeros segundos la producción de energía es altísima (esfuerzos anaeróbicos cortos); entre los 5 y 10 minutos se ubica el pico del VO2 máx; y entre los 40 y 60 minutos ocurre el cambio de forma más importante de la curva — el punto donde el cuerpo deja de poder oxidar lactato eficientemente. Ese punto es, precisamente, tu umbral de lactato. Las zonas Z1 a Z4 viven por debajo de ese punto (esfuerzos sostenibles); las zonas Z5a-Z5c viven por encima (esfuerzos de menos de 30 minutos).

### 4.2 Ciclo de homeostasis y supercompensación

Este es el gráfico detrás del motor de adaptación de la app. Tu condición física se puede pensar como una línea horizontal estable (tu nivel base). Cuando entrenás, aplicás una carga que hace **caer** esa línea temporalmente — es la fatiga y el desgaste inmediato del entrenamiento. Durante el descanso, la curva no solo vuelve al nivel base: lo **supera**, llegando a un pico por encima de donde estaba antes. Ese pico es la supercompensación, y es donde debería caer tu próximo entrenamiento de la misma zona para consolidar la mejora.

Si entrenás de nuevo *antes* de llegar a ese pico (sin haber descansado lo suficiente), la curva tiende a un declive crónico — es el mecanismo del sobreentrenamiento. Si esperás *demasiado*, la curva se aplana sin ganancia neta. El motor de adaptación de la app existe justamente para estimar ese punto óptimo y ajustar el plan cuando se desvía.

### 4.3 Volumen vs. rendimiento

Si graficás el volumen semanal de kilómetros contra los tiempos de carrera de un grupo grande de corredores, aparece una correlación clara: a mayor volumen sostenido, mejor rendimiento. Pero la relación no es causal en el sentido ingenuo de "corré más kilómetros y vas a ser más rápido de inmediato" — los corredores de alto rendimiento llegan a esos volúmenes altos después de años de progresión gradual. El volumen alto es la consecuencia de una base bien construida, no el atajo para construirla. Por eso la progresión de volumen de la app es siempre gradual y nunca salta etapas.

### 4.4 El sistema como caja negra

Podés pensar tu entrenamiento como un sistema con tres partes: **entrada** (la carga que aplicás — pace, zona, duración), **proceso** (tu fisiología, invisible desde afuera), y **salida** (el resultado medible — tu FC, tu RPE, tu sensación). La forma de saber si un plan está funcionando es comparar entrada y salida a lo largo del tiempo: si para la misma entrada (por ejemplo, un pace constante en Z2), la salida mejora (tu FC baja para ese mismo pace, o tu RPE baja), significa que tu cuerpo asimiló la carga y hay progreso real. Esta comparación es exactamente lo que hace la sección "Caja Negra" de la app.

---

## 5. Tipos de entrenamiento

| Código | Nombre | Objetivo | Duración típica | Zonas |
|--------|--------|----------|------------------|-------|
| F | Largo / Fondo | Capacidad aeróbica, volumen | 30 min a varias horas | Z1, Z2 |
| E | Específico | Adaptación fisiológica y biomecánica (series, intervalos) | 20 min a 1h30 | Z3, Z4, Z5 |
| R | Recuperación | Activa; lavado de lactato, recuperación sistémica | 5 min a 1h | Z1 estricto |
| D | Descanso pasivo | Asimilación total (homeostasis) | — | — |

---

## 6. Las reglas inquebrantables del microciclo

Estas cuatro reglas son las que el motor valida en cada semana generada, y las que protegen la estructura ante cualquier ajuste automático:

1. **Después de un Largo (F), nunca un Específico.** Solo se permite Recuperación (R) o Descanso (D) al día siguiente. El cuerpo necesita procesar el volumen antes de un nuevo estímulo de calidad.
2. **Nunca dos Específicos (E) consecutivos.** Siempre debe mediar un R o un D entre dos entrenamientos de calidad — de lo contrario no hay tiempo de asimilar ninguno de los dos.
3. **Los Recuperación (R) son comodines.** Se pueden mover de día según tu agenda sin alterar el impacto sistémico del plan — son la parte más flexible de la semana.
4. **Toda semana necesita al menos un Descanso pasivo (D) absoluto.** Es el mínimo indispensable para garantizar ganancia metabólica real, más allá de cuántos días entrenes.

---

## 7. Dinámica de cargas del mesociclo

Un mesociclo son 4 semanas. La forma en que se reparte la carga entre esas semanas determina el riesgo de sobreentrenamiento:

| Esquema | Semana 1 | Semana 2 | Semana 3 | Semana 4 | Riesgo |
|---------|----------|----------|----------|----------|--------|
| 1:1 | Carga | Descarga | Carga+ | Descarga | Alto — picos difíciles de asimilar |
| 2:1 | Carga | Carga+ | Descarga | — | Medio — usado por corredores de élite |
| **3:1** | Carga | Carga+ | Carga++ | Descarga | **Bajo/óptimo — progresión continua y segura (default de la app)** |

El esquema 3:1 acumula carga progresivamente durante tres semanas antes de descargar, dando al cuerpo más tiempo de adaptación gradual entre picos de fatiga.

---

## 8. Macrociclos por distancia objetivo

| Distancia | Ciclo de base inicial | Duración total del macrociclo | Descanso post-carrera |
|-----------|------------------------|-------------------------------|------------------------|
| 5 km | 4 semanas | 16 semanas | 1-3 semanas |
| 10 km | 6 semanas | 20 semanas | 2-4 semanas |
| Media maratón | 8 semanas | 24 semanas | 3-5 semanas |
| Maratón | 12 semanas | 28 semanas | 4-6 semanas |

El "ciclo de base" es el período inicial dedicado casi exclusivamente a construir capacidad aeróbica (Z1-Z2) antes de introducir trabajo específico de mayor intensidad — más largo cuanto más larga la distancia objetivo, porque hay más base que construir antes de especializarse.

---

## 9. Matriz de progresión de volumen

Cuántos kilómetros sumar por semana durante las fases de carga, según tu ritmo base y tu objetivo. En semanas de fatiga externa (partido de fútbol, mala noche de sueño, etc.), se toma siempre el límite **inferior** del rango.

| Ritmo base | Vel. (km/h) | Pace | 5K | 10K | Media maratón | Maratón |
|------------|-------------|------|----|----|----------------|---------|
| Suave | 9 | 07:00 | 1-2 | 1-2 | 1-2 | 1-2 |
| Promedio | 10 | 06:00 | 2-2.5 | 2-3 | 2-3 | 2-4 |
| Moderado | 12 | 05:00 | 3-3.5 | 3-4 | 3-4 | 3-5 |
| Fuerte | 13 | 04:36 | 4-4.5 | 4-5 | 4-5 | 4-6 |
| Rápido | 15 | 04:00 | 5-6 | 5-7 | 5-7 | 5-8 |
| Ultra rápido | 18 | 03:24 | 7-8 | 7-9 | 7-9 | 7-10 |

### Ejemplo aplicado

Preparando un 10K con ritmo base "Promedio" (06:00 min/km), arrancando en 20 km semanales:

- Semana 1 (Carga): 20 km
- Semana 2 (Carga+): 22 km (+2)
- Semana 3 (Carga++): 24 km (+2)
- Semana 4 (Descarga): ~18-20 km (se toma el límite inferior restado, para asimilar)

---

## 10. Por qué el RPE es la métrica principal en Umbral

A diferencia de la mayoría de las apps de running, que priorizan la frecuencia cardíaca, Umbral usa el RPE y la sensación como ejes principales. La razón es práctica: los sensores ópticos de pulso en relojes económicos son poco confiables, especialmente durante esfuerzos intensos o con movimiento del brazo. El RPE, en cambio, no depende de ningún sensor — depende de tu percepción entrenada, que con el protocolo de sensibilización (sección 1.2) se vuelve una herramienta tan precisa como cualquier sensor, y a veces más honesta: un mal sensor puede mostrar una FC estable mientras tu cuerpo está, en realidad, sufriendo un esfuerzo cada vez mayor. El RPE no se equivoca de esa manera.
