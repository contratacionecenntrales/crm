import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function FormacionPage() {
  const mod = APP_MODULES.find((m) => m.slug === "formacion")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
