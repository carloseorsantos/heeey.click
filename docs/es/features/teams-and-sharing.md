# Equipos, proyectos y uso compartido

Las pizarras de Heeey se organizan en **equipos** y **proyectos**, y el uso compartido funciona como en Google Drive: invitas a personas por correo y eliges el acceso general del enlace.

```
Usuario ↔ Equipos → Proyectos → Carpetas → Pizarras
```

---

## 👥 Equipos

- **Equipo personal**: cada cuenta recibe un equipo personal al registrarse, con un proyecto predeterminado (**General**). Su dueño no puede eliminarlo ni salir de él, pero acepta invitados como cualquier otro equipo.
- **Crear un equipo**: en el selector de equipos (arriba en la barra lateral), elige **Crear equipo**. Quien lo crea pasa a ser **owner**.
- **Cambiar de equipo**: el mismo selector muestra todos tus equipos. La dirección del panel es `/t/<equipo>` y, dentro de un proyecto, `/t/<equipo>/p/<proyecto>`.

### Roles en el equipo

| Rol | Qué puede hacer |
|---|---|
| **Owner** | Todo lo que hace un admin, además de nombrar a otros owners y eliminar el equipo. El equipo siempre tiene al menos un owner. |
| **Admin** | Invita y quita personas, cambia roles (salvo los de owners), ve todos los proyectos, incluidos los privados, y administra todas las pizarras. |
| **Miembro** | Crea proyectos y pizarras y edita las pizarras de los proyectos a los que tiene acceso. |
| **Lector** | Solo ve las pizarras de los proyectos a los que tiene acceso. |

### Invitaciones al equipo

En **Configuración › Equipo**, owners y admins crean un **enlace de invitación** con el rol elegido. Cada enlace vale para **una persona** y caduca en **7 días**. Quien lo abre ve el nombre del equipo y el rol, inicia sesión (o crea una cuenta) y acepta. Los enlaces activos se pueden revocar.

### Salir o eliminar

- **Salir del equipo**: las pizarras que creaste siguen en el equipo.
- **Eliminar el equipo**: solo owners, y solo con el equipo vacío (sin pizarras, ni en la papelera).
- **Eliminar una cuenta**: se eliminan el equipo personal y sus pizarras. En equipos con otras personas, la propiedad pasa a un admin (o, si no hay, al miembro más antiguo).

---

## 📁 Proyectos

Los proyectos organizan las pizarras de un equipo. Dentro de cada proyecto puedes crear carpetas.

- **Abierto al equipo** (predeterminado): todos los miembros del equipo ven las pizarras. Los lectores del equipo solo pueden ver.
- **Privado**: solo las personas añadidas al proyecto (como Editor o Lector) y los owners y admins del equipo.
- El proyecto predeterminado (**General**) siempre está abierto al equipo y no se puede eliminar.
- **Mover pizarras**: desde el menú de la pizarra, **Mover a proyecto**. Entre proyectos del mismo equipo basta con editar ambos. Entre equipos, hay que ser owner o admin en los dos.

---

## 🔗 Compartir (al estilo de Google Drive)

El botón **Compartir** de la pizarra abre tres bloques:

### 1. Añadir personas
Escribe un correo, elige **Lector** o **Editor** y pulsa **Invitar**. Funciona con cualquier correo: si la persona aún no tiene cuenta, la invitación se guarda y vale en cuanto se registre con ese correo **verificado**. La pantalla nunca muestra si un correo ya tiene cuenta.

No se envía correo de aviso: manda el enlace con **Copiar enlace**. Las pizarras compartidas contigo aparecen en **Compartidas conmigo**.

### 2. Personas con acceso
Muestra quién creó la pizarra, el acceso heredado (los miembros del equipo o del proyecto privado) y las personas invitadas directamente. La invitación directa solo **suma** acceso: nunca quita lo que alguien tiene por el equipo. Los invitados de fuera del equipo solo ven esa pizarra, no el proyecto ni sus otras pizarras.

### 3. Acceso general

| Opción | Efecto |
|---|---|
| **Restringido** | Solo quien tiene acceso por el equipo, el proyecto o una invitación abre la pizarra, incluso con el enlace. Predeterminado en las pizarras nuevas. |
| **Cualquiera con el enlace · Lector** | Quien tiene el enlace ve la pizarra, sin crear cuenta. |
| **Cualquiera con el enlace · Editor** | Quien tiene el enlace edita a la vez, sin crear cuenta. |

Quien abre una pizarra restringida sin acceso ve **Necesitas acceso**, con la opción de iniciar sesión con otra cuenta.

### Quién puede compartir
Por defecto, los **editores** pueden invitar a personas y cambiar el acceso general. Los owners y admins del equipo pueden desactivarlo (el engranaje del diálogo o **Configuración › Equipo**); entonces solo comparten quien creó la pizarra y los admins. Quien entra solo por el enlace nunca cambia el acceso.

---

## ⏳ Enlaces antiguos: migración con aviso

Las pizarras que ya estaban abiertas por enlace antes de los equipos tienen **30 días** hasta pasar a restringidas. Durante ese plazo:

- Quien puede compartir ve el aviso en el diálogo, con **Mantener el enlace abierto** (solo para esa pizarra) y **Restringir ahora**.
- Quien solo entra por el enlace ve una franja con la fecha en que el enlace dejará de ser público.
- Cambiar el acceso general a mano cancela la migración de esa pizarra.

Una rutina diaria aplica las restricciones vencidas y registra cada una en el registro de auditoría.

---

## 📝 Pizarras creadas sin cuenta

Sin cuenta, las pizarras quedan abiertas para edición por enlace. Al iniciar sesión, Heeey pregunta **en qué equipo y proyecto guardarlas** y si el enlace **sigue abierto** o pasa a **restringido**; ninguna opción viene marcada. Si respondes **Ahora no**, un aviso en el panel te deja guardarlas después.

---

## 🔒 Seguridad

- Todas las reglas se aplican en la base de datos (RLS y funciones de PostgreSQL), no solo en la interfaz: la API, MCP, Realtime y Storage siguen el mismo permiso.
- Los cambios de equipos, roles, invitaciones, proyectos y uso compartido quedan en el registro de auditoría, sin guardar los correos invitados.
- Las claves de API solo llegan a los equipos elegidos al crearlas (consulta [Autenticación](../api/authentication.md)).
