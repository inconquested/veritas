// Using Bun's native modern equivalents for paths
const localesDir = new URL("../app/_i18n/locales/", import.meta.url).pathname;
const LOCALES = ["en", "id", "es", "zh-CN"];

// --- Backend error keys the API/actions reference but the JSON lacked. ---
const backendErrors = {
  "errors.escrow.forbidden": { en: "You're not allowed to perform this escrow action.", id: "Kamu tidak diizinkan melakukan tindakan escrow ini.", es: "No tienes permiso para realizar esta acción de custodia.", "zh-CN": "你无权执行此托管操作。" },
  "errors.escrow.unknown_action": { en: "That escrow action isn't recognized.", id: "Tindakan escrow itu tidak dikenali.", es: "Esa acción de custodia no se reconoce.", "zh-CN": "无法识别该托管操作。" },
  "errors.escrow.bad_signature": { en: "We couldn't verify this escrow request.", id: "Kami tidak bisa memverifikasi permintaan escrow ini.", es: "No pudimos verificar esta solicitud de custodia.", "zh-CN": "我们无法验证此托管请求。" },
  "errors.escrow.failed": { en: "The escrow action couldn't be completed.", id: "Tindakan escrow belum bisa diselesaikan.", es: "No se pudo completar la acción de custodia.", "zh-CN": "托管操作无法完成。" },
  "errors.invoice.creation_failed": { en: "We couldn't create the invoice.", id: "Faktur belum bisa dibuat.", es: "No pudimos crear la factura.", "zh-CN": "我们无法创建发票。" },
  "errors.invoice.charge_failed": { en: "We couldn't start the payment.", id: "Pembayaran belum bisa dimulai.", es: "No pudimos iniciar el pago.", "zh-CN": "我们无法发起付款。" },
  "errors.invoice.update_failed": { en: "We couldn't update the invoice.", id: "Faktur belum bisa diperbarui.", es: "No pudimos actualizar la factura.", "zh-CN": "我们无法更新发票。" },
  "errors.invoice.delete_failed": { en: "We couldn't delete the invoice.", id: "Faktur belum bisa dihapus.", es: "No pudimos eliminar la factura.", "zh-CN": "我们无法删除发票。" },
  "errors.invoices.fetch_failed": { en: "We couldn't load invoices.", id: "Faktur belum bisa dimuat.", es: "No pudimos cargar las facturas.", "zh-CN": "我们无法加载发票。" },
};

// Bun Native: Read and parse JSON directly from a file link natively
const groupsFile = Bun.file(new URL("i18n-entries.json", import.meta.url));
const groups = await groupsFile.json();
groups.push(backendErrors);

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof node[k] !== "object" || node[k] === null) node[k] = {};
    node = node[k];
  }
  node[parts[parts.length - 1]] = value;
}

let added = 0;

// Process locales concurrently using Promise.all
await Promise.all(
  LOCALES.map(async (locale) => {
    const filePath = `${localesDir}/${locale}.json`;
    const targetFile = Bun.file(filePath);

    // Bun Native: Read base JSON file directly into an object
    const json = await targetFile.json();

    for (const group of groups) {
      for (const [dotKey, byLocale] of Object.entries(group)) {
        const val = byLocale[locale];
        if (typeof val !== "string") throw new Error(`Missing ${locale} for ${dotKey}`);
        setPath(json, dotKey, val);
        added++;
      }
    }

    // Bun Native: Optimized high-performance file writer
    const outputString = JSON.stringify(json, null, 2) + "\n";
    await Bun.write(filePath, outputString);

    console.log(`${locale}.json <- processed updates`);
  })
);

console.log(`Done. ${added / LOCALES.length} keys x ${LOCALES.length} locales.`);
