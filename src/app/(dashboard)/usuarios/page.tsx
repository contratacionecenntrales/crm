import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function UsuariosPage() {
  const mod = APP_MODULES.find((m) => m.slug === "usuarios")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
