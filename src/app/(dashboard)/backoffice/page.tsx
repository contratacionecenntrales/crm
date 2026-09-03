import { ComingSoon } from "@/components/ComingSoon";
import { APP_MODULES } from "@/lib/modules";

export default function BackofficePage() {
  const mod = APP_MODULES.find((m) => m.slug === "backoffice")!;
  return <ComingSoon label={mod.label} description={mod.description} />;
}
