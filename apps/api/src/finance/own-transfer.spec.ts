import { isOwnPix } from "./own-transfer";

describe("identificação de Pix próprios", () => {
  it.each(["Pix recebido de Vitor Hugo de Souza Sierro", "PIX ENVIADO - VÍTOR HUGO DE SOUZA SIERRO", "pix: vitor   hugo de souza sierro - banco"])("identifica descrições antigas: %s", (description) => {
    expect(isOwnPix({ description })).toBe(true);
  });

  it.each(["CREDIT", "DEBIT"])("usa a contraparte do Pix %s", (type) => {
    const participant = { name: "Vitor Hugo de Souza Sierro" };
    expect(isOwnPix({
      type, description: "Transferência", paymentData: {
        paymentMethod: "PIX",
        ...(type === "CREDIT" ? { payer: participant } : { receiver: participant }),
      },
    })).toBe(true);
  });

  it.each(["CREDIT", "DEBIT"])("preserva Pix com terceiros quando o titular aparece no lado %s", (type) => {
    expect(isOwnPix({
      type, description: "PIX Vitor Hugo de Souza Sierro", paymentData: {
        paymentMethod: "PIX",
        payer: { name: type === "CREDIT" ? "Outra pessoa" : "Vitor Hugo de Souza Sierro" },
        receiver: { name: type === "CREDIT" ? "Vitor Hugo de Souza Sierro" : "Outra pessoa" },
      },
    })).toBe(false);
  });

  it.each(["Pix Vitor Hugo", "TED Vitor Hugo de Souza Sierro", "Pix Vitor Hugo de Souza Sierros", "Pix Maria de Souza"])("preserva nomes incompletos, outros titulares e outros meios: %s", (description) => {
    expect(isOwnPix({ description })).toBe(false);
  });
});
