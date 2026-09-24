# Bibliotecas de componentes

Heeey se integra a fondo con el ecosistema de bibliotecas de Excalidraw, lo que te permite guardar iconos, diagramas de arquitectura, wireframes y bloques gráficos reutilizables para agilizar tu trabajo.

---

## 📦 ¿Qué son las bibliotecas?

En Excalidraw, una biblioteca es una colección de elementos formados por uno o varios elementos gráficos prefabricados (por ejemplo, iconos de servicios de AWS, símbolos UML, botones de interfaz o ilustraciones).

En Heeey puedes:
- Guardar cualquier selección de elementos del lienzo directamente en tu biblioteca personal.
- Explorar la biblioteca pública oficial de Excalidraw e instalar paquetes listos con un clic.
- Arrastrar elementos de tu biblioteca directamente a cualquier pizarra.

---

## ☁️ Persistencia en la nube frente a caché local

Heeey implementa un adaptador a medida (`createLibraryAdapter` mediante `useHandleLibrary`):

| Contexto del usuario | Dónde se guardan los elementos | Comportamiento |
|---|---|---|
| **Usuario con sesión iniciada** | Tabla `user_libraries` en Supabase + caché local | Sincronización automática en la nube. Tu biblioteca personal te acompaña en cualquier navegador u ordenador. Si estás sin conexión temporalmente, la caché local permite seguir leyendo y escribiendo sin errores. |
| **Invitado / sin sesión** | `localStorage` (`heeey_library`) | Se guarda de forma segura en el navegador actual del dispositivo. |

---

## 🔄 Migración automática en el primer inicio de sesión

Si usaste Heeey como invitado y creaste una biblioteca de elementos personalizada, no tienes que exportarla a mano:

- Cuando inicias sesión en tu cuenta por primera vez (mediante Magic Link), se ejecuta el adaptador de migración (`createGuestLibraryMigration`).
- Lee automáticamente los elementos de `localStorage` y los envía a tu cuenta en la tabla `user_libraries`.
- La caché temporal de invitado se borra de forma segura y tus elementos pasan a estar disponibles en la nube.
