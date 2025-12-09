// app/lib/xanoIngredients.ts

export interface XanoAllergen {
  id: number;
  code: string;
  name: string;
  description: string;
}

export interface XanoAdditiveClass {
  id: number;
  code: string;
  name: string; // z.B. "Konservierungsstoff"
}

export interface XanoIngredient {
  id: number;
  name: string;
  e_number: number;
  allergen_ids: XanoAllergen[];
  additive_function_class_id: number;
  mandatory_statement: string;
  description: string;
  ADDON_additive_function_class?: XanoAdditiveClass;
}

export interface XanoComponent {
  id: number;
  name: string;
  component_ingredient_ids: XanoIngredient[];
}

export interface XanoProduct {
  id: number;
  name: string;
  printer_components_ids: XanoComponent[];
}

/**
 * Zutaten generieren:
 * ✔ Doppelte Zutaten per ID eliminiert
 * ✔ Allergene fett markiert
 * ✔ Mandatory statements in Klammern direkt am Ingredient
 * ✔ Zusatzstoff-Gruppen als:
 *   Konservierungsstoff: (E200, E223 (enthält Schwefel))
 */
export function buildIngredientsFromProduct(product: XanoProduct): {
  ingredientsHtml: string;
} {
  function escapeHtml(text: string) {
    return (text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  const collected: XanoIngredient[] = [];

  // 1) Zutaten einsammeln
  for (const comp of product.printer_components_ids || []) {
    for (const ing of comp.component_ingredient_ids || []) {
      collected.push(ing);
    }
  }

  // 2) Doppelte Zutaten eliminieren
  const uniqueMap = new Map<number, XanoIngredient>();
  for (const ing of collected) {
    if (!uniqueMap.has(ing.id)) {
      uniqueMap.set(ing.id, ing);
    }
  }
  const ingredients = Array.from(uniqueMap.values());

  // 3) Zutaten splitten: normale vs Zusatzstoffe
  const normalParts: string[] = [];
  const additiveGroups = new Map<string, { className: string; entries: string[] }>();

  for (const ing of ingredients) {
    const hasAllergens = ing.allergen_ids && ing.allergen_ids.length > 0;
    const className = ing.ADDON_additive_function_class?.name?.trim();
    const isAdditive = !!className && !!ing.additive_function_class_id;

    // Basistext bestimmen:
    let base = "";

    if (isAdditive && ing.e_number && ing.e_number !== 0) {
      base = `E${ing.e_number}`;
    } else {
      base = ing.name || "";
    }

    base = escapeHtml(base);

    // Mandatory statement anhängen (falls vorhanden)
    if (ing.mandatory_statement && ing.mandatory_statement.trim() !== "") {
      const stmt = escapeHtml(ing.mandatory_statement.trim());
      base = `${base} (${stmt})`;
    }

    // Allergene fett markieren
    if (hasAllergens) {
      base = `<strong>${base}</strong>`;
    }

    if (!isAdditive) {
      normalParts.push(base);
    } else {
      let group = additiveGroups.get(className!);
      if (!group) {
        group = { className: className!, entries: [] };
        additiveGroups.set(className!, group);
      }

      if (!group.entries.includes(base)) {
        group.entries.push(base);
      }
    }
  }

  // Zusatzstoff-Gruppen formatieren:
  // Konservierungsstoff: (E211, E223 (mit Schwefel))
  const additiveParts: string[] = [];
  for (const group of Array.from(additiveGroups.values())) {
    const inner = group.entries.join(", ");
    const text =
      `${escapeHtml(group.className)}: (` +
      inner +
      `)`;
    additiveParts.push(text);
  }

  // 4) Output zusammenführen
  const out: string[] = [];
  if (normalParts.length) out.push(normalParts.join(", "));
  if (additiveParts.length) out.push(additiveParts.join(", "));

  return { ingredientsHtml: out.join(", ") };
}
