export interface EcuadorBank {
  code: string;
  name: string;
  swift: string;
}

export const ECUADOR_BANKS: EcuadorBank[] = [
  { code: "pichincha", name: "Banco Pichincha", swift: "PICHECEQ" },
  { code: "guayaquil", name: "Banco de Guayaquil", swift: "GUAYECEG" },
  { code: "pacifico", name: "Banco del Pacífico", swift: "PACIECEG" },
  { code: "produbanco", name: "Produbanco", swift: "PRODECEQ" },
  { code: "internacional", name: "Banco Internacional", swift: "INTLECE1" },
  { code: "bolivariano", name: "Banco Bolivariano", swift: "BBOLECEG" },
];

export const ECUADOR_BANK_OTHER_CODE = "other";

export function findEcuadorBank(code: string): EcuadorBank | undefined {
  return ECUADOR_BANKS.find((b) => b.code === code);
}
