/**
 * Glosario del perfil mágico de un personaje (§ punto 2). Client-safe.
 * Descripciones neutrales y EDITABLES — ajústalas a tu canon cuando quieras;
 * alimentan los tooltips de la sección "Perfil mágico".
 */
export interface CampoMagico {
  /** Clave del campo en el personaje. */
  key: string;
  label: string;
  icon: string;
  /** Explicación breve mostrada en el tooltip. */
  glosa: string;
}

export const PERFIL_MAGICO: CampoMagico[] = [
  { key: "tipoMagiaPrincipal", label: "Magia principal", icon: "Sparkles", glosa: "La escuela o tipo de magia que domina con maestría." },
  { key: "magiaSecundaria", label: "Magia secundaria", icon: "Wand2", glosa: "Una segunda afinidad mágica que complementa a la principal." },
  { key: "nivelDeConsciencia", label: "Nivel de consciencia", icon: "Atom", glosa: "Grado de consciencia y control que el personaje tiene sobre su poder." },
  { key: "circuitoForte", label: "Circuito Forte", icon: "Zap", glosa: "La fortaleza de su circuito mágico: cuánta energía puede canalizar." },
  { key: "essentia", label: "Essentia", icon: "Flame", glosa: "La esencia mágica fundamental del personaje, la naturaleza íntima de su poder." },
  { key: "zenithra", label: "Zenithra", icon: "Star", glosa: "El punto cúspide o forma culminante a la que puede ascender su poder." },
  { key: "bendicion", label: "Bendición", icon: "Sun", glosa: "Don o bendición de origen divino que porta el personaje." },
  { key: "segundoDespertar", label: "Segundo despertar", icon: "Moon", glosa: "Un despertar posterior que transforma o potencia drásticamente sus capacidades." },
];
