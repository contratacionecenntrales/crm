import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function OficinaPage() {
  const mod = APP_MODULES.find((m) => m.slug === "oficina")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
