import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { eur, estadoFacturaClass, formatFecha, type EstadoFactura } from "@/lib/intranet";

export type Factura = {
  id: string;
  user_id: string;
  concepto: string;
  cliente: string;
  importe: number;
  fecha: string;
  comprobante: string | null;
  estado: EstadoFactura;
};

const TIPOS_PERMITIDOS = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const ESTADOS_FACTURA: EstadoFactura[] = ["Pendiente", "Aprobada", "Pagada"];

function sanitizarNombreArchivo(nombre: string) {
  return nombre
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "_")
    .slice(-100);
}

export function FacturacionTab({
  facturas,
  userId,
  esAdmin = false,
  comerciales = {},
}: {
  facturas: Factura[];
  userId: string;
  esAdmin?: boolean;
  comerciales?: Record<string, string>;
}) {
  const qc = useQueryClient();
  const [concepto, setConcepto] = useState("");
  const [cliente, setCliente] = useState("");
  const [importe, setImporte] = useState("");
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [archivo, setArchivo] = useState<File | null>(null);

  function onArchivoChange(file: File | null) {
    if (!file) {
      setArchivo(null);
      return;
    }
    if (!TIPOS_PERMITIDOS.includes(file.type)) {
      toast.error("Solo se admiten archivos PDF, JPG, PNG o WEBP");
      return;
    }
    if (file.size > TAMANO_MAXIMO) {
      toast.error("El archivo supera el tamaño máximo de 10 MB");
      return;
    }
    setArchivo(file);
  }

  const crear = useMutation({
    mutationFn: async () => {
      let comprobante: string | null = null;
      if (archivo) {
        const ruta = `${userId}/${crypto.randomUUID()}-${sanitizarNombreArchivo(archivo.name)}`;
        const { error } = await supabase.storage
          .from("comprobantes")
          .upload(ruta, archivo, { contentType: archivo.type });
        if (error) throw error;
        comprobante = ruta;
      }
      const { error } = await supabase.from("facturacion").insert({
        user_id: userId,
        concepto,
        cliente,
        importe: Number(importe.replace(",", ".")) || 0,
        fecha,
        comprobante,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Factura registrada");
      setConcepto("");
      setCliente("");
      setImporte("");
      setArchivo(null);
      qc.invalidateQueries({ queryKey: ["facturacion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actualizarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EstadoFactura }) => {
      const { error } = await supabase.from("facturacion").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["facturacion"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function abrirComprobante(ruta: string) {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(ruta, 60);
    if (error || !data) {
      toast.error("No se pudo abrir el comprobante");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-lg font-semibold text-ink-100">Registrar facturación</h2>
        <p className="text-xs text-ink-500">Toda alta entra como Pendiente de validación.</p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
        >
          <Campo label="Concepto">
            <input
              required
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Licencia anual"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <Campo label="Cliente">
            <input
              required
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="SolarTech"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Importe €">
              <input
                required
                inputMode="decimal"
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                placeholder="12400"
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none placeholder:text-ink-500 focus:border-brand"
              />
            </Campo>
            <Campo label="Fecha">
              <input
                required
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 font-mono text-sm text-ink-100 outline-none focus:border-brand"
              />
            </Campo>
          </div>
          <Campo label="Comprobante (opcional)">
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => onArchivoChange(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-line bg-card px-3 py-2 text-xs text-ink-400 outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:font-semibold file:text-brand focus:border-brand"
            />
            <span className="mt-1 block text-[10px] text-ink-500">
              PDF, JPG, PNG o WEBP · máx. 10 MB
            </span>
          </Campo>
          <button
            type="submit"
            disabled={crear.isPending}
            className="w-full rounded-xl bg-brand py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground glow-brand disabled:opacity-60"
          >
            {crear.isPending ? "Subiendo…" : "Registrar factura"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-100">Histórico de facturas</h2>
          <span className="font-mono text-[11px] text-ink-500">{facturas.length} registros</span>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-widest text-ink-400">
                <th className="pb-2 pr-3 font-medium">Concepto</th>
                {esAdmin && <th className="pb-2 pr-3 font-medium">Comercial</th>}
                <th className="pb-2 pr-3 font-medium">Cliente</th>
                <th className="pb-2 pr-3 font-medium">Fecha</th>
                <th className="pb-2 pr-3 text-right font-medium">Importe</th>
                <th className="pb-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {facturas.map((f) => (
                <tr key={f.id}>
                  <td className="py-3 pr-3">
                    <p className="font-medium text-ink-100">{f.concepto}</p>
                    {f.comprobante && (
                      <button
                        onClick={() => abrirComprobante(f.comprobante!)}
                        className="font-mono text-[10px] text-brand hover:underline"
                      >
                        ver comprobante
                      </button>
                    )}
                  </td>
                  {esAdmin && (
                    <td className="py-3 pr-3 text-ink-200">{comerciales[f.user_id] ?? "—"}</td>
                  )}
                  <td className="py-3 pr-3 text-ink-200">{f.cliente}</td>
                  <td className="py-3 pr-3 font-mono text-[11px] text-ink-500">
                    {formatFecha(f.fecha)}
                  </td>
                  <td className="py-3 pr-3 text-right font-mono font-semibold text-ink-100">
                    {eur.format(Number(f.importe))}
                  </td>
                  <td className="py-3">
                    {esAdmin ? (
                      <select
                        value={f.estado}
                        onChange={(e) =>
                          actualizarEstado.mutate({
                            id: f.id,
                            estado: e.target.value as EstadoFactura,
                          })
                        }
                        className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest outline-none ${estadoFacturaClass[f.estado]}`}
                      >
                        {ESTADOS_FACTURA.map((estado) => (
                          <option key={estado} value={estado} className="bg-card text-ink-100">
                            {estado}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`rounded-md px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${estadoFacturaClass[f.estado]}`}
                      >
                        {f.estado}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {facturas.length === 0 && (
                <tr>
                  <td colSpan={esAdmin ? 6 : 5} className="py-8 text-center text-sm text-ink-500">
                    Todavía no has registrado ninguna factura.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}
