# Primeros pasos con Heeey (Inicio rápido)

Esta guía explica cómo empezar a usar **Heeey**, desde tu primera visita en el navegador hasta la automatización programática mediante la API y agentes de inteligencia artificial.

---

## 🚀 Primera visita: crea tu primera pizarra

Heeey está pensado para no poner trabas: no necesitas crear una cuenta ni rellenar formularios para empezar a dibujar.

1. Entra en [heeey.click](https://heeey.click).
2. Haz clic en **«Pizarra en blanco»** o elige una de las plantillas disponibles:
   - **Lluvia de ideas**: notas adhesivas y tarjetas temáticas para idear rápido.
   - **Diagrama de flujo**: estructura básica con bloques de decisión y flechas dirigidas.
   - **Wireframe**: pantallas y componentes básicos para prototipar.
3. Irás a la URL `/b/<id-de-la-pizarra>`.
4. ¡Empieza a dibujar enseguida! Tu trabajo se guarda localmente en tiempo real y se sincroniza con la nube.

---

## 👥 Colabora con otras personas

Para invitar a tus compañeros a la misma pizarra:

1. En la barra superior de la pizarra, haz clic en el botón **«Compartir»**.
2. Elige el nivel de permiso:
   - **Puede editar** (`edit`): cualquiera con el enlace puede dibujar, añadir notas y cambiar el contenido.
   - **Solo lectura** (`view`): cualquiera con el enlace puede ver la pizarra y seguir los cursores en directo, pero no puede modificar el lienzo.
3. Haz clic en **«Copiar enlace»** y envíalo a tu equipo.
4. Cuando otras personas abran el enlace, verás sus cursores en tiempo real, cada uno con su nombre y su color identificativo.

---

## 🔐 Conecta tu cuenta (Magic Link)

Aunque se puede usar de forma anónima, iniciar sesión con tu cuenta tiene ventajas importantes:

- **Tus pizarras en cualquier dispositivo**: abre tu panel desde cualquier navegador.
- **Las pizarras de invitado pasan a tu cuenta**: las pizarras que creaste como invitado en el navegador se transfieren automáticamente a tu cuenta al iniciar sesión.
- **Bibliotecas en la nube**: los elementos guardados en tu biblioteca de componentes están disponibles en todas tus pizarras.
- **Creación de claves de API**: habilita integraciones con la API REST pública y el servidor MCP para IA.

### Cómo iniciar sesión:
1. En el panel o en el menú superior de la pizarra, haz clic en **«Iniciar sesión»**.
2. Escribe tu dirección de correo electrónico.
3. Recibirás al instante en tu bandeja de entrada un código OTP de 6 dígitos.
4. Escribe el código en pantalla para confirmar. ¡Listo! No hay contraseñas que recordar.

---

## 🤖 Automatización en 3 minutos: Claude Code y MCP

Si usas **Claude Code**, **Cursor** u otro agente compatible con MCP:

1. Abre el panel con tu cuenta iniciada.
2. Haz clic en el icono de la llave (**Claves de API**).
3. Escribe un nombre (p. ej. `claude-code`) y haz clic en **«Crear»**.
4. Copia la clave generada (`hk_...`). La app ya muestra el comando listo para tu terminal:

```bash
claude mcp add --transport http heeey https://heeey.click/api/mcp --header "Authorization: Bearer hk_TU_TOKEN_AQUI"
```

5. Abre la terminal y ejecuta el comando anterior.
6. ¡Ahora tu asistente de IA puede crear diagramas completos, buscar en tus pizarras y organizarlas directamente desde el prompt!

---

## 💻 Ejemplo rápido con cURL (API REST)

También puedes crear pizarras desde scripts o automatizaciones de CI/CD:

```bash
curl -X POST https://heeey.click/api/v1/boards \
  -H "Authorization: Bearer hk_TU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Flujo de aprobación",
    "elements": [
      { "id": "req", "type": "rectangle", "x": 100, "y": 100, "label": "Solicitud enviada", "backgroundColor": "#a5d8ff" },
      { "id": "dec", "type": "diamond", "x": 380, "y": 85, "label": "¿Aprobado?", "backgroundColor": "#ffec99" },
      { "type": "arrow", "start": { "id": "req" }, "end": { "id": "dec" } }
    ]
  }'
```

Heeey responde con los datos de la pizarra creada y el enlace directo (`url`) para abrirla en el navegador.
