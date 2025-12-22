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
  mandatory_statement: string; // enthält HTML
  description: string;
  ADDON_additive_function_class?: XanoAdditiveClass;
}

export interface XanoSubcomponent {
  id: number;
  name: string;
  component_ingredient_ids: XanoIngredient[];
  subcomponents?: XanoSubcomponent[]; // Rekursive Struktur für verschachtelte Subkomponenten
}

export interface XanoComponent {
  id: number;
  name: string;
  component_ingredient_ids: XanoIngredient[];
  subcomponents?: XanoSubcomponent[]; // Subkomponenten können auch Zutaten haben
}

export interface XanoProduct {
  id: number;
  name: string;
  printer_components_ids: XanoComponent[];
}

/**
 * Zutaten generieren:
 * ✔ Doppelte Zutaten per ID eliminiert
 * ✔ Anzeige-Name:
 *    - NUR wenn Stoffklasse (= Zusatzstoff) vergeben ist UND e_number != 0 → "E123"
 *    - sonst Ingredient-Name
 * ✔ Allergene:
 *    - wenn der ANZEIGE-Name (Name oder E-Nummer) den Allergen-Namen enthält → dieser Teil im Namen fett
 *    - sonst → Allergenname hinten in Klammern
 * ✔ mandatory_statement ist HTML und wird unverändert (in Klammern) angehängt
 * ✔ Zusatzstoffe werden nach Funktionsklasse gruppiert, z. B.:
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

  // Hilfsfunktion: Rekursiv alle Zutaten aus Subkomponenten sammeln
  function collectIngredientsFromSubcomponents(subcomponents: XanoSubcomponent[] | undefined) {
    if (!subcomponents) return;
    for (const subcomp of subcomponents) {
      // Zutaten der Subkomponente sammeln
      for (const ing of subcomp.component_ingredient_ids || []) {
        collected.push(ing);
      }
      // Rekursiv verschachtelte Subkomponenten durchlaufen
      if (subcomp.subcomponents) {
        collectIngredientsFromSubcomponents(subcomp.subcomponents);
      }
    }
  }

  // 1) Zutaten einsammeln (Komponenten + Subkomponenten)
  for (const comp of product.printer_components_ids || []) {
    // Direkte Zutaten der Komponente
    for (const ing of comp.component_ingredient_ids || []) {
      collected.push(ing);
    }
    // Zutaten aus Subkomponenten
    if (comp.subcomponents) {
      collectIngredientsFromSubcomponents(comp.subcomponents);
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

  // 3) Zutaten splitten: normale vs Zusatzstoffe (mit Stoffklasse)
  const normalParts: string[] = [];
  const additiveGroups = new Map<
    string,
    { className: string; entries: string[] }
  >();

  for (const ing of ingredients) {
    const hasAllergens = ing.allergen_ids && ing.allergen_ids.length > 0;
    const className = ing.ADDON_additive_function_class?.name?.trim();
    const isAdditive =
      !!className && !!ing.additive_function_class_id; // NUR dann Zusatzstoff

    // ---- 3.1 Anzeige-Name bestimmen (Text, ohne HTML) ----
    // Regel:
    // - Wenn Zusatzstoff (Stoffklasse gesetzt) und e_number != 0 → "E123"
    // - sonst normaler Ingredient-Name
    let displayNameText = "";

    if (isAdditive && ing.e_number && ing.e_number !== 0) {
      displayNameText = `E${ing.e_number}`;
    } else {
      displayNameText = ing.name || "";
    }

    // Name als HTML (escaped) – noch ohne Allergene & mandatory_statement
    let nameHtml = escapeHtml(displayNameText);

    // mandatory_statement: enthält HTML, wird NICHT escaped
    const mandatoryHtml =
      ing.mandatory_statement && ing.mandatory_statement.trim() !== ""
        ? ing.mandatory_statement.trim()
        : "";

    // ---- 3.2 ALLERGEN-LOGIK (bezogen auf displayNameText) ----
    if (hasAllergens) {
      const displayLower = displayNameText.toLowerCase().trim();
      const matchedAllergens: string[] = [];
      const appendedAllergens: string[] = [];

      for (const allergen of ing.allergen_ids) {
        const allergenName = allergen.name?.trim() || "";
        if (!allergenName) continue;

        const allergenLower = allergenName.toLowerCase();

        // Prüfen, ob der *angezeigte Name* (E123 oder Ingredient-Name)
        // den Allergen-Namen enthält
        if (displayLower.includes(allergenLower)) {
          matchedAllergens.push(allergenName);
        } else {
          // Allergen kann nicht "im Namen" gezeigt werden → später in Klammern
          appendedAllergens.push(allergenName);
        }
      }

      // Hilfsfunktion für RegExp-Sicherheit
      function escapeRegExp(str: string) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }

      // 1) Allergene, die im Anzeige-Namen vorkommen, dort fett hervorheben
      let highlightedNameHtml = nameHtml;
      for (const a of matchedAllergens) {
        const regex = new RegExp(escapeRegExp(a), "ig");
        highlightedNameHtml = highlightedNameHtml.replace(
          regex,
          (m) => `<strong>${m}</strong>`
        );
      }

      nameHtml = highlightedNameHtml;

      // 2) Allergene, die NICHT im Anzeige-Namen vorkommen, hinten in Klammern
      if (appendedAllergens.length > 0) {
        nameHtml += ` (<strong>${appendedAllergens.join(", ")}</strong>)`;
      }
    }

    // ---- 3.3 mandatory_statement hinten anhängen (HTML, in Klammern) ----
    let baseHtml = nameHtml;
    if (mandatoryHtml) {
      baseHtml += ` (${mandatoryHtml})`;
    }

    // ---- 3.4 Zutat einsortieren ----
    if (!isAdditive) {
      // normale Zutat
      normalParts.push(baseHtml);
    } else {
      // Zusatzstoff mit Stoffklasse
      let group = additiveGroups.get(className!);
      if (!group) {
        group = { className: className!, entries: [] };
        additiveGroups.set(className!, group);
      }

      if (!group.entries.includes(baseHtml)) {
        group.entries.push(baseHtml);
      }
    }
  }

  // 4) Zusatzstoff-Gruppen formatieren:
  // z.B. "Konservierungsstoff: (E211, E223 (enthält Schwefel))"
  const additiveParts: string[] = [];
  for (const group of Array.from(additiveGroups.values())) {
    const inner = group.entries.join(", ");
    const text = `${escapeHtml(group.className)}: (` + inner + `)`;
    additiveParts.push(text);
  }

  // 5) Output zusammenführen
  const out: string[] = [];
  if (normalParts.length) out.push(normalParts.join(", "));
  if (additiveParts.length) out.push(additiveParts.join(", "));

  return { ingredientsHtml: out.join(", ") };
}
