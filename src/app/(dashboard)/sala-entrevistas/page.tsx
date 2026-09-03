import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function SalaEntrevistasPage() {
  const mod = APP_MODULES.find((m) => m.slug === "sala-entrevistas")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
