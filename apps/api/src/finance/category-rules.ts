type CategoryInput = {
  description: string;
  kind: string;
  amountCents: number;
  category?: string | null;
  paymentData?: { receiver?: { name?: string } };
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const GOODS: Record<string, string> = {
  groceries: "Compras — Supermercado", mercado: "Compras — Supermercado",
  houseware: "Compras — Casa e utilidades", casa: "Compras — Casa e utilidades",
  electronics: "Compras — Eletrônicos",
  clothing: "Compras — Vestuário", vestuario: "Compras — Vestuário",
  bookstore: "Compras — Livros",
  "kids and toys": "Compras — Brinquedos",
  pharmacy: "Compras — Farmácia e saúde", farmacia: "Compras — Farmácia e saúde",
  shopping: "Compras — Outros", compras: "Compras — Outros",
  "online shopping": "Compras — Outros",
  "vehicle maintenance": "Transporte — Manutenção",
};

// Rules specific to this personal installation. Unknown Pix recipients are not
// assigned a purpose from their name or amount alone. Manual overrides are
// enforced by the caller's conditional database update.
export function inferFinanceCategory(input: CategoryInput): string | null {
  if (input.kind !== "expense") return null;
  const description = normalize(input.description);
  const category = normalize(input.category ?? "");
  const receiver = normalize(input.paymentData?.receiver?.name ?? "");
  if (/^pagamento (de |da )?fatura\b/.test(description) || category === "credit card payment") {
    return "Cartões — Pagamento de fatura";
  }
  if (input.amountCents === 120000 && /\bpix\b/.test(description) &&
    (receiver === "luciana sousa dos santos vilhanueva" ||
      description.endsWith("luciana sousa dos santos vilhanueva"))) {
    return "Moradia — Financiamento";
  }
  if (/\b(pref mun guaruja|pm guaruja|iptu)\b/.test(description)) return "Moradia — IPTU";
  if (/\b(cond edif resid itaparica iii|condominio)\b/.test(description)) return "Moradia — Condomínio";
  if (/\b(elektro|eletricidade|energia eletrica)\b/.test(description)) return "Moradia — Eletricidade";
  if (/\btelefonica brasil\b/.test(description)) return "Moradia — Internet e telefonia";

  if (/\b(hostinger|hostingercomb)\b/.test(description)) return "Assinaturas — Hospedagem e domínios";
  if (/\b(openai|chatgpt|anthropic|claude|openrouter|github|kaspersky|microsoft)\b/.test(description)) {
    return "Assinaturas — IA e software";
  }
  if (/\b(praktika|praktikaai)\b/.test(description)) return "Assinaturas — Idiomas";
  if (/\b(totalpass|total pass|m j b academia)\b/.test(description)) return "Assinaturas — Academia e bem-estar";
  if (/\b(netflix|spotify|paramountplus|rokuglobo|brasil paral|brasil paralelo|melimais)\b/.test(description) ||
      /\bamazon prime canais\b|\byoutube\b.*\bmember\b|\bdl google youtub\b/.test(description)) {
    return "Assinaturas — Streaming e conteúdo";
  }
  if (/\bapple( com bill|combill)\b/.test(description)) return "Assinaturas — Apps e serviços";
  // Keep marketplace goods out of residential internet/phone bills, even if
  // the provider classifies an accessory as Telecommunications or Internet.
  if (/\b(mercadolivre|amazonmktplc|shopee|temu)\b/.test(description)) {
    return GOODS[category] ?? "Compras — Outros";
  }
  if (/\bifood club\b/.test(description)) return "Assinaturas — Delivery";
  if (category === "groceries") return GOODS.groceries;
  if (/\b(ifood|ifd|99food)\b/.test(description) || category === "food delivery") return "Alimentação — Delivery";
  if (category === "eating out" || category === "restaurants") return "Alimentação — Restaurantes";
  if (/\b(uber|99|pop)\b/.test(description) || category === "taxi and ride hailing") return "Transporte — Aplicativos";
  if (category === "public transportation" || /\b(clickbus|autopass)\b/.test(description)) return "Transporte — Ônibus e metrô";
  if (category === "internet" || category === "telecommunications") return "Moradia — Internet e telefonia";
  if (/\b(barboza drogaria|drogaria|drogarias)\b/.test(description)) return "Compras — Farmácia e saúde";
  if (/\b(maxtitanium)\b/.test(description)) return "Compras — Suplementos";
  if (/\binfo master informati\b/.test(description)) return "Compras — Eletrônicos";
  if (category === "cinema theater and concerts" || /\bcinemark\b/.test(description) ||
      description === "amazon prime aluguel") return "Lazer — Cinema e eventos";
  if (category === "dentist") return "Saúde — Odontologia";
  if (category === "optometry") return "Saúde — Ótica";
  if (/\b(cod ar me|codar me|cursodev|lucasmontano|camargo e carvalho)\b/.test(description) ||
      category === "education" || category === "school") return "Educação — Cursos";
  if (category === "travel" || category === "airport and airlines" ||
      /\b(tripcom|trip com|bookingcom|booking|decolar)\b/.test(description)) return "Viagens";
  return GOODS[category] ?? null;
}
