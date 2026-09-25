/**
 * Spanish search terms for the English exercise names in the catalog, so
 * "sentadilla", "press de banca" or "dominadas" find their exercises.
 * Keys are matched as whole words against the lowercased English name;
 * values list the Spanish words (singular and plural) added to the search text.
 */
const ALIASES: [RegExp, string][] = [
  [/\bbench press\b/, 'press de banca'],
  [/\b(overhead|military|shoulder) press\b/, 'press militar press de hombros'],
  [/\bleg press\b/, 'prensa de piernas'],
  [/\bpress\b/, 'press empuje'],
  [/\bsquats?\b/, 'sentadilla sentadillas'],
  [/\bdeadlifts?\b/, 'peso muerto'],
  [/\bromanian\b/, 'rumano'],
  [/\b(pull[- ]?ups?|chin[- ]?ups?)\b/, 'dominada dominadas'],
  [/\bpush[- ]?ups?\b/, 'flexion flexiones lagartija lagartijas'],
  [/\brows?\b/, 'remo remos'],
  [/\b(lunges?|split squats?)\b/, 'zancada zancadas estocada estocadas'],
  [/\bcurls?\b/, 'curl bicep biceps'],
  [/\b(fly|flyes?|flys)\b/, 'apertura aperturas'],
  [/\braises?\b/, 'elevacion elevaciones'],
  [/\bcalf\b/, 'gemelo gemelos pantorrilla talones'],
  [/\bshrugs?\b/, 'encogimiento encogimientos'],
  [/\bdips?\b/, 'fondo fondos'],
  [/\b(crunch(es)?|sit[- ]?ups?)\b/, 'abdominal abdominales encogimiento'],
  [/\bplanks?\b/, 'plancha planchas'],
  [/\bhip thrusts?\b/, 'empuje de cadera puente de gluteos'],
  [/\bbridges?\b/, 'puente puentes'],
  [/\bextensions?\b/, 'extension extensiones'],
  [/\b(pulldowns?|pull[- ]?downs?)\b/, 'jalon jalones'],
  [/\bkickbacks?\b/, 'patada patadas'],
  [/\bstep[- ]?ups?\b/, 'subida al cajon step'],
  [/\bgood mornings?\b/, 'buenos dias'],
  [/\bcleans?\b/, 'cargada cargadas'],
  [/\bsnatch(es)?\b/, 'arranque'],
  [/\bjumps?\b/, 'salto saltos'],
  [/\bstretch(es)?\b/, 'estiramiento estiramientos'],
  [/\btwists?\b/, 'giro giros rotacion'],
  [/\bincline\b/, 'inclinado inclinada'],
  [/\bdecline\b/, 'declinado declinada'],
  [/\bseated\b/, 'sentado sentada'],
  [/\bstanding\b/, 'de pie parado'],
  [/\blying\b/, 'acostado tumbado'],
  [/\breverse\b/, 'inverso invertido'],
  [/\bclose[- ]grip\b/, 'agarre cerrado'],
  [/\bwide[- ]grip\b/, 'agarre abierto'],
  [/\bhammer\b/, 'martillo'],
  [/\bskull ?crushers?\b/, 'rompecraneos press frances'],
  [/\bfarmers?\b/, 'paseo del granjero'],
  [/\bhyperextensions?\b/, 'hiperextension hiperextensiones'],
  [/\bwalk(ing)?\b/, 'caminata caminar'],
  [/\brun(ning)?\b/, 'correr carrera'],
];

/** Spanish search terms for an English exercise name (accents stripped by the caller). */
export function spanishAliases(name: string): string {
  const lower = name.toLowerCase();
  return ALIASES.filter(([pattern]) => pattern.test(lower))
    .map(([, words]) => words)
    .join(' ');
}
