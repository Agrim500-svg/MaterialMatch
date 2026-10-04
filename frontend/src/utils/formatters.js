export const SUBSCRIPT_DIGITS = {
  0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉',
}

export const ELEMENT_DATA = {
  H: [1, 1.008], He: [2, 4.0026], Li: [3, 6.94], Be: [4, 9.0122], B: [5, 10.81],
  C: [6, 12.011], N: [7, 14.007], O: [8, 15.999], F: [9, 18.998], Ne: [10, 20.180],
  Na: [11, 22.990], Mg: [12, 24.305], Al: [13, 26.982], Si: [14, 28.085], P: [15, 30.974],
  S: [16, 32.06], Cl: [17, 35.45], Ar: [18, 39.948], K: [19, 39.098], Ca: [20, 40.078],
  Sc: [21, 44.956], Ti: [22, 47.867], V: [23, 50.942], Cr: [24, 51.996], Mn: [25, 54.938],
  Fe: [26, 55.845], Co: [27, 58.933], Ni: [28, 58.693], Cu: [29, 63.546], Zn: [30, 65.38],
  Ga: [31, 69.723], Ge: [32, 72.630], As: [33, 74.922], Se: [34, 78.971], Br: [35, 79.904],
  Kr: [36, 83.798], Rb: [37, 85.468], Sr: [38, 87.62], Y: [39, 88.906], Zr: [40, 91.224],
  Nb: [41, 92.906], Mo: [42, 95.95], Tc: [43, 98.0], Ru: [44, 101.07], Rh: [45, 102.91],
  Pd: [46, 106.42], Ag: [47, 107.87], Cd: [48, 112.41], In: [49, 114.82], Sn: [50, 118.71],
  Sb: [51, 121.76], Te: [52, 127.60], I: [53, 126.90], Xe: [54, 131.29], Cs: [55, 132.91],
  Ba: [56, 137.33], La: [57, 138.91], Ce: [58, 140.12], Pr: [59, 140.91], Nd: [60, 144.24],
  Pm: [61, 145.0], Sm: [62, 150.36], Eu: [63, 151.96], Gd: [64, 157.25], Tb: [65, 158.93],
  Dy: [66, 162.50], Ho: [67, 164.93], Er: [68, 167.26], Tm: [69, 168.93], Yb: [70, 173.05],
  Lu: [71, 174.97], Hf: [72, 178.49], Ta: [73, 180.95], W: [74, 183.84], Re: [75, 186.21],
  Os: [76, 190.23], Ir: [77, 192.22], Pt: [78, 195.08], Au: [79, 196.97], Hg: [80, 200.59],
  Tl: [81, 204.38], Pb: [82, 207.2], Bi: [83, 208.98], Po: [84, 209.0], At: [85, 210.0],
  Rn: [86, 222.0], Fr: [87, 223.0], Ra: [88, 226.0], Ac: [89, 227.0], Th: [90, 232.04],
  Pa: [91, 231.04], U: [92, 238.03], Np: [93, 237.0], Pu: [94, 244.0], Am: [95, 243.0],
  Cm: [96, 247.0], Bk: [97, 247.0], Cf: [98, 251.0], Es: [99, 252.0], Fm: [100, 257.0],
  Md: [101, 258.0], No: [102, 259.0], Lr: [103, 266.0], Rf: [104, 267.0], Db: [105, 268.0],
  Sg: [106, 269.0], Bh: [107, 270.0], Hs: [108, 277.0], Mt: [109, 278.0], Ds: [110, 281.0],
  Rg: [111, 282.0], Cn: [112, 285.0], Nh: [113, 286.0], Fl: [114, 289.0], Mc: [115, 290.0],
  Lv: [116, 293.0], Ts: [117, 294.0], Og: [118, 294.0],
}

export const ELEMENTS = new Set(Object.keys(ELEMENT_DATA))
const ELEMENT_LOWER_MAP = new Map(Object.keys(ELEMENT_DATA).map((el) => [el.toLowerCase(), el]))

/** Subscript numbers in formula string, e.g. Fe2O3 -> Fe₂O₃ */
export function subscriptFormula(formula) {
  if (!formula) return ''
  return String(formula).replace(/(\d+)/g, (m) =>
    m.split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join(''),
  )
}

/** Format a number safely to fixed decimals */
export function fmt(value, digits = 2) {
  return value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : null
}

/**
 * Normalizes chemical formula casing:
 * e.g. 'si' -> 'Si', 'fe2o3' -> 'Fe2O3', 'gan' -> 'GaN', 'ca(h2n)2' -> 'Ca(H2N)2'
 * Leaves materials project IDs (mp-...) and unparseable inputs untouched.
 */
export function canonicalizeFormula(input) {
  if (!input) return ''
  const str = String(input).trim()
  if (/^mp-\w+/i.test(str)) return str.toLowerCase()

  let i = 0
  let res = ''
  while (i < str.length) {
    if (/\s/.test(str[i])) {
      i++
      continue
    }
    const two = str.slice(i, i + 2).toLowerCase()
    const one = str.slice(i, i + 1).toLowerCase()

    if (two.length === 2 && ELEMENT_LOWER_MAP.has(two)) {
      res += ELEMENT_LOWER_MAP.get(two)
      i += 2
    } else if (ELEMENT_LOWER_MAP.has(one)) {
      res += ELEMENT_LOWER_MAP.get(one)
      i += 1
    } else if (str[i] === '(' || str[i] === ')') {
      res += str[i++]
    } else if (/[\d.]/.test(str[i])) {
      res += str[i++]
    } else {
      // Unparseable token - return original trimmed string
      return str
    }
  }
  return res || str
}

/**
 * Pure client-side formula parser for stoichiometry display.
 * Accepts standard and canonicalized formulas.
 */
export function parseFormulaParts(formula) {
  if (!formula) return null
  const trimmed = String(formula).trim()
  if (/^mp-\w+/i.test(trimmed)) return null

  // Normalize Unicode subscripts before parsing
  const clean = trimmed.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) =>
    String(Object.values(SUBSCRIPT_DIGITS).indexOf(c)),
  )

  const re = /([A-Z][a-z]?)(\d*\.?\d*)/g
  const parts = []
  let match
  let consumed = ''

  while ((match = re.exec(clean)) !== null) {
    if (!ELEMENTS.has(match[1])) return null
    consumed += match[0]
    const amt = match[2] === '' ? 1 : Number(match[2])
    if (!Number.isFinite(amt) || amt <= 0) return null
    parts.push({ element: match[1], amount: amt })
  }

  if (consumed !== clean || parts.length === 0) return null

  // Merge duplicate elements
  const seen = new Set(parts.map((p) => p.element))
  if (seen.size !== parts.length) {
    return parts.reduce((acc, { element, amount }) => {
      const existing = acc.find((a) => a.element === element)
      if (existing) existing.amount += amount
      else acc.push({ element, amount })
      return acc
    }, [])
  }

  return parts
}

/** Formats parsed formula parts into readable breakdown string */
export function formulaBreakdown(parts) {
  if (!parts) return '—'
  return parts
    .map((p) =>
      p.amount === 1
        ? p.element
        : `${p.element}${String(p.amount).split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('')}`,
    )
    .join(' ')
}

/** Assistant intent label helper */
export function intentLabel(intent) {
  switch (intent) {
    case 'discover_material':
      return 'Direct Compound Lookup'
    case 'predict_property':
      return 'Direct Property Query'
    case 'find_similar':
      return 'Vector Screening'
    case 'rank_candidates':
      return 'Candidate Screening'
    case 'search_image':
      return 'Image Intake'
    default:
      return 'Assistant'
  }
}
