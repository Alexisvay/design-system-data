// Component as Data — thread principal (accès Figma, PAS de réseau ici).
// Clés JSON en ASCII/anglais (portable, pas de mojibake). Le français reste dans les valeurs prose.
// Organisation : helpers → lint (lintProps/sharedFindings) → extraction → autofix → tokens → dispatcher.

figma.showUI(__html__, { width: 560, height: 780, themeColors: true });
// taille persistée en local (clientStorage) : on redimensionne une fois, c'est acquis pour les sessions suivantes
figma.clientStorage.getAsync('ui-size').then((s) => {
  if (s && s.w && s.h) figma.ui.resize(Math.max(480, Math.min(1400, s.w)), Math.max(480, Math.min(1200, s.h)));
}).catch(() => {});
let sizeTimer = null;

const clean = (k) => k.replace(/#.*$/, '').replace(/^\[[^\]]*\]\s*/, '').trim(); // retire le #id Figma et tout préfixe décoratif [tag]
// kebab-case pour les NOMS (propriétés, layers) ; pas les valeurs ni les refs de composants
const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').replace(/[^0-9a-zA-Z-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
const prop = (k) => kebab(clean(k));
// Retire d'un `when` les axes qu'un axe écrasant décide déjà (cf. SUPERSEDES). N'agit que si
// l'axe écrasant est à une valeur AUTRE que son défaut : à son défaut il ne décide rien, et
// l'axe écrasé garde tout son sens.
function relaxWhen(when, outProps) {
  if (!when || !outProps) return when;
  let res = when;
  for (const winner in SUPERSEDES) {
    const v = res[winner];
    if (v === undefined || Array.isArray(v)) continue; // une liste = « une de ces valeurs » : trop ambigu pour relâcher
    const def = outProps[winner] && outProps[winner].default;
    if (def === undefined || String(v) === String(def)) continue;
    for (const loser of SUPERSEDES[winner]) {
      if (res[loser] === undefined) continue;
      if (res === when) res = Object.assign({}, when); // copie tardive : on ne touche pas l'original sans raison
      delete res[loser];
    }
  }
  return res;
}
// nom du component-SET d'un composant, pour relier une instance à son json : parent set local,
// sinon 1er segment d'un nom de variante DISTANT ("Set/val/val…" chez une lib externe) — sans quoi
// une instance de composant à variantes est citée par son chemin de variante et ne résout pas.
const setName = (n) => !n ? null : (n.parent && n.parent.type === 'COMPONENT_SET') ? n.parent.name : String(n.name).split('/')[0].trim();
// tampon de version : identifie le code qui a produit un JSON (pour lever tout doute de rechargement)
const VERSION = '2.17 (naming: an instance still carrying its source component name is detected and proposed for rename)';
const RUNTIME = ['hover', 'focus', 'press', 'pressed', 'active'];
// précédence des styles : le structurel d'abord (hierarchy/tone/type/size), l'étatique en dernier (state écrase tout)
const PRIORITY = ['hierarchy', 'tone', 'type', 'variant', 'kind', 'size', 'selection', 'validation', 'status', 'state', 'isDestructive', 'isSelected', 'isIndeterminate', 'isDisabled'];
// heuristique de rôle (le doc.md confirme) — nom du composant -> rôle abstrait
const GENERIC = /^(vector|rectangle|ellipse|frame|group|line|union|subtract|star|polygon|component|instance|slice|boolean|shape)([ -]?\d+)?$/;
const VOCAB_ALIAS = { mode: 'tone', severity: 'tone', intent: 'tone', variant: 'hierarchy', appearance: 'hierarchy', emphasis: 'hierarchy', scale: 'size', direction: 'orientation', position: 'placement', side: 'placement', behaviour: 'status', behavior: 'status' };
const STATE_VALUES = ['enabled', 'hover', 'focus', 'press', 'disabled'];
// Un axe qui en ECRASE un autre : quand le premier vaut autre chose que son défaut, le second
// n'a plus d'effet visuel. C'est le comportement de la plateforme (dans le DOM, `checked` et
// `indeterminate` sont indépendants et `:indeterminate` l'emporte à l'écran) — la combinaison
// n'est donc pas interdite, elle est RESOLUE. Épingler l'axe écrasé dans un `when` fermerait
// la cascade sur la moitié des cas et ferait passer un trou de dessin pour un interdit.
// Cf. nomenclature-composants.md, « Deux booléens qui se recouvrent : la précédence, pas l'interdit ».
const SUPERSEDES = { 'is-indeterminate': ['is-selected'] };
// valeurs de `status` conformes : des phases de cycle de vie. Le reste est un autre axe.
const PHASE_HINT = /(default|processing|pending|uploading|loading|complete|done|filled|empty|error|success|fail|current|upcoming|todo|active|step|draft|sent|paid)/i;
// Un ELEMENT d'un contrôle n'est pas le contrôle : une option de liste (`_Select-item`) ne
// porte pas le retour de validation du champ, seulement sa couleur sémantique. Le préfixe `_`
// (sous-composant) et les suffixes d'élément le disent — sans quoi le lint `validation` mord
// sur le mot « select » d'un nom de pièce et réclame de renommer un `tone` légitime.
const PART = /^_|-(item|option|cell|row)$/i;
const OPENNESS = /^(open|opened|close|closed|expanded|collapsed)$/i;
const PLACEMENT_HINT = /(^|-)(left|right|center|centre|top|bottom|start|end|horizontal|vertical)(-|$)|align/i;
const ROLE_HINTS = [['button', 'button'], ['combobox', 'combobox'], ['dropdown', 'combobox'], ['select', 'combobox'], ['dialog', 'dialog'], ['modal', 'dialog'], ['checkbox', 'checkbox'], ['radio', 'radio'], ['switch', 'switch'], ['toggle', 'switch'], ['tab', 'tab'], ['menu', 'menu'], ['tooltip', 'tooltip'], ['input', 'textbox'], ['textfield', 'textbox'], ['textarea', 'textbox'], ['tag', 'tag'], ['chip', 'tag'], ['badge', 'status'], ['alert', 'alert'], ['toast', 'status'], ['snackbar', 'status'], ['tabs', 'tablist'], ['accordion', 'region'], ['slider', 'slider'], ['pagination', 'navigation'], ['breadcrumb', 'navigation']];

const varCache = {};
// variables de LIB EXTERNE croisées pendant l'extraction en cours : elles résolvent en nom
// mais n'apparaîtront JAMAIS dans l'export tokens local (getLocalVariablesAsync) — le trou
// ne se voit qu'au contrôle de couverture du corpus, trop tard ; on l'avoue au lint.
const remoteVars = new Set();
async function varName(id) {
  let m = varCache[id];
  if (m === undefined) {
    const v = await figma.variables.getVariableByIdAsync(id);
    m = varCache[id] = v ? { n: v.name, remote: !!v.remote } : null;
  }
  if (m && m.remote) remoteVars.add(m.n);
  return m ? m.n : null;
}
const hex = (c) => '#' + ['r', 'g', 'b'].map((k) => ('0' + Math.round(c[k] * 255).toString(16)).slice(-2)).join('').toUpperCase();

async function paintRef(node, prop) {
  const paints = node[prop];
  if (!paints || paints === figma.mixed || !paints.length) return null;
  const p = paints[0];
  if (!p || p.visible === false) return null;
  if (p.type !== 'SOLID') return { unsupported: p.type }; // dégradé/image : signalé, pas tokenisé (au lieu d'être perdu en silence)
  const bv = node.boundVariables && node.boundVariables[prop] && node.boundVariables[prop][0];
  if (bv) { const n = await varName(bv.id); if (n) return { token: n }; }
  return hex(p.color);
}
// effets visibles (ombres) — ex. un ring de focus fait en ombre portée plutôt qu'en stroke
function effectsOf(node) {
  if (!node.effects || !node.effects.length) return null;
  const out = [];
  for (const e of node.effects) {
    if (e.visible === false || (e.type !== 'DROP_SHADOW' && e.type !== 'INNER_SHADOW')) continue;
    const ef = { type: e.type === 'DROP_SHADOW' ? 'shadow' : 'inner-shadow', radius: e.radius };
    if (e.color) { ef.color = hex(e.color); if (typeof e.color.a === 'number' && e.color.a < 1) ef.opacity = Math.round(e.color.a * 100) / 100; }
    if (e.offset) ef.offset = { x: e.offset.x, y: e.offset.y };
    if (typeof e.spread === 'number' && e.spread) ef.spread = e.spread;
    out.push(ef);
  }
  return out.length ? out : null;
}
// (v2.13 : les clés par chemin de noms ont disparu — homonymes suffixés en ordre d'arbre, global au set)
// composition-aware : une instance de COMPOSANT À VARIANTES (Tag, Avatar…) = référence opaque, on ne descend PAS dedans.
// Les instances « primitives » (icônes sans variantes) restent descendues (leur visuel est capté comme avant).
const refCache = {};
async function isRefInstance(ins) {
  try {
    const mc = await ins.getMainComponentAsync();
    if (!mc) return false;
    if (refCache[mc.id] !== undefined) return refCache[mc.id];
    return (refCache[mc.id] = !!(mc.parent && mc.parent.type === 'COMPONENT_SET'));
  } catch (e) { return false; }
}
// collecte les nœuds « propres » (chrome) SANS traverser les instances-références ; empile ces instances dans `refs`
async function collectOwn(node, own, refs) {
  for (const c of node.children || []) {
    if (c.type === 'INSTANCE' && (await isRefInstance(c))) { refs.push(c); continue; }
    own.push(c);
    if (c.children && c.children.length) await collectOwn(c, own, refs);
  }
}

// la variante par defaut d'un set = celle qui matche les defaults declares des props (pas la 1re)
function defaultVariant(set, propDefs) {
  if (set.type !== 'COMPONENT_SET') return { def: set, defCfg: {} };
  const defCfg = {};
  for (const [k, v] of Object.entries(propDefs)) if (v.type === 'VARIANT') defCfg[prop(k)] = String(v.defaultValue);
  const def = set.children.find((c) => { const cfg = parseConfig(c.name); return Object.keys(defCfg).every((a) => cfg[a] === defCfg[a]); }) || set.children[0];
  return { def, defCfg };
}

// lint des props, isole pour rester reutilisable (messages detailles dans extract)
function lintProps(propDefs) {
  const r = { noisy: [], badBool: [], upperVals: [], spacedVals: [], aliasHits: [], disabledBools: [], typeSuffix: [], stateIssues: [], statusIssue: null, toneVals: null, hasState: false, selectionBools: [] };
  for (const [k, v] of Object.entries(propDefs)) {
    const base = k.replace(/#.*$/, '').trim(); // le suffixe #id vient de Figma, pas du designer : jamais linte
    const key = prop(k);
    if (/[^\x00-\x7F]/.test(base) || /\s/.test(base) || /[A-Z]/.test(base)) r.noisy.push(base);
    if (VOCAB_ALIAS[key]) r.aliasHits.push({ from: base, to: VOCAB_ALIAS[key] });
    if (/-(swap|text|slot)$/.test(key) || /^(swap|text|slot)-/.test(key)) r.typeSuffix.push(base); // suffixe OU préfixe : swap-icon-left porte le type autant qu'icon-swap
    if (v.type === 'BOOLEAN') {
      if (/disabl/i.test(key)) r.disabledBools.push(base); // is-disabled, disabled, isDisabled, is-disable…
      else if (!/^(show|is)-/.test(key)) r.badBool.push(base);
    }
    if (key === 'is-selected' || key === 'is-indeterminate') r.selectionBools.push(key);
    if (v.type === 'VARIANT') {
      const opts = (v.variantOptions || []).map(String);
      // « done step » : la valeur devient une clé de donnée, elle s'écrit en kebab
      for (const o of opts) if (/\s/.test(o)) { r.spacedVals.push(base + '="' + o + '"'); break; }
      // `status` dérive vite en fourre-tout : une valeur qui n'est pas une phase demande un autre axe
      if (key === 'status' && opts.length && !opts.some((o) => PHASE_HINT.test(o))) {
        const fix = opts.every((o) => OPENNESS.test(o)) ? 'is-open (booléen d\'ouverture)'
          : opts.some((o) => PLACEMENT_HINT.test(o)) ? 'placement, ou orientation'
          : 'type (déclinaison structurelle)';
        r.statusIssue = { vals: opts, fix: fix };
      }
      if (key === 'tone') r.toneVals = opts.map((o) => o.toLowerCase());
      // un axe *disabled* à valeurs true/false est un booléen déguisé : même faute que le BOOLEAN, mêmes combos impossibles
      if (/disabl/i.test(key) && opts.length && opts.every((o) => /^(true|false|yes|no|on|off)$/i.test(o))) r.disabledBools.push(base);
      if (opts.some((o) => /[A-Z]/.test(o))) r.upperVals.push(base);
      const looksState = opts.some((o) => RUNTIME.indexOf(o.toLowerCase()) >= 0 || /disabled/i.test(o));
      if (key === 'state') {
        r.hasState = true;
        const exotic = opts.filter((o) => STATE_VALUES.indexOf(o.toLowerCase()) < 0);
        if (exotic.length) r.stateIssues.push({ level: 'hint', msg: 'state axis: non-standard values (' + exotic.join(', ') + '); recommended: ' + STATE_VALUES.join(', ') + '.' });
      } else if (looksState) {
        r.stateIssues.push({ level: 'warn', msg: 'Axis "' + base + '" looks like a state axis: name it state, with values ' + STATE_VALUES.join(', ') + '.' });
      }
    }
  }
  return r;
}

// constats props + description, partagés entre le lint d'extract() et les findings du check (étape 2) :
// une seule source pour les messages, plus de dérive entre les deux surfaces
function sharedFindings(lp, description, name) {
  const f = [];
  // un champ de formulaire qui porte son erreur dans `tone` : `tone` est la couleur sémantique
  // d'un composant d'affichage, `validation` est le retour d'un champ. Un champ peut être
  // `error` ET `hover` — les deux axes ne se remplacent pas.
  const isField = !PART.test(String(name || '')) && /input|field|select|textarea|combobox|upload|form/i.test(String(name || ''));
  if (isField && lp.toneVals && lp.toneVals.indexOf('error') >= 0 && !lp.toneVals.some((v) => /brand|info|accent/.test(v)))
    f.push({ rule: 'validation', level: 'warn', msg: 'Form control carrying its error in "tone" (' + lp.toneVals.join(', ') + '): rename the axis to "validation" (default, error, success). "tone" is the semantic colour of a display component (Tag, Badge, Alert).' });
  if (lp.statusIssue)
    f.push({ rule: 'status', level: 'warn', msg: 'status axis with non-lifecycle values (' + lp.statusIssue.vals.join(', ') + '): status is the phase of a process component (processing, completed). Here it looks like ' + lp.statusIssue.fix + '.' });
  if (lp.spacedVals.length)
    f.push({ rule: 'values', level: 'hint', msg: 'Value(s) containing spaces: ' + lp.spacedVals.join(', ') + ' — a value becomes a data key, write it kebab-case (top-left, not "top left").' });
  for (const si of lp.stateIssues) f.push({ rule: 'state', level: si.level, msg: si.msg });
  if (lp.disabledBools.length) {
    const fix = lp.hasState
      ? 'move "disabled" into the existing state axis (add it as a value) and remove this prop'
      : 'model states as one "state" axis (' + STATE_VALUES.join(', ') + ') and drop this prop';
    f.push({ rule: 'is-disabled', level: 'warn', msg: 'disabled as a separate boolean/true-false prop (' + lp.disabledBools.join(', ') + '): ' + fix + ' — a boolean lets impossible combos (hover + disabled) exist; in the state axis they cannot.' });
  }
  if (lp.badBool.length) f.push({ rule: 'booleans', level: 'hint', msg: 'Boolean(s) without prefix (' + lp.badBool.join(', ') + '): show-* for visibility, is-* for states.' });
  if (lp.upperVals.length) f.push({ rule: 'values', level: 'hint', msg: 'Uppercase values on ' + lp.upperVals.join(', ') + ': write them lowercase (primary, not Primary).' });
  if (!description) f.push({ rule: 'description', level: 'hint', msg: 'Empty Figma description: write what it is for, and when to pick it over a neighbor.' });
  return f;
}

// Le rappel sur `is-selected` + `is-indeterminate` ne vaut que s'il RESTE quelque chose à
// faire. La moitié « ne pas épingler l'axe perdant » est réglée à l'extraction (relaxWhen) ;
// la moitié « déclarer l'interdit » ne concerne qu'un composant qui peut être un radio, et
// s'éteint dès que le doc porte la ligne. Sorti de sharedFindings pour ça : l'étape 2 ne lit
// que Figma, elle ne peut ni voir le doc ni conclure — et un rappel qu'on ne peut pas
// éteindre garde l'étape en rouge à vie et fait passer une convention pour un défaut.
function selectionFinding(lp, props, invalidCombos) {
  if (lp.selectionBools.length !== 2) return null;
  const t = props && props.type;
  if (!(t && t.enum && t.enum.some((v) => /radio/i.test(String(v))))) return null; // pas de radio possible : pas d'interdit à déclarer
  if ((invalidCombos || []).some((c) => String(c.when['is-indeterminate']) === 'true')) return null; // déjà déclaré
  return { rule: 'selection', level: 'hint', msg: 'Selection modelled as is-selected + is-indeterminate: the cascade resolves it via styles.precedence (is-indeterminate last, it wins) — do not pin is-selected in a when where is-indeterminate is true. Declare the one real ban in the doc: "type=radio + is-indeterminate=true : ARIA has no mixed on a radio".' };
}

// Un interdit qui porte sur une COMBINAISON de props se vérifie ; il est donc extrait en
// donnée, en plus de rester lisible dans `rules.forbidden`. Forme reconnue, volontairement
// étroite : `axe=valeur + axe=valeur : raison` (cf. doc-composant.md). Le reste — interdit
// d'usage, de composition, renvoi vers un autre composant — reste de la prose : rien ne peut
// le vérifier automatiquement, et le forcer en donnée ne ferait qu'inventer de la fausse rigueur.
// Ce n'est PAS la matrice des variantes manquantes : un trou de dessin n'est pas un interdit.
function parseInvalidCombos(lines, props) {
  const combos = [], nearMiss = [];
  for (const line of lines) {
    const m = /^\s*([^:]+?)\s*:\s*(\S.*)$/.exec(String(line));
    if (!m) continue;
    const terms = m[1].split('+').map((t) => t.trim()).filter(Boolean);
    if (terms.length < 2 || !terms.every((t) => /^[^=\s]+\s*=\s*[^=]+$/.test(t))) continue; // pas la forme : prose, on passe
    const when = {}; let bad = null;
    for (const t of terms) {
      const i = t.indexOf('=');
      const axis = prop(t.slice(0, i)), val = t.slice(i + 1).trim();
      const p = props[axis];
      if (!p) { bad = 'unknown axis "' + axis + '"'; break; }
      const allowed = p.enum ? p.enum.map(String) : (p.type === 'boolean' ? ['true', 'false'] : null);
      if (allowed && allowed.indexOf(val) < 0) { bad = '"' + val + '" is not a value of ' + axis + ' (' + allowed.join(', ') + ')'; break; }
      when[axis] = val;
    }
    // une faute de frappe ne doit pas créer une règle fantôme : on le dit, on n'invente pas
    if (bad) nearMiss.push({ line: String(line), why: bad });
    else combos.push({ when: when, reason: m[2].trim() });
  }
  return { combos: combos, nearMiss: nearMiss };
}

// rayon uniforme (cornerRadius) OU par coin si mixtes (box arrondie d'un seul côté → cornerRadius = mixed)
function mixedRadius(node) {
  const c = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'];
  if (!c.every((k) => typeof node[k] === 'number') || !c.some((k) => node[k] > 0)) return null;
  return { topLeft: node.topLeftRadius, topRight: node.topRightRadius, bottomRight: node.bottomRightRadius, bottomLeft: node.bottomLeftRadius };
}
// Styles visuels d'un noeud : fond, bordure, rayon, padding, gap, effets.
// sparse=true (sous-elements) : n'emet que les valeurs significatives ; sparse=false (root) : tout.
async function visualStyles(node, sparse) {
  const s = {};
  try {
    const bg = await paintRef(node, 'fills'); if (bg) s.background = bg;
    const st = await paintRef(node, 'strokes');
    if (st) {
      s.stroke = st;
      if (typeof node.strokeWeight === 'number') s.strokeWeight = node.strokeWeight;
      // bordures par côté (souligné d'onglet, séparateur…) : strokeWeight est « mixed », les côtés parlent
      if ('strokeTopWeight' in node) {
        const sw = { top: node.strokeTopWeight, right: node.strokeRightWeight, bottom: node.strokeBottomWeight, left: node.strokeLeftWeight };
        if (Object.values(sw).every((v) => typeof v === 'number') && new Set(Object.values(sw)).size > 1) s.strokeWeights = sw;
      }
      if (node.strokeAlign) s.strokeAlign = String(node.strokeAlign).toLowerCase();
    }
    if (typeof node.opacity === 'number' && node.opacity < 1) s.opacity = Math.round(node.opacity * 100) / 100;
    if (typeof node.cornerRadius === 'number') { if (!sparse || node.cornerRadius > 0) s.radius = node.cornerRadius; }
    else { const r = mixedRadius(node); if (r) s.radius = r; }
    if ('paddingTop' in node && (!sparse || node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft)) s.padding = { top: node.paddingTop, right: node.paddingRight, bottom: node.paddingBottom, left: node.paddingLeft };
    if ('itemSpacing' in node && typeof node.itemSpacing === 'number' && (!sparse || (node.layoutMode && node.layoutMode !== 'NONE' && node.itemSpacing))) s.gap = node.itemSpacing;
    // v2.11 : la charpente avec la peinture — direction, alignements, sizing. Le comparo du test de
    // fidélité v2 a montré que sans elle, un générateur réinvente la mise en page interne et diverge.
    // try dédié : certains getters (layoutSizing*) peuvent jeter sur des nœuds hors auto-layout —
    // un échec de charpente ne doit pas emporter les effets ni le reste de la capture.
    try {
      const lay = {};
      if (node.layoutMode === 'HORIZONTAL') lay.direction = 'row';
      else if (node.layoutMode === 'VERTICAL') lay.direction = 'column';
      if (lay.direction) {
        const A = { MIN: 'start', CENTER: 'center', MAX: 'end', SPACE_BETWEEN: 'space-between', BASELINE: 'baseline' };
        if (node.primaryAxisAlignItems && node.primaryAxisAlignItems !== 'MIN') lay.mainAlign = A[node.primaryAxisAlignItems] || String(node.primaryAxisAlignItems).toLowerCase();
        if (node.counterAxisAlignItems && node.counterAxisAlignItems !== 'MIN') lay.crossAlign = A[node.counterAxisAlignItems] || String(node.counterAxisAlignItems).toLowerCase();
        if (node.layoutWrap === 'WRAP') lay.wrap = true;
      }
      // enfant posé en absolu dans un auto-layout (badge, pastille) : la position relative voyage
      if (node.layoutPositioning === 'ABSOLUTE') { lay.absolute = true; lay.x = Math.round(node.x * 100) / 100; lay.y = Math.round(node.y * 100) / 100; }
      // contraintes min/max d'auto-layout (null quand non réglées)
      for (const mk of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']) if (typeof node[mk] === 'number') lay[mk] = node[mk];
      // sizing : hug est le défaut implicite — en sparse on n'émet que fill/fixed (et la cote réelle si fixed)
      const SZ = { FIXED: 'fixed', HUG: 'hug', FILL: 'fill' };
      if (node.layoutSizingHorizontal && (!sparse || node.layoutSizingHorizontal !== 'HUG')) {
        lay.sizingH = SZ[node.layoutSizingHorizontal] || String(node.layoutSizingHorizontal).toLowerCase();
        if (node.layoutSizingHorizontal === 'FIXED' && typeof node.width === 'number') lay.width = Math.round(node.width * 100) / 100;
      }
      if (node.layoutSizingVertical && (!sparse || node.layoutSizingVertical !== 'HUG')) {
        lay.sizingV = SZ[node.layoutSizingVertical] || String(node.layoutSizingVertical).toLowerCase();
        if (node.layoutSizingVertical === 'FIXED' && typeof node.height === 'number') lay.height = Math.round(node.height * 100) / 100;
      }
      if (Object.keys(lay).length) s.layout = lay;
    } catch (e) {}
    const fx = effectsOf(node); if (fx) s.effects = fx;
  } catch (e) {}
  return s;
}
const rootStyles = (n) => visualStyles(n, false);
const elementVisual = (el) => visualStyles(el, true);
async function textStyles(t) {
  const s = {};
  try {
    const col = await paintRef(t, 'fills'); if (col) s.textColor = col;
    const ty = {};
    if (t.fontName && t.fontName !== figma.mixed) { ty.fontFamily = t.fontName.family; ty.fontStyle = t.fontName.style; }
    if (typeof t.fontSize === 'number') ty.fontSize = t.fontSize;
    if (t.lineHeight && t.lineHeight.unit && t.lineHeight.unit !== 'AUTO') ty.lineHeight = t.lineHeight.value;
    if (t.letterSpacing && t.letterSpacing !== figma.mixed && t.letterSpacing.value) ty.letterSpacing = t.letterSpacing.unit === 'PERCENT' ? t.letterSpacing.value + '%' : t.letterSpacing.value;
    if (t.textCase && t.textCase !== figma.mixed && t.textCase !== 'ORIGINAL') ty.textCase = String(t.textCase).toLowerCase();
    if (t.textDecoration && t.textDecoration !== figma.mixed && t.textDecoration !== 'NONE') ty.textDecoration = String(t.textDecoration).toLowerCase();
    if (Object.keys(ty).length) s.typography = ty;
    if (t.textAlignHorizontal && t.textAlignHorizontal !== 'LEFT') s.textAlign = String(t.textAlignHorizontal).toLowerCase();
  } catch (e) {}
  return s;
}
// Styles d'une variante en UN SEUL passage d'arbre (perf) : root + label (1er texte) + sous-éléments nommés.
async function variantStyles(node) {
  const s = { root: await rootStyles(node) };
  // composition-aware : `own` = la chrome propre (on ne descend PAS dans les instances-références). Fini l'aplatissement des enfants.
  const own = [], refs = [];
  await collectOwn(node, own, refs);
  // label = le texte nommé « …label » ; sinon le 1er texte (moins fragile qu'un simple « 1er texte trouvé »)
  const texts = own.filter((n) => n.type === 'TEXT');
  const txt = texts.find((n) => /(^|-)label$/.test(kebab(n.name || ''))) || texts[0];
  if (txt) s.label = await textStyles(txt);
  // Collecte de TOUS les sous-éléments nommés stylés (hors label), en ORDRE D'ARBRE, sans clés :
  // le keying est GLOBAL au set (v2.13) — la même clé désigne le même élément dans toutes les
  // variantes (les chemins par variante changeaient d'identité quand la structure changeait).
  const cand = [];
  for (const el of own) {
    if (el === txt) continue;
    const nm = kebab(el.name || '');
    if (!nm) continue;
    const es = el.type === 'TEXT' ? await textStyles(el) : await elementVisual(el);
    // un élément sans style capté reste dans la liste : il occupe son RANG d'homonyme —
    // sinon l'index -1/-2 glisse dans les variantes où un homonyme perd ses styles
    cand.push({ nm, es });
  }
  s.cand = cand;
  return s;
}

function parseConfig(name) {
  const d = {};
  for (const part of name.split(',')) { const i = part.indexOf('='); if (i > 0) d[prop(part.slice(0, i))] = part.slice(i + 1).trim(); }
  return d;
}

async function extract(set, doc) {
  remoteVars.clear(); // périmètre : les tokens externes de CETTE extraction
  const isSet = set.type === 'COMPONENT_SET';
  const propDefs = set.componentPropertyDefinitions || {};
  const out = { meta: { name: set.name, type: 'atom', role: '?(tbd)' }, api: { props: {} }, structure: {}, styles: {} };

  // --- api.props (+ runtime / attribute) + slots ---
  const slots = {};
  for (const [k, v] of Object.entries(propDefs)) {
    const key = prop(k);
    if (v.type === 'VARIANT') {
      const p = { type: 'enum', enum: v.variantOptions, default: v.defaultValue };
      const opts = v.variantOptions || [];
      // axe d'état -> mapping valeur -> mécanisme (pseudo-classe CSS ou attribut), pas un runtime global
      // axe de sélection en forme booléenne (is-selected=false/true) : cas fréquent, où le
      // booléen est modélisé en axe VARIANT et non en prop BOOLEAN
      const selAxis = /^is-(selected|checked|indeterminate|current|activated)$/.test(key);
      if (key === 'state' || key === 'selection' || selAxis || opts.some((o) => RUNTIME.indexOf(String(o).toLowerCase()) >= 0) || opts.some((o) => /disabled|selected|indeterminate|checked/i.test(o))) {
        const map = {};
        for (const o of opts) {
          const lo = String(o).toLowerCase();
          if (selAxis) {
            if (lo === 'true') map[o] = key === 'is-indeterminate' ? ':indeterminate' : (/current|activated/.test(key) ? 'attribute:aria-current' : ':checked');
          }
          else if (lo === 'hover') map[o] = ':hover';
          else if (lo === 'focus' || lo === 'focused') map[o] = ':focus-visible';
          else if (lo === 'press' || lo === 'pressed' || lo === 'active') map[o] = ':active';
          else if (lo === 'selected' || lo === 'checked') map[o] = ':checked';
          else if (lo === 'indeterminate') map[o] = ':indeterminate';
          else if (/disabled/i.test(lo)) map[o] = 'attribute:disabled';
        }
        if (Object.keys(map).length) p.runtime = map;
      }
      if (/disabled/i.test(key)) p.attribute = 'disabled';
      out.api.props[key] = p;
    } else if (v.type === 'BOOLEAN') {
      const p = { type: 'boolean', default: v.defaultValue };
      if (/disabled/i.test(key)) p.attribute = 'disabled';
      // sélection : le mécanisme runtime, sinon un consommateur de la donnée doit le deviner
      else if (key === 'is-selected' || key === 'is-checked') p.runtime = { 'true': ':checked' };
      else if (key === 'is-indeterminate') p.runtime = { 'true': ':indeterminate' };
      else if (key === 'is-current' || key === 'is-activated') p.runtime = { 'true': 'attribute:aria-current' };
      out.api.props[key] = p;
    } else if (v.type === 'INSTANCE_SWAP') {
      const s = { accepts: 'Instance' };
      // v2.14 : la valeur PAR DÉFAUT du slot = le composant posé quand l'usage ne fournit rien
      // (ex. l'icône `placeholder` d'un Button). Sans elle, un `show-icon` à true n'a aucun
      // glyphe à rendre pour un lecteur à froid — la divergence « ○ Button CTA » du run 4.
      const dv = v.defaultValue;
      if (dv) {
        try {
          let n = await figma.getNodeByIdAsync(String(dv));
          if (!n) { try { n = await figma.importComponentByKeyAsync(String(dv)); } catch (e) {} }
          if (n) s.default = { swap: setName(n) };
        } catch (e) {}
      }
      slots[key] = s;
    }
    else if (v.type === 'TEXT') slots[key] = { as: 'children' };
    else if (v.type === 'SLOT') slots[key] = { as: 'slot' }; // slot property Figma : zone de contenu libre
    else slots[key] = { as: String(v.type || 'unknown').toLowerCase() }; // type de prop inconnu (API future) : capte sans casser
  }
  if (Object.keys(slots).length) out.structure.slots = slots;

  // rôle : heuristique depuis le nom (à confirmer lors de l'enrichissement manuel)
  const lname = (set.name || '').toLowerCase();
  for (const [k, r] of ROLE_HINTS) if (lname.indexOf(k) >= 0) { out.meta.role = r; break; }
  if (set.description) out.meta.description = set.description; // description Figma de l'auteur = intention à la source

  const axes = Object.keys(out.api.props);
  const pri = PRIORITY.map(kebab);
  out.styles.precedence = pri.filter((a) => axes.indexOf(a) >= 0).concat(axes.filter((a) => pri.indexOf(a) < 0));

  // base de la cascade = la VRAIE variante par défaut
  const { def, defCfg } = defaultVariant(set, propDefs);
  if (!def) { out._error = 'no variant found'; return out; }

  // --- master (extends + exposed) ---
  const exposed = def.findOne((n) => n.type === 'INSTANCE' && n.isExposedInstance);
  if (exposed) {
    const mc = await exposed.getMainComponentAsync();
    const m = setName(mc);
    out.meta.type = 'composed';
    out.meta.extends = m;
    out.api.exposed = [{ from: m, props: Object.keys(exposed.componentProperties || {}).map(prop) }];
  }

  // --- composition : enfants = instances de composants à variantes, en RÉFÉRENCE (component + props), PAS descendues ---
  const ownDef = [], topRefs = [];
  await collectOwn(def, ownDef, topRefs);
  const counts = {}; const children = []; let unexposedMaster = null;
  // icône ou composant ? (pour le lint de composition : une icône n'a pas besoin de json, son SVG suffit)
  const iconishCache = {}; const iconDeps = new Set();
  const isIconish = (setNode) => {
    if (iconishCache[setNode.id] !== undefined) return iconishCache[setNode.id];
    let r = false;
    try { r = setNode.children.every((ch) => ch.height <= 48 && !ch.findOne((n2) => n2.type === 'TEXT')); } catch (e) {}
    return (iconishCache[setNode.id] = r);
  };
  for (const ins of topRefs) {
    const mc = await ins.getMainComponentAsync();
    if (!mc) continue;
    const parentSet = mc.parent && mc.parent.type === 'COMPONENT_SET' ? mc.parent : null;
    const comp = setName(mc);
    counts[comp] = (counts[comp] || 0) + 1;
    if (parentSet && isIconish(parentSet)) iconDeps.add(comp);
    // v2.13 : les props du snapshot ne voyagent QUE si elles diffèrent des défauts de l'enfant —
    // fini les contradictions donnée/usage (Tabs qui figeait size=sm dans ses children)
    let childDefs = null;
    try { childDefs = parentSet ? parentSet.componentPropertyDefinitions : mc.componentPropertyDefinitions; } catch (e) {}
    const props = {}; const cp = ins.componentProperties || {};
    for (const k in cp) {
      const v = cp[k];
      const dflt = childDefs && childDefs[k] ? childDefs[k].defaultValue : undefined;
      if (dflt !== undefined && v && String(v.value) === String(dflt)) continue;
      // instance-swap résolue en NOM de composant : le lien donnée ↔ icône (props.icon = {swap: "upload"})
      if (v && v.type === 'INSTANCE_SWAP') {
        try { const sn = await figma.getNodeByIdAsync(String(v.value)); if (sn) props[prop(k)] = { swap: setName(sn) }; } catch (e) {}
        continue;
      }
      props[prop(k)] = v && v.value !== undefined ? v.value : v;
    }
    const ref = { component: comp };
    const iname = kebab(ins.name || '');
    if (iname && iname !== kebab(comp)) ref.name = ins.name;
    if (Object.keys(props).length) ref.props = props;
    children.push(ref);
    if (!ins.isExposedInstance && /master|^_/i.test(comp)) unexposedMaster = comp;
  }
  if (children.length) out.structure.children = children;
  const subs = Object.keys(counts);
  if (subs.length) out.structure.uses = subs;
  const repeated = subs.filter((sname) => counts[sname] > 4);
  if (out.meta.extends) {
    // composed via master
  } else if (repeated.length) {
    out.meta.type = 'data-driven';
    out.structure.binding = { note: 'Repetition detected (' + repeated.map((r) => counts[r] + 'x ' + r).join(', ') + ') -> likely data-driven. To confirm.' };
  } else if (children.length) {
    out.meta.type = 'composed';
  }

  // --- arbre de structure (v2.12) : l'imbrication réelle des éléments de la variante par défaut ---
  // Les styles par élément donnent la peinture, l'arbre donne le DOM : une IA à froid peut
  // reconstruire le composant sans deviner l'imbrication. Instances = référence, jamais descendues.
  const treeOf = async (n, d) => {
    const node = { name: kebab(n.name || '') || n.type.toLowerCase() };
    // calque masqué dans cette variante (souvent piloté par une prop show-*) : il reste dans
    // l'arbre pour que les rangs d'homonymes -1/-2 des styles s'alignent sur l'ordre d'arbre
    if (n.visible === false) node.hidden = true;
    if (n.type === 'TEXT') { node.type = 'text'; return node; }
    if (n.type === 'INSTANCE') {
      node.type = 'instance';
      // l'instance nomme son composant : c'est ce qui relie l'arbre au json de la dépendance
      try { const mc = await n.getMainComponentAsync(); if (mc) node.component = setName(mc); } catch (e) {}
      return node;
    }
    if (n.children && n.children.length) {
      const kids = [];
      for (const c of n.children) { const k = await treeOf(c, d + 1); if (k) kids.push(k); }
      if (kids.length) node.children = kids;
    }
    return node;
  };
  // --- styles (v2.13) : capture de TOUTES les variantes d'abord, keying global ensuite ---
  // La même clé désigne le même élément dans toutes les variantes ; les homonymes (globaux
  // au set) reçoivent un suffixe ordinal en ordre d'arbre (-1, -2…), stable entre variantes.
  const defV = await variantStyles(def);
  const allV = [];
  if (isSet) {
    const kids = set.children; // pas d'échantillonnage : la cascade couvre toutes les variantes
    for (let vi = 0; vi < kids.length; vi++) {
      const k = kids[vi];
      // gros sets : progression affichée dans l'UI (le spinner seul est muet pendant de longues secondes)
      if (kids.length > 40 && vi % 20 === 19) figma.ui.postMessage({ type: 'extract-progress', done: vi + 1, total: kids.length });
      if (k === def) continue;
      allV.push({ k, vs: await variantStyles(k) });
    }
  }
  const dup = new Set();
  for (const vs of [defV, ...allV.map((x) => x.vs)]) {
    const cnt = {};
    for (const c of vs.cand) { cnt[c.nm] = (cnt[c.nm] || 0) + 1; if (cnt[c.nm] > 1) dup.add(c.nm); }
  }
  const keyed = (vs) => {
    const kd = { root: vs.root };
    if (vs.label) kd.label = vs.label;
    const seen = {}, elements = {};
    for (const c of vs.cand) {
      const n = seen[c.nm] = (seen[c.nm] || 0) + 1; // le rang se compte sur TOUS les homonymes (stylés ou non)
      if (!Object.keys(c.es).length) continue;
      elements[dup.has(c.nm) ? c.nm + '-' + n : c.nm] = c.es;
    }
    if (Object.keys(elements).length) kd.elements = elements;
    return kd;
  };
  const defS = keyed(defV);
  let cascadeDup = 0; // renseigné par la passe d'overrides, remonté au lint plus bas
  out.styles.default = defS;
  if (isSet && Object.keys(defCfg).length) out.styles.default.when = defCfg; // config de la variante de base
  const cov = {}; let nSampled = 0; // couverture des noms d'éléments entre variantes (lint R1.1)
  if (defS.elements) { for (const key in defS.elements) cov[key] = (cov[key] || 0) + 1; nSampled++; }
  const diffObj = (base, v) => { const o = {}; for (const k in v) if (JSON.stringify(v[k]) !== JSON.stringify(base && base[k])) o[k] = v[k]; return o; };
  if (isSet) {
    const overrides = [];
    for (const { k, vs } of allV) {
      const vsK = keyed(vs);
      nSampled++; if (vsK.elements) for (const key in vsK.elements) cov[key] = (cov[key] || 0) + 1;
      const ov = {};
      const rd = diffObj(defS.root, vsK.root); if (Object.keys(rd).length) ov.root = rd;
      if (vsK.label) { const ld = diffObj(defS.label || {}, vsK.label); if (Object.keys(ld).length) ov.label = ld; }
      if (vsK.elements) { const ed = {}; for (const nm in vsK.elements) { const d = diffObj((defS.elements && defS.elements[nm]) || {}, vsK.elements[nm]); if (Object.keys(d).length) ed[nm] = d; } if (Object.keys(ed).length) ov.elements = ed; }
      if (Object.keys(ov).length) overrides.push({ when: relaxWhen(parseConfig(k.name), out.api.props), styles: ov });
    }
    if (overrides.length) out.styles.overrides = overrides;
    // filet : relâcher un axe peut faire converger deux `when` (le fichier dessine les deux
    // côtés de la combinaison écrasée). La cascade applique alors les deux dans l'ordre et le
    // dernier gagne — conforme à la précédence, mais ça mérite d'être dit plutôt que subi.
    // (le constat est différé : `lint` n'est déclaré que plus bas)
    const seenW = new Set(), dupW = new Set();
    for (const o of overrides) { const sig = JSON.stringify(o.when); if (seenW.has(sig)) dupW.add(sig); else seenW.add(sig); }
    cascadeDup = dupW.size;
  }

  // --- arbres par variante (v2.13), dédupliqués par structure identique ---
  // Un seul arbre si toutes les variantes partagent la structure ; sinon `structure.trees`
  // avec un `when` discriminant (axes dont les valeurs du groupe ne couvrent pas tout l'axe).
  const treeFor = async (v) => { const kidsT = []; for (const c of (v.children || [])) { const t = await treeOf(c, 1); if (t) kidsT.push(t); } return kidsT; };
  const groups = new Map();
  const addTree = (cfg, tree) => { const h = JSON.stringify(tree); if (!groups.has(h)) groups.set(h, { tree, configs: [] }); groups.get(h).configs.push(cfg); };
  addTree(parseConfig(def.name), await treeFor(def));
  if (isSet) for (const { k } of allV) addTree(parseConfig(k.name), await treeFor(k));
  let blindTrees = 0;
  if (groups.size === 1) {
    const only = groups.values().next().value.tree;
    if (only.length) out.structure.tree = only;
  } else {
    const axisOpts = {};
    for (const [pk, pv] of Object.entries(propDefs)) if (pv.type === 'VARIANT') axisOpts[prop(pk)] = (pv.variantOptions || []).map(String);
    out.structure.trees = [...groups.values()].map((g) => {
      const raw = {};
      for (const [axis, opts] of Object.entries(axisOpts)) {
        const vals = [...new Set(g.configs.map((c) => c[axis]).filter((x) => x !== undefined))];
        if (vals.length && vals.length < opts.length) raw[axis] = vals.length === 1 ? vals[0] : vals.sort();
      }
      // l'arbre de l'axe écrasant vaut pour TOUTES les valeurs de l'axe écrasé : garder
      // `is-selected: false` ici laisserait la moitié des cas sans arbre du tout
      const when = relaxWhen(raw, out.api.props);
      // aucun axe ne discrimine seul ce groupe (axes croisés) : le lecteur ne peut pas
      // choisir son arbre sur un `when` vide — on donne les configs entières en repli
      if (!Object.keys(when).length) { blindTrees++; return { when, configs: g.configs, tree: g.tree }; }
      return { when, tree: g.tree };
    });
  }

  const rawHex = (JSON.stringify(out.styles).match(/#[0-9A-Fa-f]{6}/g) || []).length;
  if (rawHex) out.styles._rawHex = rawHex;

  // --- lint d'authoring : l'outil pointe vers le FIGMA (cf. nomenclature-composants.md), pas juste le JSON ---
  const lint = [];
  if (cascadeDup) lint.push({ rule: 'cascade', level: 'hint', msg: cascadeDup + ' override(s) share a when after superseded axes were relaxed (see SUPERSEDES): the later one wins, as precedence says. Check the file draws both sides on purpose.' });
  // composition par référence : les états/styles d'un sous-composant vivent dans SON json.
  // Sans l'export des dépendances, ils disparaissent en silence — on l'avoue à l'export.
  const deps = [...new Set([...(out.structure.uses || []), out.meta.extends].filter(Boolean))];
  const compDeps = deps.filter((d2) => !iconDeps.has(d2));
  const icoDeps = deps.filter((d2) => iconDeps.has(d2));
  if (compDeps.length) lint.push({ rule: 'composition', level: 'warn', msg: 'Composed by reference: also export ' + compDeps.join(', ') + ' — their states and styles live in THEIR json, the corpus is incomplete without them.' });
  if (icoDeps.length) lint.push({ rule: 'composition', level: 'hint', msg: 'Icon set(s) referenced: ' + icoDeps.join(', ') + ' — an SVG export is enough, no json needed.' });
  const ekeys = Object.keys((defS && defS.elements) || {});
  const leaf = (k) => k.split('/').pop().replace(/-\d+$/, '');
  const gen = [...new Set(ekeys.filter((k) => GENERIC.test(leaf(k))).map(leaf))];
  if (gen.length) lint.push({ rule: 'layers', level: 'warn', msg: 'Generic layer name(s) (' + gen.join(', ') + '): name by role (icon-left, dot…).' });
  const homs = ekeys.filter((k) => { const m = k.match(/^(.*)-(\d+)$/); return m && dup.has(m[1]); });
  if (homs.length) lint.push({ rule: 'layers', level: 'hint', msg: homs.length + ' homonym layer(s) disambiguated by tree-order index (-1, -2…): give each a unique, stable role name.' });
  if (nSampled > 3) {
    const rare = Object.keys(cov).filter((k) => cov[k] / nSampled < 0.25);
    if (rare.length) lint.push({ rule: 'layers', level: 'hint', msg: 'Elements present in few variants (' + rare.slice(0, 4).join(', ') + (rare.length > 4 ? '…' : '') + '): conditional, or named differently across variants.' });
  }
  if (isSet) {
    let theo = 1;
    for (const v of Object.values(propDefs)) if (v.type === 'VARIANT') theo *= (v.variantOptions || []).length || 1;
    if (theo > 1 && set.children.length >= theo) lint.push({ rule: 'variants', level: 'hint', msg: 'All combinations generated (' + set.children.length + '/' + theo + '): check none is impossible (exclude it from the set).' });
  }
  if (unexposedMaster && !out.meta.extends) lint.push({ rule: 'master', level: 'hint', msg: 'Nested master "' + unexposedMaster + '" not exposed: expose it (isExposedInstance) to extract extends/exposed.' });
  if (rawHex) lint.push({ rule: 'tokens', level: 'warn', msg: rawHex + ' hardcoded value(s) (HEX): bind variables/tokens.' });
  if (remoteVars.size) lint.push({ rule: 'tokens', level: 'warn', msg: 'Token(s) from an external/legacy library (' + [...remoteVars].join(', ') + '): they will NOT be in the local tokens export — rebind to the equivalent local token.' });
  if (blindTrees) lint.push({ rule: 'structure', level: 'warn', msg: blindTrees + ' structure tree group(s) undiscriminable by any single axis (empty `when`, full `configs` given as fallback): variants cross axes — consider restructuring.' });
  // pas de contrôle du documentation link Figma : la doc vit dans le doc.md versionné (étape 3), le lien ferait doublon

  // --- lint v2 : le vocabulaire de la nomenclature publique (logique partagée : lintProps + sharedFindings) ---
  const lp = lintProps(propDefs);
  const aliasHits = lp.aliasHits.map((a) => '"' + a.from + '" -> "' + a.to + '"');
  // boucles de contenu (texte/swap) : necessitent les noms de layers, donc restent ici
  // boucles de contenu : la prop de texte reprend le nom du layer, la prop de swap celui de l'instance
  // même périmètre que l'autofix : les calques nichés DANS une instance ne comptent pas (non renommables, pas la cible de la boucle)
  const textLayerNames = ownDef.filter((n) => n.type === 'TEXT' && !insideInstance(n, def)).map((n) => kebab(n.name || ''));
  const instNames = ownDef.filter((n) => n.type === 'INSTANCE' && !insideInstance(n, def)).map((n) => kebab(n.name || '')).concat(topRefs.map((n) => kebab(n.name || '')));
  const orphanText = [], orphanSwap = [];
  for (const [k, v] of Object.entries(propDefs)) {
    const base = k.replace(/#.*$/, '').trim();
    const key = prop(k);
    if (v.type === 'TEXT' && textLayerNames.length && !textLayerNames.some((n) => n === key || n.endsWith('-' + key))) orphanText.push(base);
    if (v.type === 'INSTANCE_SWAP' && instNames.length && !instNames.some((n) => n === key || n.endsWith('-' + key))) orphanSwap.push(base);
  }
  if (lp.typeSuffix.length) lint.push({ rule: 'type-in-name', level: 'hint', msg: 'The name carries the type (' + lp.typeSuffix.join(', ') + '): no -swap / -text / -slot, the type already lives in the data.' });
  if (orphanText.length) lint.push({ rule: 'content-props', level: 'hint', msg: 'Text prop(s) with no matching layer (' + orphanText.join(', ') + '): a text prop takes the name of the text layer it fills.' });
  if (orphanSwap.length) lint.push({ rule: 'content-props', level: 'hint', msg: 'Swap prop(s) with no instance layer of the same name (' + orphanSwap.join(', ') + '): rename the instance LAYER to the prop name — not the component that fills it (a renamed layer keeps its name across swaps).' });
  // garde-fou : sans auto-layout sur la variante de référence, padding et gap ne s'extraient pas
  if (def.children && def.children.length > 1 && (!def.layoutMode || def.layoutMode === 'NONE')) lint.push({ rule: 'auto-layout', level: 'hint', msg: 'The reference variant has no auto-layout: padding and gap will not be extracted.' });
  if (lp.noisy.length) lint.push({ rule: 'props', level: 'warn', msg: 'Prop(s) off convention (' + lp.noisy.join(', ') + '): kebab-case, no emoji, no spaces or capitals.' });
  for (const f of sharedFindings(lp, set.description, set.name)) lint.push(f);
  if (aliasHits.length) lint.push({ rule: 'vocabulary', level: 'hint', msg: 'Axes outside the shared vocabulary: ' + aliasHits.join(', ') + '.' });

  // --- doc.md : la couche de jugement fusionnée depuis le fichier fourni (verbatim ; le doc gagne sur Figma) ---
  if (doc && doc.fields) {
    const d = doc.fields;
    if (d.description) {
      if (out.meta.description && out.meta.description !== d.description) lint.push({ rule: 'doc', level: 'hint', msg: 'Description from ' + (doc.name || 'doc.md') + ' overrides the Figma description.' });
      out.meta.description = d.description;
    }
    if (d.role) out.meta.role = d.role;
    if (d.platforms && d.platforms.length) out.platforms = d.platforms;
    if (d.states && d.states.length) out.states = { list: d.states };
    if (d.interaction) out.interaction = { pattern: d.interaction };
    if (d.a11y && d.a11y.length) { out.rules = out.rules || {}; out.rules.a11y = d.a11y; }
    if (d.behavior && d.behavior.length) { out.rules = out.rules || {}; out.rules.behavior = d.behavior; }
    if (d.writing && d.writing.length) { out.rules = out.rules || {}; out.rules.writing = d.writing; }
    if (d.forbidden && d.forbidden.length) {
      out.rules = out.rules || {};
      out.rules.forbidden = d.forbidden; // la prose reste : c'est elle qui porte le pourquoi
      const inv = parseInvalidCombos(d.forbidden, out.api.props);
      if (inv.combos.length) out.api.invalidCombinations = inv.combos;
      for (const nm of inv.nearMiss) lint.push({ rule: 'forbidden', level: 'warn', msg: 'Forbidden line reads like a prop combination but ' + nm.why + ' — kept as prose: "' + nm.line.slice(0, 90) + '"' });
    }
    if (d.examples && d.examples.length) out.examples = d.examples;
    out._doc_source = doc.name || 'doc.md';
  }
  // après la fusion du doc : c'est lui qui porte l'interdit, donc lui qui éteint le rappel
  const selFind = selectionFinding(lp, out.api.props, out.api.invalidCombinations);
  if (selFind) lint.push(selFind);
  if (lint.length) out._lint = lint;

  out._tool = 'component-as-data ' + VERSION;
  // dynamique : ne lister que ce qui manque VRAIMENT (Figma importé ou doc.md fusionné = plus « à compléter »)
  const todo = [];
  if (!out.meta.description) todo.push('description');
  if (/\?/.test(out.meta.role || '?')) todo.push('role');
  if (!(out.platforms && out.platforms.length)) todo.push('platforms');
  if (!(out.states && out.states.list && out.states.list.length)) todo.push('states');
  if (!(out.interaction && out.interaction.pattern)) todo.push('interaction.pattern');
  if (!(out.rules && out.rules.a11y && out.rules.a11y.length)) todo.push('rules.a11y');
  if (!(out.rules && out.rules.behavior && out.rules.behavior.length)) todo.push('rules.behavior');
  if (!(out.rules && out.rules.writing && out.rules.writing.length)) todo.push('rules.writing');
  if (!(out.rules && Array.isArray(out.rules.forbidden))) todo.push('rules.forbidden');
  if (!(out.examples && out.examples.length >= 2)) todo.push('examples');
  out._todo_ai = todo;
  return out;
}

// --- autofix : proposer puis appliquer les renommages de la nomenclature ---
function baseName(setName) {
  const last = String(setName || '').split('/').pop();
  return kebab(last) || 'component';
}
function absX(n) { try { return n.absoluteTransform[0][2]; } catch (e) { return n.x || 0; } }
// les noeuds INTERNES a une instance ne sont pas renommables : on les ecarte du scan et de l'application
function insideInstance(n, root) { let p = n.parent; while (p && p !== root) { if (p.type === 'INSTANCE') return true; p = p.parent; } return false; }

async function autofixScan(set) {
  const comp = baseName(set.name);
  const propDefs = set.componentPropertyDefinitions || {};
  const proposals = [];
  const push = (p) => { p.id = 'f' + proposals.length; proposals.push(p); };
  // constats NON automatisables (structure des axes, description…) : le check doit les montrer aussi,
  // sinon ils n'apparaissent qu'après génération — trop tard dans le parcours (même source que le lint : sharedFindings)
  const findings = sharedFindings(lintProps(propDefs), set.description, set.name);
  // 1. props : kebab-case (coché) + vocabulaire commun (optionnel, décoché)
  for (const k of Object.keys(propDefs)) {
    const base = k.replace(/#.*$/, '').trim();
    const key = prop(k);
    if (base !== key) push({ kind: 'prop', figmaKey: k, from: base, to: key, checked: true, note: 'kebab-case' });
    if (VOCAB_ALIAS[key]) push({ kind: 'prop', figmaKey: k, from: base, to: VOCAB_ALIAS[key], checked: false, note: 'shared vocabulary (optional)' });
    const untyped = key.replace(/^(swap|text|slot)-/, '').replace(/-(swap|text|slot)$/, '');
    if (untyped && untyped !== key) push({ kind: 'prop', figmaKey: k, from: base, to: untyped, checked: false, note: 'the type already lives in the data (optional)' });
  }
  // 2. layers, sur la variante de référence
  const { def } = defaultVariant(set, propDefs);
  if (!def) return { proposals, findings };
  const own = [], refs = [];
  await collectOwn(def, own, refs);
  const fixable = own.filter((n) => !insideInstance(n, def));
  // 2.a swap props orphelines : renommer le CALQUE vers le nom de la prop (ex. placeholder -> icon-left).
  // Signal fort et déterministe : l'instance est matchée par le COMPOSANT PAR DÉFAUT de la prop, pas devinée par son nom.
  const usedSwapNodes = new Set();
  const instNodes = fixable.filter((n) => n.type === 'INSTANCE').concat(refs).sort((a, b) => absX(a) - absX(b));
  const iname = (n) => kebab(n.name || '');
  const swapKeys = Object.entries(propDefs).filter(([, v]) => v.type === 'INSTANCE_SWAP').map(([k]) => prop(k));
  const hasLayer = (key) => instNodes.some((n) => iname(n) === key || iname(n).endsWith('-' + key));
  const orphanDefs = Object.entries(propDefs).filter(([k, v]) => v.type === 'INSTANCE_SWAP' && v.defaultValue && !hasLayer(prop(k)));
  // -left d'abord, -right en dernier : aligné sur le tri par position x des cibles
  const lr = (k) => (/-left$/.test(prop(k)) ? 0 : /-right$/.test(prop(k)) ? 2 : 1);
  orphanDefs.sort((a, b) => lr(a[0]) - lr(b[0]));
  const byDefault = {};
  for (const [, v] of orphanDefs) byDefault[v.defaultValue] = (byDefault[v.defaultValue] || 0) + 1;
  const orderCount = {};
  for (const [k, v] of orphanDefs) {
    const key = prop(k);
    let target = null;
    for (const n of instNodes) {
      if (usedSwapNodes.has(n.id) || swapKeys.some((s) => iname(n) === s || iname(n).endsWith('-' + s))) continue;
      try { const mc = await n.getMainComponentAsync(); if (mc && (mc.key === v.defaultValue || mc.id === v.defaultValue)) { target = n; break; } } catch (e) {}
    }
    if (!target) continue; // pas rempli par son composant par défaut : le lint guide, on ne devine pas
    usedSwapNodes.add(target.id);
    const idx = orderCount[target.name] || 0; orderCount[target.name] = idx + 1;
    const share = byDefault[v.defaultValue];
    const sure = share === 1 || (share === 2 && lr(k) !== 1); // 1:1, ou paire left/right mappée par position
    push({ kind: 'layer', from: target.name, to: key, order: idx, checked: sure, note: sure ? 'layer filled by this swap prop (matched via its default component)' : 'swap prop layer — verify the mapping' });
  }
  // le texte du nom accessible -> {composant}-label — seulement si son nom n'est pas délibéré.
  // Signal déterministe : autoRename encore vrai (le nom suit le contenu, jamais renommé) ou nom
  // générique (« Text 3 »). Un nom choisi par le designer (alert-title, card-description…) est
  // conforme — la nomenclature nomme les autres textes par leur rôle — et n'est pas écrasé.
  const texts = fixable.filter((n) => n.type === 'TEXT');
  const labelTxt = texts.find((n) => /(^|-)label$/.test(kebab(n.name || ''))) || texts[0];
  const unnamedTxt = labelTxt && (labelTxt.autoRename === true || /^text(-\d+)?$/.test(kebab(labelTxt.name || '')));
  if (labelTxt && unnamedTxt && !/(^|-)label$/.test(kebab(labelTxt.name || ''))) push({ kind: 'layer', from: labelTxt.name, to: comp + '-label', order: 0, checked: true, note: 'accessible-name text (layer was never renamed)' });
  // icônes génériques -> icon / icon-left / icon-right (par position)
  const icons = fixable.filter((n) => !usedSwapNodes.has(n.id) && (n.type === 'VECTOR' || n.type === 'BOOLEAN_OPERATION' || n.type === 'INSTANCE') && GENERIC.test(kebab(n.name || ''))).sort((a, b) => absX(a) - absX(b));
  if (icons.length === 1) push({ kind: 'layer', from: icons[0].name, to: 'icon', order: 0, checked: true, note: 'icon' });
  else if (icons.length === 2) { push({ kind: 'layer', from: icons[0].name, to: 'icon-left', order: 0, checked: true, note: 'icon, left position' }); push({ kind: 'layer', from: icons[1].name, to: 'icon-right', order: 1, checked: true, note: 'icon, right position' }); }
  else icons.forEach((n, i) => push({ kind: 'layer', from: n.name, to: 'icon-' + (i + 1), order: i, checked: false, note: 'icon, specify its role' }));
  // LE conteneur visuel générique -> {composant}-box (seulement si non ambigu)
  const boxes = fixable.filter((n) => (n.type === 'FRAME' || n.type === 'RECTANGLE') && GENERIC.test(kebab(n.name || '')));
  if (boxes.length === 1) push({ kind: 'layer', from: boxes[0].name, to: comp + '-box', order: 0, checked: true, note: 'visual container' });
  // instances jamais renommées -> leur rôle. Signal déterministe : le nom du calque EST celui de son
  // composant source (ou de son set), donc personne ne l'a nommé. Le rôle se DÉRIVE quand la source
  // est une sous-partie de l'hôte (bottom-bar / _Bottom-bar-item -> item) ; sinon on propose le nom
  // sans tiret bas ni majuscule, décoché : c'est au designer de dire le rôle joué ici.
  const iconIds = new Set(icons.map((n) => n.id));
  const kept = [];
  for (const n of fixable) {
    if (n.type !== 'INSTANCE' || usedSwapNodes.has(n.id) || iconIds.has(n.id)) continue;
    let src = null;
    try { const mc = await n.getMainComponentAsync(); if (mc) src = (mc.parent && mc.parent.type === 'COMPONENT_SET') ? mc.parent.name : mc.name; } catch (e) {}
    const srcKey = kebab(src || '');
    // comparaison sur le nom BRUT : Figma recopie le nom de la source au caractère près. Dès que le
    // designer y touche (card-header pour un master _Card-header), le nom est délibéré — et conforme.
    if (!srcKey || !src || (n.name || '') !== String(src)) continue;
    const derived = srcKey.indexOf(comp + '-') === 0 && srcKey.length > comp.length + 1;
    const role = derived ? srcKey.slice(comp.length + 1) : srcKey;
    if (!role || role === n.name) continue;
    kept.push({ node: n, role: role, derived: derived });
  }
  kept.sort((a, b) => absX(a.node) - absX(b.node)); // même tri qu'à l'application (homonymes par position)
  const roleN = {};
  for (const k of kept) roleN[k.role] = (roleN[k.role] || 0) + 1;
  const fromN = {}, roleI = {};
  for (const k of kept) {
    const ord = fromN[k.node.name] || 0; fromN[k.node.name] = ord + 1;
    const dup = roleN[k.role] > 1;
    const i = roleI[k.role] || 0; roleI[k.role] = i + 1;
    push({ kind: 'layer', from: k.node.name, to: dup ? k.role + '-' + (i + 1) : k.role, order: ord, checked: k.derived && !dup,
      note: k.derived ? 'instance never renamed (it still carries its source component name)' : 'instance never renamed — confirm the role it plays here' });
  }
  return { proposals, findings };
}

async function autofixApply(set, fixes) {
  let applied = 0; const failed = [];
  // props : une opération par prop, l'API Figma propage aux variantes
  for (const f of fixes) {
    if (f.kind !== 'prop') continue;
    try { set.editComponentProperty(f.figmaKey, { name: f.to }); applied++; }
    catch (e) { failed.push(f.from + ' : ' + String(e && e.message ? e.message : e)); }
  }
  // layers : renommer dans CHAQUE variante ; homonymes matchés par ordre de position (x)
  const groups = {};
  for (const f of fixes) { if (f.kind === 'layer') (groups[f.from] = groups[f.from] || []).push(f); }
  const variants = set.type === 'COMPONENT_SET' ? set.children : [set]; // toutes les variantes, sans plafond
  for (const oldName in groups) {
    const g = groups[oldName];
    for (const v of variants) {
      let matches;
      try { matches = v.findAll((n) => n.name === oldName && !insideInstance(n, v)).sort((a, b) => absX(a) - absX(b)); }
      catch (e) { continue; }
      for (const f of g) {
        const target = matches[typeof f.order === 'number' ? f.order : 0];
        if (!target) continue;
        try { target.name = f.to; applied++; }
        catch (e) { failed.push(oldName + ' : ' + String(e && e.message ? e.message : e)); }
      }
    }
  }
  return { applied, failed };
}

// --- table des tokens : les noms + les valeurs voyagent ensemble ---
// modeName : le mode de DÉPART est propagé à travers les alias inter-collections (dark reste dark) ;
// si la collection cible n'a pas de mode homonyme, repli sur son premier mode
async function resolveVal(val, depth, modeName) {
  if (val && val.type === 'VARIABLE_ALIAS' && depth > 0) {
    const v = await figma.variables.getVariableByIdAsync(val.id);
    if (!v) return null;
    const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
    const modes = (coll && coll.modes) || [];
    const m = modes.find((x) => modeName && x.name === modeName) || modes[0];
    return m ? resolveVal(v.valuesByMode[m.modeId], depth - 1, modeName) : null;
  }
  if (val && typeof val === 'object' && 'r' in val) {
    const h = hex(val);
    return typeof val.a === 'number' && val.a < 1 ? h + ' @ ' + Math.round(val.a * 100) / 100 : h;
  }
  return val === undefined ? null : val;
}
// Export GLOBAL : toutes les variables locales du fichier, pas seulement celles liées au
// composant sélectionné — la table sert le DS entier, un seul export couvre tout un corpus.
// Limite connue : variables LOCALES uniquement (une variable venue d'une lib externe n'y est pas).
async function tokensTable() {
  const out = {};
  let collisions = 0;
  const vars = await figma.variables.getLocalVariablesAsync();
  for (const v of vars) {
    try {
      const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
      const modes = (coll && coll.modes) || [];
      if (!modes.length) continue;
      if (v.name in out) collisions++; // clé = nom nu (celui que le JSON de composant référence) : deux collections homonymes s'écrasent, la dernière gagne
      if (modes.length > 1) {
        const vals = {};
        for (const m of modes) vals[m.name] = await resolveVal(v.valuesByMode[m.modeId], 4, m.name);
        out[v.name] = vals;
      } else {
        out[v.name] = await resolveVal(v.valuesByMode[modes[0].modeId], 4, modes[0].name);
      }
    } catch (e) {}
  }
  // styles de texte locaux (v2.12), sous le préfixe text/ : la typo de PAGE (titres, corps, labels)
  // qu'aucun composant ne porte — c'est la maison des Title/Subtitle d'une maquette
  try {
    const ts = await figma.getLocalTextStylesAsync();
    for (const s of ts) {
      out['text/' + s.name] = {
        fontFamily: s.fontName.family, fontStyle: s.fontName.style, fontSize: s.fontSize,
        lineHeight: s.lineHeight && s.lineHeight.unit !== 'AUTO' ? s.lineHeight.value : null,
      };
    }
  } catch (e) {}
  if (collisions) out._collisions = collisions;
  return out;
}

// --- résolution de cible + messages ---
async function resolveTargetInfo() {
  const sel = figma.currentPage.selection;
  if (!sel.length) return null;
  let n = sel[0], viaInstance = false;
  if (n.type === 'INSTANCE') { const mc = await n.getMainComponentAsync(); if (mc) { n = mc; viaInstance = true; } }
  if (n.type === 'COMPONENT' && n.parent && n.parent.type === 'COMPONENT_SET') n = n.parent;
  if (n.type !== 'COMPONENT_SET' && n.type !== 'COMPONENT') return null;
  return { node: n, viaInstance };
}
async function resolveTarget() { const t = await resolveTargetInfo(); return t ? t.node : null; }
async function pushSelection() {
  const t = await resolveTargetInfo();
  if (!t) { figma.ui.postMessage({ type: 'selection', name: null }); return; }
  const n = t.node;
  let props = 0;
  try { props = Object.keys(n.componentPropertyDefinitions || {}).length; } catch (e) {}
  figma.ui.postMessage({
    type: 'selection', name: n.name,
    kind: n.type === 'COMPONENT_SET' ? 'set' : 'component',
    variants: n.type === 'COMPONENT_SET' ? n.children.length : 0,
    props, viaInstance: t.viaInstance,
  });
}
figma.on('selectionchange', pushSelection);
pushSelection();

// --- dispatcher : chaque commande = un handler ; le scaffolding (cible, erreurs) est unique ---
const HANDLERS = {
  'extract': { needsTarget: true, run: async (node, msg) => ({ type: 'extracted', data: await extract(node, msg.doc || null) }) },
  // le token de l'UI revient tel quel : c'est ce qui lui permet de jeter la réponse d'un scan
  // lancé pour une cible qu'on a quittée depuis (sinon elle s'affiche sous le nom de la nouvelle)
  'autofix-scan': { needsTarget: true, run: async (node, msg) => { const r = await autofixScan(node); return { type: 'autofix-proposals', token: msg.token, proposals: r.proposals, findings: r.findings }; } },
  'autofix-apply': {
    needsTarget: true,
    run: async (node, msg) => {
      const result = await autofixApply(node, msg.fixes || []);
      figma.notify(result.applied + ' rename(s) applied — Cmd/Ctrl+Z to undo'); // toast canvas : l'utilisateur regarde souvent le composant à ce moment-là
      return { type: 'autofix-done', result };
    },
  },
  'tokens': { needsTarget: false, run: async () => ({ type: 'tokens', data: await tokensTable() }) },
  'resize': {
    needsTarget: false,
    run: async (node, msg) => {
      const w = Math.max(480, Math.min(1400, Math.round(msg.w || 0)));
      const h = Math.max(480, Math.min(1200, Math.round(msg.h || 0)));
      figma.ui.resize(w, h);
      clearTimeout(sizeTimer); // sauvegarde débouncée : une écriture en fin de drag, pas une par pixel
      sizeTimer = setTimeout(() => { figma.clientStorage.setAsync('ui-size', { w, h }).catch(() => {}); }, 400);
      return null;
    },
  },
  // l'UI signale qu'elle est chargée : on lui renvoie la version (l'en-tête l'affiche) + l'état de sélection
  'ui-ready': { needsTarget: false, run: async () => { await pushSelection(); return { type: 'init', version: VERSION }; } },
};
figma.ui.onmessage = async (msg) => {
  const h = HANDLERS[msg.type];
  if (!h) return;
  let node = null;
  if (h.needsTarget) {
    node = await resolveTarget();
    if (!node) { figma.ui.postMessage({ type: 'error', message: 'Select a component (or a component set).' }); return; }
  }
  try { const out = await h.run(node, msg); if (out) figma.ui.postMessage(out); }
  catch (e) { figma.ui.postMessage({ type: 'error', message: String(e && e.message ? e.message : e) }); }
};
