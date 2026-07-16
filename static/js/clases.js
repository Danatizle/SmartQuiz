// -----------------------------
// 📁 static/js/clases.js
// -----------------------------

// Variables globales desde Jinja
const pin = "{{ pin }}"; // Se pasa desde Flask
const tituloCuestionario = "{{ titulo }}"; // Opcional si lo envías desde el backend

document.addEventListener("DOMContentLoaded", () => {
  const pinDisplay = document.getElementById("pinDisplay");
  const listaParticipantes = document.getElementById("listaParticipantes");
  const btnEmpezar = document.getElementById("btnEmpezar");

  // --- Recuperar PIN guardado en localStorage si existe ---
  let pinActual = localStorage.getItem("pin_actual_clase");
  if (!pinActual) {
    // Si no hay PIN guardado, usar el que viene desde Flask y guardarlo
    pinActual = pin;
    localStorage.setItem("pin_actual_clase", pinActual);
  }

  // Mostrar PIN en pantalla
  pinDisplay.textContent = pinActual;

  // --- Función para actualizar la lista de jugadores ---
  async function cargarParticipantes() {
    try {
      const res = await fetch(`/api/participantes/${pinActual}`);
      if (!res.ok) return;

      const data = await res.json();
      listaParticipantes.innerHTML = "";

      if (data.participantes && data.participantes.length > 0) {
        data.participantes.forEach((p) => {
          const li = document.createElement("li");
          li.textContent = p;
          listaParticipantes.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "Esperando participantes...";
        listaParticipantes.appendChild(li);
      }
    } catch (error) {
      console.error("Error al cargar participantes:", error);
    }
  }

  // --- Llamar a la función cada 3 segundos ---
  setInterval(cargarParticipantes, 3000);
  cargarParticipantes();

  // --- Botón “Empezar cuestionario” ---
  btnEmpezar.addEventListener("click", async () => {
    if (!confirm("¿Deseas iniciar el cuestionario ahora?")) return;

    try {
      const res = await fetch(`/api/iniciar_cuestionario/${pinActual}`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        alert("¡Cuestionario iniciado! 🚀");
        window.location.href = `/modo_profesor?pin=${pinActual}`;
      } else {
        alert("No se pudo iniciar el cuestionario ❌");
      }
    } catch (error) {
      console.error("Error al iniciar el cuestionario:", error);
    }
  });
});




