import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function PermisosPage() {
  const mod = APP_MODULES.find((m) => m.slug === "permisos")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
