export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      configuracion: {
        Row: {
          id: boolean;
          objetivo_trimestral_defecto: number;
          comision_porcentaje_defecto: number;
          updated_at: string;
        };
        Insert: {
          id?: boolean;
          objetivo_trimestral_defecto?: number;
          comision_porcentaje_defecto?: number;
          updated_at?: string;
        };
        Update: {
          id?: boolean;
          objetivo_trimestral_defecto?: number;
          comision_porcentaje_defecto?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      candidatos: {
        Row: {
          id: string;
          nombre: string;
          email: string | null;
          telefono: string | null;
          puesto: string;
          fase: Database["public"]["Enums"]["fase_candidato"];
          notas: string | null;
          entrevistador_id: string | null;
          creado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          email?: string | null;
          telefono?: string | null;
          puesto: string;
          fase?: Database["public"]["Enums"]["fase_candidato"];
          notas?: string | null;
          entrevistador_id?: string | null;
          creado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          email?: string | null;
          telefono?: string | null;
          puesto?: string;
          fase?: Database["public"]["Enums"]["fase_candidato"];
          notas?: string | null;
          entrevistador_id?: string | null;
          creado_por?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campanas: {
        Row: {
          id: string;
          nombre: string;
          presupuesto: number | null;
          activa: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          presupuesto?: number | null;
          activa?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          presupuesto?: number | null;
          activa?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      comisiones: {
        Row: {
          id: string;
          factura_id: string;
          user_id: string;
          concepto: string;
          importe: number;
          porcentaje: number;
          estado: Database["public"]["Enums"]["estado_comision"];
          liquidacion_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          factura_id: string;
          user_id: string;
          concepto: string;
          importe: number;
          porcentaje: number;
          estado?: Database["public"]["Enums"]["estado_comision"];
          liquidacion_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          factura_id?: string;
          user_id?: string;
          concepto?: string;
          importe?: number;
          porcentaje?: number;
          estado?: Database["public"]["Enums"]["estado_comision"];
          liquidacion_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      citas: {
        Row: {
          cliente: string;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_cita"];
          fecha_cita: string;
          id: string;
          notas: string | null;
          resultado: string | null;
          ubicacion: string | null;
          user_id: string;
        };
        Insert: {
          cliente: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_cita"];
          fecha_cita?: string;
          id?: string;
          notas?: string | null;
          resultado?: string | null;
          ubicacion?: string | null;
          user_id: string;
        };
        Update: {
          cliente?: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_cita"];
          fecha_cita?: string;
          id?: string;
          notas?: string | null;
          resultado?: string | null;
          ubicacion?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      facturacion: {
        Row: {
          cliente: string;
          comprobante: string | null;
          concepto: string;
          created_at: string;
          estado: Database["public"]["Enums"]["estado_factura"];
          fecha: string;
          id: string;
          importe: number;
          user_id: string;
        };
        Insert: {
          cliente: string;
          comprobante?: string | null;
          concepto: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_factura"];
          fecha?: string;
          id?: string;
          importe?: number;
          user_id: string;
        };
        Update: {
          cliente?: string;
          comprobante?: string | null;
          concepto?: string;
          created_at?: string;
          estado?: Database["public"]["Enums"]["estado_factura"];
          fecha?: string;
          id?: string;
          importe?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      cursos: {
        Row: {
          id: string;
          titulo: string;
          descripcion: string | null;
          obligatorio: boolean;
          publicado: boolean;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          descripcion?: string | null;
          obligatorio?: boolean;
          publicado?: boolean;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          titulo?: string;
          descripcion?: string | null;
          obligatorio?: boolean;
          publicado?: boolean;
          orden?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      modulos_curso: {
        Row: {
          id: string;
          curso_id: string;
          titulo: string;
          descripcion: string | null;
          archivo_url: string | null;
          video_url: string | null;
          tamano: string | null;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          curso_id: string;
          titulo: string;
          descripcion?: string | null;
          archivo_url?: string | null;
          video_url?: string | null;
          tamano?: string | null;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          curso_id?: string;
          titulo?: string;
          descripcion?: string | null;
          archivo_url?: string | null;
          video_url?: string | null;
          tamano?: string | null;
          orden?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      preguntas_curso: {
        Row: {
          id: string;
          curso_id: string;
          enunciado: string;
          orden: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          curso_id: string;
          enunciado: string;
          orden?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          curso_id?: string;
          enunciado?: string;
          orden?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      opciones_pregunta: {
        Row: {
          id: string;
          pregunta_id: string;
          texto: string;
          es_correcta: boolean;
          orden: number;
        };
        Insert: {
          id?: string;
          pregunta_id: string;
          texto: string;
          es_correcta?: boolean;
          orden?: number;
        };
        Update: {
          id?: string;
          pregunta_id?: string;
          texto?: string;
          es_correcta?: boolean;
          orden?: number;
        };
        Relationships: [];
      };
      progreso_modulo: {
        Row: {
          id: string;
          user_id: string;
          modulo_id: string;
          completado_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          modulo_id: string;
          completado_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          modulo_id?: string;
          completado_at?: string;
        };
        Relationships: [];
      };
      resultados_cuestionario: {
        Row: {
          id: string;
          user_id: string;
          curso_id: string;
          aciertos: number;
          total: number;
          aprobado: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          curso_id: string;
          aciertos: number;
          total: number;
          aprobado: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          curso_id?: string;
          aciertos?: number;
          total?: number;
          aprobado?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          empresa: string;
          contacto: string | null;
          telefono: string | null;
          email: string | null;
          ciudad: string | null;
          sector: string | null;
          campana: string | null;
          notas: string | null;
          estado: Database["public"]["Enums"]["estado_lead"];
          asignado_a: string | null;
          creado_por: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          empresa: string;
          contacto?: string | null;
          telefono?: string | null;
          email?: string | null;
          ciudad?: string | null;
          sector?: string | null;
          campana?: string | null;
          notas?: string | null;
          estado?: Database["public"]["Enums"]["estado_lead"];
          asignado_a?: string | null;
          creado_por: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          empresa?: string;
          contacto?: string | null;
          telefono?: string | null;
          email?: string | null;
          ciudad?: string | null;
          sector?: string | null;
          campana?: string | null;
          notas?: string | null;
          estado?: Database["public"]["Enums"]["estado_lead"];
          asignado_a?: string | null;
          creado_por?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      liquidaciones: {
        Row: {
          id: string;
          user_id: string;
          importe_total: number;
          estado: Database["public"]["Enums"]["estado_liquidacion"];
          created_at: string;
          pagada_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          importe_total: number;
          estado?: Database["public"]["Enums"]["estado_liquidacion"];
          created_at?: string;
          pagada_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          importe_total?: number;
          estado?: Database["public"]["Enums"]["estado_liquidacion"];
          created_at?: string;
          pagada_at?: string | null;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          nombre: string;
          objetivo_trimestral: number;
          telefono: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string;
          id: string;
          nombre?: string;
          objetivo_trimestral?: number;
          telefono?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          nombre?: string;
          objetivo_trimestral?: number;
          telefono?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permisos_modulo: {
        Row: {
          role: Database["public"]["Enums"]["app_role"];
          modulo: string;
          acceso: boolean;
        };
        Insert: {
          role: Database["public"]["Enums"]["app_role"];
          modulo: string;
          acceso?: boolean;
        };
        Update: {
          role?: Database["public"]["Enums"]["app_role"];
          modulo?: string;
          acceso?: boolean;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          id: string;
          titulo: string;
          descripcion: string | null;
          estado: Database["public"]["Enums"]["estado_ticket"];
          prioridad: Database["public"]["Enums"]["prioridad_ticket"];
          creado_por: string;
          asignado_a: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          titulo: string;
          descripcion?: string | null;
          estado?: Database["public"]["Enums"]["estado_ticket"];
          prioridad?: Database["public"]["Enums"]["prioridad_ticket"];
          creado_por: string;
          asignado_a?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          titulo?: string;
          descripcion?: string | null;
          estado?: Database["public"]["Enums"]["estado_ticket"];
          prioridad?: Database["public"]["Enums"]["prioridad_ticket"];
          creado_por?: string;
          asignado_a?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      recursos: {
        Row: {
          archivo_url: string;
          categoria: string;
          created_at: string;
          descripcion: string | null;
          id: string;
          tamano: string | null;
          titulo: string;
        };
        Insert: {
          archivo_url: string;
          categoria?: string;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          tamano?: string | null;
          titulo: string;
        };
        Update: {
          archivo_url?: string;
          categoria?: string;
          created_at?: string;
          descripcion?: string | null;
          id?: string;
          tamano?: string | null;
          titulo?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      crear_liquidacion: {
        Args: {
          p_user_id: string;
        };
        Returns: string;
      };
      enviar_cuestionario: {
        Args: {
          p_curso_id: string;
          p_respuestas: Json;
        };
        Returns: { aciertos: number; total: number; aprobado: boolean }[];
      };
    };
    Enums: {
      app_role: "admin" | "comercial" | "account_manager" | "entrevistador" | "admin_staff";
      estado_cita: "Pendiente" | "Realizada" | "Cerrada" | "Cancelada";
      estado_comision: "Pendiente" | "Aprobada" | "Liquidada" | "Cancelada";
      estado_factura: "Pendiente" | "Aprobada" | "Pagada";
      estado_lead: "Nuevo" | "Contactado" | "Cita agendada" | "Ganado" | "Descartado";
      estado_liquidacion: "Pendiente" | "Pagada" | "Cancelada";
      estado_ticket: "Abierto" | "En proceso" | "Resuelto" | "Cerrado";
      prioridad_ticket: "Baja" | "Media" | "Alta";
      fase_candidato:
        | "Recibido"
        | "Entrevista"
        | "Prueba"
        | "Oferta"
        | "Contratado"
        | "Onboarding"
        | "Descartado";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "comercial", "account_manager", "entrevistador", "admin_staff"],
      estado_cita: ["Pendiente", "Realizada", "Cerrada", "Cancelada"],
      estado_comision: ["Pendiente", "Aprobada", "Liquidada", "Cancelada"],
      estado_factura: ["Pendiente", "Aprobada", "Pagada"],
      estado_lead: ["Nuevo", "Contactado", "Cita agendada", "Ganado", "Descartado"],
      estado_liquidacion: ["Pendiente", "Pagada", "Cancelada"],
      estado_ticket: ["Abierto", "En proceso", "Resuelto", "Cerrado"],
      prioridad_ticket: ["Baja", "Media", "Alta"],
      fase_candidato: [
        "Recibido",
        "Entrevista",
        "Prueba",
        "Oferta",
        "Contratado",
        "Onboarding",
        "Descartado",
      ],
    },
  },
} as const;
