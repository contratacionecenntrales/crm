-- Nuevos roles para la matriz de permisos por módulo (Sala de Entrevistas y
-- Backoffice): además de admin/comercial, se añaden roles de acceso más
-- concreto. ALTER TYPE ... ADD VALUE no puede usarse en la misma
-- transacción que referencia el valor nuevo, así que este fichero va solo,
-- separado del resto del esquema de esta fase.
ALTER TYPE public.app_role ADD VALUE 'account_manager';
ALTER TYPE public.app_role ADD VALUE 'entrevistador';
ALTER TYPE public.app_role ADD VALUE 'admin_staff';
