// static/js/sala_de_espera_alumno.js

document.addEventListener("DOMContentLoaded", () => {

    // --- VARIABLES GLOBALES (desde Flask, definidas en el HTML) ---
    const pin = FLASK_PIN;
    let nickname = FLASK_NICKNAME;
    const inicioAlumnoUrl = FLASK_URL_INICIO_ALUMNO;

    // --- ELEMENTOS DE LA UI ---
    const nombreJugadorEl = document.getElementById("nombreJugador");
    const avatarImgEl = document.getElementById("avatarImg");
    const estadoPartidaTextoEl = document.getElementById("estado-partida-texto");
    const gruposContainerEl = document.getElementById("grupos-container");
    const gruposGridPlaceholderEl = document.querySelector('.grupos-grid-placeholder');
    const emptyGroupsStateEl = document.getElementById("empty-groups-state");
    const loaderEsperarContainerEl = document.getElementById("loader-espera-container");
    const btnEditarNombre = document.getElementById("btnEditarNombre");
    const btnSalir = document.getElementById("btnSalir");

    // Modal de Confirmación
    const confirmationModal = document.getElementById('confirmationModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const btnCancelModal = document.getElementById('btnCancelModal');
    const btnConfirmModal = document.getElementById('btnConfirmModal');

    // let fetchInterval; // Ya no usamos setInterval
    let currentConfirmCallback = null;
    let isLeaving = false; // Bandera para evitar doble envío al salir
    let longPollController = new AbortController(); // Para cancelar fetch si salimos

    // --- EVENT LISTENERS ---
    btnEditarNombre.addEventListener("click", editarNombre);
    btnSalir.addEventListener("click", () => {
        showConfirmationModal(
            "Salir de la sala",
            "¿Estás seguro de que quieres salir? Tendrás que volver a unirte.",
            () => {
                salirDeSala(); // Llama a la función que cancela y notifica
            }
        );
    });

    // Evento que se dispara cuando el usuario cierra la pestaña o el navegador
    window.addEventListener('beforeunload', () => {
        // Solo notifica si no lo hemos hecho ya con el botón Salir
        if (!isLeaving) {
             notificarSalida();
        }
    });

    // --- FUNCIONES DEL MODAL ---
    function showConfirmationModal(title, message, onConfirm) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        currentConfirmCallback = onConfirm;
        confirmationModal.classList.remove('hidden');
    }

    function closeConfirmationModal() {
        confirmationModal.classList.add('hidden');
    }

    btnCancelModal.addEventListener('click', closeConfirmationModal);
    btnConfirmModal.addEventListener('click', () => {
        if (currentConfirmCallback) {
            currentConfirmCallback();
        }
        closeConfirmationModal();
    });

    // --- FUNCIONES PRINCIPALES ---

    // Función para notificar al backend la salida (usando sendBeacon)
    function notificarSalida() {
        if (!isLeaving && pin && nickname) {
            isLeaving = true;
            const data = `pin=${pin}&nickname=${nickname}`;
            // sendBeacon es ideal para esto, ya que intenta enviar incluso si la página se cierra
            navigator.sendBeacon('/api/sala-espera/salir', data);
            console.log("Notificando salida al backend...");
        }
    }

    // Función que se llama al confirmar la salida o cerrar la pestaña
    function salirDeSala() {
        isLeaving = true;
        longPollController.abort(); // Cancela cualquier fetch de long polling pendiente
        notificarSalida(); // Asegura que se notifique al backend
        window.location.href = inicioAlumnoUrl; // Redirige al inicio
    }


    // 1. Editar Nombre
    async function editarNombre() {
        const nuevo = prompt("Ingresa un nuevo nombre:", nickname);

        if (!nuevo || nuevo.trim() === "" || nuevo.trim() === nickname) {
            return;
        }
        const nuevoNombreTrimmed = nuevo.trim();
        const nombreAnterior = nickname;

        try {
            const res = await fetch("/api/actualizar_nombre_participante", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pin: pin,
                    old_name: nombreAnterior,
                    new_name: nuevoNombreTrimmed
                }),
            });

            const data = await res.json();

            if (data.success) {
                nickname = nuevoNombreTrimmed;
                nombreJugadorEl.textContent = nickname;
                avatarImgEl.src = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(nickname)}`;
                // Actualiza la vista localmente SIN esperar al siguiente polling
                // (Podrías llamar a una versión de renderizarGrupos solo con datos locales si fuera necesario)
                 // Forzamos una actualización inmediata del estado para reflejar el cambio
                 iniciarSalaDeEspera(true); // true indica que es una recarga forzada post-edición
            } else {
                alert(data.message || "No se pudo actualizar el nombre (quizás ya está en uso).");
            }
        } catch (error) {
            console.error("Error al actualizar nombre:", error);
            alert("Error de red al actualizar el nombre.");
        }
    }

    // 2. Unirse a un Grupo
    async function unirseAGrupo(idGrupo) {
        document.querySelectorAll('.btn-join-group').forEach(btn => btn.disabled = true);

        try {
            const res = await fetch("/api/sala-espera/unirse-grupo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pin: pin,
                    nickname: nickname,
                    id_grupo: idGrupo
                }),
            });

            const data = await res.json();

            if (data.success) {
                 // Forzamos una actualización inmediata del estado para reflejar el cambio
                 iniciarSalaDeEspera(true); // true indica que es una recarga forzada post-unión
            } else {
                alert(data.message || "No se pudo unir al grupo.");
                document.querySelectorAll('.btn-join-group').forEach(btn => btn.disabled = false);
            }
        } catch (error) {
            console.error("Error al unirse a grupo:", error);
            alert("Error de red al unirse al grupo.");
            document.querySelectorAll('.btn-join-group').forEach(btn => btn.disabled = false);
        }
    }

    // 4. Función para dibujar los grupos en el HTML (SIN CAMBIOS)
    function renderizarGrupos(grupos, jugadores_sin_grupo) {
        gruposContainerEl.innerHTML = '';
        gruposContainerEl.className = 'grupos-grid-wrapper';
        gruposGridPlaceholderEl.classList.add('hidden');
        emptyGroupsStateEl.classList.add('hidden');

        let jugadorEstaEnGrupo = false;

        const gruposOrdenados = Object.entries(grupos).sort(([idA,],[idB,]) => parseInt(idA) - parseInt(idB));

        // --- Renderizar Jugadores Sin Grupo ---
        const sinGrupoCard = document.createElement('div');
        sinGrupoCard.className = 'grupo-card no-group-card';
        let listaSinGrupoHTML = '<ul>';
        jugadores_sin_grupo.forEach(nombre => {
            if (nombre === nickname) {
                listaSinGrupoHTML += `<li class="my-nickname">${nombre} (Tú)</li>`;
                jugadorEstaEnGrupo = true; // El jugador está en la sección "sin grupo"
            } else {
                listaSinGrupoHTML += `<li>${nombre}</li>`;
            }
        });
        listaSinGrupoHTML += '</ul>';

        let botonSinGrupoHTML = '';
         // Si NO estoy en "sin grupo" Y hay grupos creados -> puedo moverme a "sin grupo"
        if (!jugadores_sin_grupo.includes(nickname) && (gruposOrdenados.length > 0 || jugadores_sin_grupo.length > 0)) {
             botonSinGrupoHTML = `<button class="btn-join-group" data-id-grupo="null">Moverme a (Sin Grupo)</button>`;
        } else if (jugadores_sin_grupo.includes(nickname)) { // Si YA estoy en "sin grupo" -> botón deshabilitado
             botonSinGrupoHTML = `<button class="btn-join-group" data-id-grupo="null" disabled>Ya estás aquí</button>`;
        }


        sinGrupoCard.innerHTML = `
            <h3>Jugadores Sin Grupo (${jugadores_sin_grupo.length})</h3>
            ${listaSinGrupoHTML}
            ${botonSinGrupoHTML}
        `;
        gruposContainerEl.appendChild(sinGrupoCard);

        // --- Renderizar los grupos creados por el profesor ---
        if (gruposOrdenados.length > 0) {
            const grid = document.createElement('div');
            grid.className = 'grupos-grid';

            gruposOrdenados.forEach(([id_grupo, jugadores]) => {
                const grupoCard = document.createElement('div');
                grupoCard.className = 'grupo-card';

                let listaHTML = '<ul>';
                let esteEsMiGrupo = false;

                jugadores.forEach(nombre => {
                    if (nombre === nickname) {
                        listaHTML += `<li class="my-nickname">${nombre} (Tú)</li>`;
                        esteEsMiGrupo = true;
                        jugadorEstaEnGrupo = true; // El jugador está en un grupo numerado
                    } else {
                        listaHTML += `<li>${nombre}</li>`;
                    }
                });
                listaHTML += '</ul>';

                let botonHTML = '';
                if (esteEsMiGrupo) {
                    botonHTML = `<button class="btn-join-group" data-id-grupo="${id_grupo}" disabled>Ya estás aquí</button>`;
                } else {
                    botonHTML = `<button class="btn-join-group" data-id-grupo="${id_grupo}">Unirme al Grupo ${id_grupo}</button>`;
                }

                grupoCard.innerHTML = `
                    <h3>Grupo ${id_grupo} (${jugadores.length} J.)</h3>
                    ${listaHTML}
                    ${botonHTML}
                `;
                grid.appendChild(grupoCard);
            });

            gruposContainerEl.appendChild(grid);
        } else if (jugadores_sin_grupo.length === 0) { // Mostrar mensaje solo si NO hay grupos Y NO hay jugadores sin grupo
             emptyGroupsStateEl.classList.remove('hidden'); // <-- CORREGIDO: Mostrar solo si todo está vacío
        }


        // Asignar eventos a todos los botones de "Unirse"
        document.querySelectorAll('.btn-join-group').forEach(btn => {
            if (btn.disabled) return;

            btn.addEventListener('click', (e) => {
                let idGrupoStr = e.target.getAttribute('data-id-grupo');
                let idGrupo = (idGrupoStr === 'null' || idGrupoStr === '') ? null : parseInt(idGrupoStr, 10);
                unirseAGrupo(idGrupo);
            });
        });
    }

    // ===============================================================
    // --- NUEVAS FUNCIONES PARA SEPARAR ESTADO INICIAL Y LONG POLLING ---
    // ===============================================================

    // 3.B Función para el bucle de long polling (llama a la ruta CON espera)
    async function iniciarLongPolling() {
        if (isLeaving) return; // Detener si el usuario está saliendo

        // Reinicia el AbortController para esta nueva petición
        longPollController = new AbortController();
        const signal = longPollController.signal;

        try {
            console.log("Iniciando espera long polling...");
            // Llamar a la RUTA ORIGINAL CON ESPERA (long polling)
            const response = await fetch(`/api/sala-espera/${pin}`, { signal }); // Pasa la señal

            // Si llegamos aquí, el servidor respondió (o hubo timeout)
            if (!response.ok) {
                 // Si el error NO es por abortar intencionalmente
                 if (response.status !== 0) { // 0 suele indicar abort()
                     console.error(`Error ${response.status} en long poll.`);
                     estadoPartidaTextoEl.textContent = "Error de conexión. Reintentando...";
                     // Volver a intentar después de un breve retraso
                     setTimeout(iniciarLongPolling, 5000); // Espera 5 seg antes de reintentar
                 } else {
                     console.log("Long polling abortado.");
                 }
                 return;
            }

            const data = await response.json();
            if (!data.success) {
                console.error("Error del servidor en long poll:", data.message);
                 // Volver a intentar después de un breve retraso
                 setTimeout(iniciarLongPolling, 5000); // Espera 5 seg antes de reintentar
                 return;
            }

            console.log("Respuesta recibida de long polling:", data.datos);
            const { estado_partida, grupos, jugadores_sin_grupo } = data.datos;

            // --- Manejar Estado de la Partida ---
            if (estado_partida === "en_curso") {
                console.log("¡Juego iniciado! Redirigiendo...");
                loaderEsperarContainerEl.style.display = 'none';
                estadoPartidaTextoEl.textContent = "¡El juego ha comenzado! Redirigiendo...";
                // Redirigir a la página del juego
                window.location.href = `/jugar_partida?pin=${pin}&nickname=${encodeURIComponent(nickname)}`;
                return; // Detener el bucle
            } else if (estado_partida === "finalizada") {
                console.log("La partida ha finalizado o la sala se cerró.");
                loaderEsperarContainerEl.style.display = 'none';
                estadoPartidaTextoEl.textContent = "El anfitrión ha cerrado la sala.";
                showConfirmationModal("Sala cerrada", "El anfitrión ha cerrado la sala o la partida ha terminado.", () => {
                     // Aseguramos que notificarSalida no se ejecute dos veces
                     if (!isLeaving) salirDeSala();
                });
                return; // Detener el bucle
            } else { // 'esperando'
                console.log("Estado: esperando. Actualizando UI y continuando polling.");
                loaderEsperarContainerEl.classList.remove('hidden');
                estadoPartidaTextoEl.textContent = "Esperando a que el anfitrión inicie el quiz...";
                renderizarGrupos(grupos, jugadores_sin_grupo);
                // Llamar de nuevo para continuar el long polling
                // Usamos un pequeño timeout para no sobrecargar si hay respuestas muy rápidas
                setTimeout(iniciarLongPolling, 100);
            }

        } catch (error) {
             // Ignorar errores de aborto, son intencionales
             if (error.name === 'AbortError') {
                 console.log("Fetch abortado (long polling).");
                 return;
             }
            console.error("Error en el ciclo de long polling:", error);
            estadoPartidaTextoEl.textContent = "Error de conexión. Reintentando...";
            // Volver a intentar después de un retraso mayor en caso de error de red
            setTimeout(iniciarLongPolling, 5000); // Espera 5 seg antes de reintentar
        }
    }


    // 3.A Función que se llama al cargar la página (llama a la ruta SIN espera)
    async function iniciarSalaDeEspera(forzarRecarga = false) {
         if (isLeaving && !forzarRecarga) return; // No hacer nada si ya estamos saliendo, a menos que sea forzado
         console.log("Iniciando sala de espera, obteniendo estado inicial...");

        // 1. OBTENER ESTADO INICIAL (SIN ESPERA)
        try {
            // Llamada a la NUEVA RUTA SIN ESPERA
            const response = await fetch(`/api/sala-espera/estado-inicial/${pin}`);

            if (!response.ok) {
                // Si falla la carga inicial, mostramos error y no intentamos el polling
                throw new Error(`Error ${response.status} al obtener estado inicial`);
            }

            const data = await response.json();
            if (data.success) {
                console.log("Estado inicial recibido:", data.datos);
                const { estado_partida, grupos, jugadores_sin_grupo } = data.datos;

                // --- Manejo del estado inicial ---
                if (estado_partida === "en_curso") {
                     console.log("El juego ya había comenzado. Redirigiendo...");
                     window.location.href = `/jugar_partida?pin=${pin}&nickname=${encodeURIComponent(nickname)}`;
                     return; // No iniciar polling
                } else if (estado_partida === "finalizada") {
                     console.log("La partida ya había finalizado.");
                     estadoPartidaTextoEl.textContent = "Esta partida ya ha finalizado.";
                      showConfirmationModal("Partida Finalizada", "Esta partida ya ha terminado.", () => {
                         window.location.href = inicioAlumnoUrl;
                     });
                     return; // No iniciar polling
                 }

                // Si está 'esperando', renderizar y luego iniciar polling
                renderizarGrupos(grupos, jugadores_sin_grupo);
                loaderEsperarContainerEl.classList.remove('hidden');
                estadoPartidaTextoEl.textContent = "Esperando a que el anfitrión inicie el quiz...";

                // 2. INICIAR EL BUCLE DE LONG POLLING (SOLO SI NO ES UNA RECARGA FORZADA)
                // Si es una recarga forzada, el polling ya debería estar corriendo, no lo iniciamos de nuevo.
                if (!forzarRecarga) {
                    iniciarLongPolling();
                } else {
                     console.log("Recarga forzada, no se reinicia el long polling.");
                }

            } else {
                 throw new Error(data.message || 'Error del servidor al obtener estado inicial');
            }
        } catch (error) {
            console.error("Error al iniciar la sala de espera:", error);
            estadoPartidaTextoEl.textContent = "Error al conectar con la sala. Intenta recargar.";
            loaderEsperarContainerEl.classList.add('hidden'); // Ocultar loader si hay error
            // Podríamos intentar iniciar el long polling de todas formas o mostrar un botón de reintento
            // Por ahora, solo mostramos el error.
        }
    }

    // --- CÓDIGO DE INICIO ---
    // Limpia cualquier intervalo anterior si existiera (por si acaso)
    // if (typeof fetchInterval !== 'undefined') clearInterval(fetchInterval);

    // Llama a la nueva función de inicio que primero obtiene el estado actual
    // y luego comienza el long polling.
    iniciarSalaDeEspera();

});