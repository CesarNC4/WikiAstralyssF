---
name: lore-revisar
description: Auditar la coherencia del lore de Astralys en la wiki (solo lectura) y encontrar fechas imposibles, conexiones que faltan o se contradicen, referencias rotas, secretos en riesgo, fichas a medias, contradicciones entre textos y restos de prueba. Úsalo cuando el autor pida revisar, auditar o comprobar el lore, una ficha o un tema, o pregunte qué no cuadra o qué falta.
---

# Revisar el lore

Busca lo que no cuadra para que el autor decida. **No se escribe nada en la base y
no se corrige nada sin que lo pida.**

## 1. Comprobaciones automáticas

```
pnpm --silent lore revisar             toda la wiki
pnpm --silent lore revisar <tema>      las fichas que llevan el tema en el nombre o lo nombran
```

Tarda medio minuto. Saca un resumen, y deja el detalle en un archivo nuevo de
`lore/revisiones/` (fuera de git: puede citar datos ocultos). Revisa secretos en riesgo,
fechas imposibles, conexiones, referencias, coherencia del taller, menciones sin
conexión, la guía de estilo y restos de prueba, y fichas a medias.

Un aviso es una sospecha, no un veredicto: comprueba lo grave con
`pnpm --silent lore ficha <tipo> <id>` antes de darlo por cierto. Un nombre corto o común
puede dar una falsa alarma (una moneda que se llama igual que un personaje).

## 2. Leer los textos

Las contradicciones entre textos no las ve un script: una fecha o un hecho contado de
dos maneras. Se leen **por tema**. Lee `lore/guia-de-estilo.md` y las fichas que da
`lore revisar <tema>`, y compara.

**Toda la wiki solo si el autor lo pide**, porque es mucho texto. `pnpm --silent lore textos`
dice cuánto hay por tipo y `pnpm --silent lore textos <tipo>` saca los de un tipo.
Reparte la lectura en agentes lectores (Explore) para no llenar el chat. Encárgales
que solo lean y que devuelvan cada contradicción con las dos fichas, el campo y la frase
exacta.

Al leer:

- Una contradicción son dos afirmaciones que no pueden ser ciertas a la vez. Cita las dos
  fichas y las dos frases. Sin las dos citas, no es un hallazgo.
- Compara hechos: fechas, quién hizo qué, quién está vivo, cuántos son, a quién pertenece
  algo. El estilo ya lo mira la parte automática.
- Lo que no se dice no es una contradicción. Un hueco es un hueco.
- Lo oculto (🔒, `[[oculto]]`) y las notas de autor cuentan para comparar; dilo cuando un
  hallazgo dependa de un dato que no es público.
- No resuelvas la contradicción eligiendo una versión: decide el autor.

Añade lo que encuentres al final del archivo del informe, en `## Lectura de textos`,
con una línea que diga qué se leyó. Lo que no se ha leído no se da por bueno.

## 3. Contárselo al autor

Empieza por lo que importa: secretos en riesgo y contradicciones. Agrupa lo repetido
("28 personajes ocultos nombrados en textos públicos") y da la ruta del informe. Lo que
sigue siendo una duda, dilo como duda.

## 4. Según lo que decida

- **Arreglarlo:** pregunta lo que dependa de él y escribe la propuesta con `/lore-fichas` en
  `lore/propuestas/`. La aplica él desde la bandeja. Solo se propone lo que él ha elegido.
- **Es a propósito:** añade una línea a `lore/revisiones/excepciones.md` con la clave que
  da el informe y su motivo. No vuelve a salir, y el resumen cuenta cuántas se omiten:

  ```
  - `fechas/evento-tras-morir:12:timeline#4` — Aparece como espíritu.
  ```

- **Excepciones viejas:** si el informe dice que una ya no corresponde a nada, pregúntale si
  se quita.

Nunca escribas en la base. Si hay que cambiar algo, eso es `/lore-fichas`. Un fallo del
código (una ficha que debería verse y no se ve) no es lore: cuéntalo aparte.
