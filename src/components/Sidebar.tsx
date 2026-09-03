"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_MODULES } from "@/lib/modules";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <Image src="/logo-labs24k-icon.png" alt="Labs24K" width={32} height={32} priority />
        <span className="text-sm font-semibold tracking-tight text-gray-900">
          Bóveda Labs24K
        </span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pb-4">
        {APP_MODULES.map((mod) => {
          const active = pathname.startsWith(mod.href);
          return (
            <Link
              key={mod.slug}
              href={mod.href}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-gray-900 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <span>{mod.label}</span>
              {mod.status === "soon" && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  Pronto
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
