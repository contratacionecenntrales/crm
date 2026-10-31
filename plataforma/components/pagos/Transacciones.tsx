'use client';
import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { estilosBoton } from '@/components/ui/clases';
import { FormularioCobro } from './Cobro';

export function BotonCobroSuelto({ subId }: { subId: string }) {
  const [abierto, setAbierto] = useState(false);
  const cerrar = useCallback(() => setAbierto(false), []);
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={estilosBoton.primario}><Plus className="size-4" /> Registrar cobro</button>
      <Modal abierto={abierto} alCerrar={cerrar} titulo="Registrar cobro sin factura" ancho="max-w-md">
        {abierto && <FormularioCobro subId={subId} facturaId={null} alGuardar={cerrar} />}
      </Modal>
    </>
  );
}
