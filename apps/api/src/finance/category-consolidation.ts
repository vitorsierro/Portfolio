const REDIRECTS: Record<string, string> = {
  "compras suplementos": "Compras — Supermercado",
  "compras farmacia e saude": "Compras — Supermercado",
  "transporte onibus e metro": "Transporte",
  "transporte manutencao": "Transporte",
  "transporte aplicativos": "Transporte",
  "saude otica": "Saúde",
  "saude odontologia": "Saúde",
  "assinaturas delivery": "Assinaturas",
  "assinaturas idiomas": "Assinaturas",
  "assinaturas hospedagem e dominios": "Assinaturas — Software, hospedagem e IA",
  "assinaturas ia e software": "Assinaturas — Software, hospedagem e IA",
  fundos: "Investimentos",
  mercado: "Compras — Supermercado",
  compras: "Compras — Outros",
  moradia: "Outros",
  "contas e servicos": "Outros",
  cartoes: "Outros",
};

// Applies only to ledger categories, not the asset types of manual investments.
export function canonicalFinanceCategory(name: string): string {
  const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return REDIRECTS[key] ?? name;
}
