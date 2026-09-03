import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function SalesCrmPage() {
  const mod = APP_MODULES.find((m) => m.slug === "sales-crm")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
