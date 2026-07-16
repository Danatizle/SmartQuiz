document.addEventListener('DOMContentLoaded', () => {

    // --- ELEMENTOS DE LA UI ---

    const pinDisplay = document.getElementById('pinDisplay');

    const qrContainer = document.getElementById('qrContainer');

    const listaParticipantes = document.getElementById('listaParticipantes');

    const contadorParticipantes = document.getElementById('contadorParticipantes');

    const btnEmpezar = document.getElementById('btnEmpezar');

    const btnSalir = document.querySelector('.btn-salir');

    const gruposContainer = document.getElementById('gruposContainer'); // Contenedor de "Estamos Listos"



    // Elementos del Modal

    const configModal = document.getElementById('configuracionGruposModal');

    const btnConfigGrupos = document.getElementById('btnConfigGrupos');

    const btnCrearGrupos = document.getElementById('crearGruposBtn');

    const btnCancelarConfig = document.getElementById('cancelarConfigGrupos');

    const groupSizeInput = document.getElementById('max-jugadores-grupo');



    let currentParticipants = []; // Almacena la lista actual de jugadores

    let currentGroups = {}; // Almacena la estructura de grupos

    let pin = pinDisplay ? pinDisplay.textContent.trim() : null;



    if (!pin) {

        console.error("No se encontró el PIN del juego.");

        return;

    }

    // --- ✅ INICIO DEL CÓDIGO A AÑADIR ---

/**
 * Muestra una alerta "bonita" con un solo botón de "Aceptar".
 * @param {string} title - El título del modal.
 * @param {string} message - El mensaje a mostrar.
 */
function showAlert(title, message) {
    const modal = document.getElementById('customAlertModal');
    const modalTitle = document.getElementById('customAlertTitle');
    const modalMessage = document.getElementById('customAlertMessage');
    const okBtn = document.getElementById('customAlertOkBtn');
    const cancelBtn = document.getElementById('customAlertCancelBtn');
    const confirmBtn = document.getElementById('customAlertConfirmBtn');

    if (!modal || !modalTitle || !modalMessage || !okBtn) {
        console.error("Faltan elementos del modal de alerta. Usando alert() nativo.");
        alert(message);
        return;
    }

    modalTitle.textContent = title;
    modalMessage.textContent = message;

    // Configura los botones para modo "alerta"
    cancelBtn.classList.add('hidden');
    confirmBtn.classList.add('hidden');
    okBtn.classList.remove('hidden');

    modal.classList.remove('hidden');

    okBtn.onclick = () => {
        modal.classList.add('hidden');
        okBtn.onclick = null; // Limpia el evento
    };
}

function showConfirm(title, message, isDanger = false) {
    return new Promise((resolve) => {
        const modal = document.getElementById('customAlertModal');
        const modalTitle = document.getElementById('customAlertTitle');
        const modalMessage = document.getElementById('customAlertMessage');
        const okBtn = document.getElementById('customAlertOkBtn');
        const cancelBtn = document.getElementById('customAlertCancelBtn');
        const confirmBtn = document.getElementById('customAlertConfirmBtn');

        if (!modal || !modalTitle || !modalMessage || !okBtn || !cancelBtn) {
            console.error("Faltan elementos del modal de confirmación. Usando confirm() nativo.");
            resolve(confirm(message));
            return;
        }

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Configura los botones para modo "confirmación"
        cancelBtn.classList.remove('hidden');
        confirmBtn.classList.remove('hidden');
        okBtn.classList.add('hidden');

        if (isDanger) {
            confirmBtn.classList.add('danger');
        } else {
            confirmBtn.classList.remove('danger');
        }

        modal.classList.remove('hidden');

        const handleConfirm = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
        };

        confirmBtn.addEventListener('click', handleConfirm, { once: true });
        cancelBtn.addEventListener('click', handleCancel, { once: true });
    });
}

// --- FIN DEL CÓDIGO A AÑADIR ---



    // 1. GENERAR CÓDIGO QR

    if (qrContainer) {

        try {

            // Genera la URL para unirse (EL ALUMNO LA RECIBE)

            const joinUrl = `${window.location.origin}/unirse?pin=${pin}`;



            new QRCode(qrContainer, {

                text: joinUrl, width: 180, height: 180,

                colorDark: "#000", colorLight: "#fff", correctLevel: QRCode.CorrectLevel.H

            });

            const qrLoading = document.querySelector('.qr-loading');

            if(qrLoading) qrLoading.style.display = 'none';

        } catch (e) {

            console.error("Error al generar QR Code:", e);

            qrContainer.innerHTML = "<p style='color:red;'>Error al generar QR.</p>";

        }

    }



    // 2. ACTUALIZAR LISTA DE PARTICIPANTES (CADA 3 SEGUNDOS)

    const participantInterval = setInterval(actualizarDatosDeSala, 3000);



    async function actualizarDatosDeSala() {

        try {

            // Usamos la API del ALUMNO para obtener la lista COMPLETA (con grupos)

            const response = await fetch(`/api/sala-espera/${pin}`);

            if (!response.ok) throw new Error(`Error de red: ${response.status}`);



            const data = await response.json();



            if (data.success) {

                const { grupos, jugadores_sin_grupo } = data.datos;



                // Actualizamos las listas globales

                currentGroups = grupos || {};

                currentParticipants = jugadores_sin_grupo || [];



                // Redibujamos todo

                renderParticipantsAndGroups();



                // Habilitar/Deshabilitar botón de empezar

                const totalJugadores = currentParticipants.length + Object.values(grupos).reduce((acc, g) => acc + g.length, 0);

                btnEmpezar.disabled = totalJugadores === 0;

            }



        } catch (error) {

            console.error("Error al actualizar participantes:", error);

        }

    }



    // 3. RENDERIZAR JUGADORES Y GRUPOS

    function renderParticipantsAndGroups() {

        // --- LIMPIAR LISTA DE "PARTICIPANTES" (DERECHA) ---

        listaParticipantes.innerHTML = '';

        let totalJugadores = 0;



        // --- RENDERIZAR JUGADORES "SIN GRUPO" EN LA LISTA DERECHA ---

        if (currentParticipants.length > 0) {

            currentParticipants.forEach(name => {

                const playerElement = document.createElement('div');

                playerElement.className = 'participante-item';

                playerElement.textContent = name;

                playerElement.draggable = true;

                addDragEvents(playerElement);

                listaParticipantes.appendChild(playerElement);

            });

            totalJugadores += currentParticipants.length;

        }



        // --- RENDERIZAR JUGADORES "EN GRUPOS" (CENTRO) ---

        // Limpiar solo el contenido de los grupos, no los grupos en sí

        document.querySelectorAll('.grupo-lista').forEach(gl => gl.innerHTML = '');



        let jugadoresEnGrupos = 0;

        for (const [id_grupo, jugadores] of Object.entries(currentGroups)) {

            const grupoLista = gruposContainer.querySelector(`.grupo-dropzone[data-grupo="${id_grupo}"] .grupo-lista`);

            if (grupoLista) {

                jugadores.forEach(name => {

                    const playerElement = document.createElement('div');

                    playerElement.className = 'participante-item';

                    playerElement.textContent = name;

                    playerElement.draggable = true;

                    addDragEvents(playerElement);

                    grupoLista.appendChild(playerElement);

                });

                jugadoresEnGrupos += jugadores.length;

            }

        }



        totalJugadores += jugadoresEnGrupos;



        // --- ACTUALIZAR CONTADORES Y ESTADOS VACÍOS ---

        contadorParticipantes.textContent = `${totalJugadores} jugadores conectados`;



        if (currentParticipants.length === 0) {

            // Si la lista derecha está vacía, muestra el placeholder

            listaParticipantes.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><p>Esperando participantes...</p></div>`;

        }

    }





    // 4. LÓGICA DE ARRASTRAR Y SOLTAR (DRAG & DROP)

    function addDragEvents(element) {

        element.addEventListener('dragstart', () => {

            element.classList.add('dragging');

        });

        element.addEventListener('dragend', () => {

            element.classList.remove('dragging');

            // Al soltar, actualizamos la base de datos

            actualizarGrupoEnBD(element);

        });

    }



    function addDropzoneEvents(zone, targetContainerSelector) {

        zone.addEventListener('dragover', e => {

            e.preventDefault();

            zone.classList.add('drag-over');

        });

        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

        zone.addEventListener('drop', e => {

            e.preventDefault();

            zone.classList.remove('drag-over');

            const draggingElement = document.querySelector('.dragging');

            if (draggingElement) {

                const targetContainer = targetContainerSelector ? zone.querySelector(targetContainerSelector) : zone;

                if (targetContainer) {

                    targetContainer.appendChild(draggingElement);

                } else {

                    zone.appendChild(draggingElement);

                }

            }

        });

    }



    // --- FUNCIÓN NUEVA: Actualizar BD después de arrastrar ---

    async function actualizarGrupoEnBD(playerElement) {

        const nombreJugador = playerElement.textContent;

        const dropzone = playerElement.closest('.grupo-dropzone, .panel-participantes');



        let idGrupo = null; // null = "Sin Grupo"



        if (dropzone.classList.contains('grupo-dropzone')) {

            idGrupo = parseInt(dropzone.dataset.grupo, 10);

        }



        try {

            await fetch("/api/sala-espera/unirse-grupo", {

                method: "POST",

                headers: { "Content-Type": "application/json" },

                body: JSON.stringify({

                    pin: pin,

                    nickname: nombreJugador, // El nombre del jugador que se movió

                    id_grupo: idGrupo

                }),

            });

            // No es necesario un .then, el poller actualizará la vista

        } catch (error) {

            console.error("Error al actualizar grupo:", error);

        }

    }



    // Añadir eventos de drop a la lista principal (derecha)

    addDropzoneEvents(listaParticipantes, null);





    // 5. LÓGICA DEL MODAL Y CREACIÓN DINÁMICA DE GRUPOS

    btnConfigGrupos.addEventListener('click', () => configModal.classList.remove('hidden'));

    btnCancelarConfig.addEventListener('click', () => configModal.classList.add('hidden'));



    btnCrearGrupos.addEventListener('click', () => {

        const groupSize = parseInt(groupSizeInput.value, 10);

        if (isNaN(groupSize) || groupSize < 1) {

            showAlert("Entrada Inválida", "Por favor, ingresa un número válido de jugadores por equipo.");
            return;

        }



        // Obtener TODOS los jugadores, sin importar dónde estén

        const allPlayers = [...currentParticipants, ...Object.values(currentGroups).flat()];

        const totalPlayers = allPlayers.length;



        if (totalPlayers === 0) {


            showAlert("Sin Jugadores", "Espera a que se conecten jugadores antes de crear equipos.");
            configModal.classList.add('hidden');
            return;

        }



        // Vaciar grupos actuales y poner a todos en "Sin Grupo"

        currentGroups = {};

        currentParticipants = allPlayers;



        // --- Limpia el contenedor de grupos en el DOM ---

        gruposContainer.innerHTML = '';



        const numGroups = Math.ceil(totalPlayers / groupSize);



        for (let i = 1; i <= numGroups; i++) {

            const groupZone = document.createElement('div');

            groupZone.className = 'grupo-dropzone';

            groupZone.dataset.grupo = i;

            groupZone.innerHTML = `<h3>Equipo ${i}</h3><div class="grupo-lista"></div>`;

            addDropzoneEvents(groupZone, '.grupo-lista');

            gruposContainer.appendChild(groupZone);

        }



        // Forzar redibujado

        renderParticipantsAndGroups();

        configModal.classList.add('hidden');

    });



    // 6. FUNCIONALIDAD DE BOTONES PRINCIPALES

    btnEmpezar.addEventListener('click', async () => {
    const hayGruposConfigurados = Object.keys(currentGroups).length > 0;
    const confirmTitle = "¿Iniciar Juego?";
    const confirmMessage = hayGruposConfigurados
        ? "¿Estás seguro de que quieres iniciar el juego con los equipos configurados?"
        : "No has configurado equipos. ¿Quieres iniciar el juego en modo individual?";

    const proceed = await showConfirm(confirmTitle, confirmMessage);

    if (proceed) {
        btnEmpezar.disabled = true;
        btnEmpezar.textContent = 'Iniciando...';
        try {
            const response = await fetch(`/api/iniciar_cuestionario/${pin}`, { method: 'POST' });
            const data = await response.json();
            if (data.success) {
                // 🚀 Redirige al panel del profesor en vivo
                window.location.href = `/profesor_jugando?pin=${pin}`;
            } else {
                showAlert("Error", data.message || "No se pudo iniciar el juego.");
                btnEmpezar.disabled = false;
                btnEmpezar.textContent = 'Empezar el juego';
            }
        } catch (error) {
            showAlert("Error de Conexión", "No se pudo conectar al servidor.");
            btnEmpezar.disabled = false;
            btnEmpezar.textContent = 'Empezar el juego';
            }
        }
    });




    // --- REEMPLAZA ESTA FUNCIÓN EN sala_profesor.js ---

    // --- ✅ CÓDIGO NUEVO (USA ESTO) ---
    btnSalir.addEventListener('click', async () => {
        const confirmed = await showConfirm(
            "Salir de la Sala",
            "¿Estás seguro de que quieres salir y finalizar esta partida para todos?",
            true // true para que el botón sea rojo (peligro)
        );

        if (confirmed) {
            btnSalir.disabled = true;
            btnSalir.textContent = 'Finalizando...';
            try {
                const response = await fetch('/api/partida/finalizar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin: pin })
                });
                const data = await response.json();
                if (data.success) {
                    window.location.href = '/inicioProfesores';
                } else {
                    showAlert("Error", data.message || 'No se pudo finalizar la partida.'); // Usa la alerta "bonita"
                    btnSalir.disabled = false;
                    btnSalir.textContent = 'Salir de la Sala';
                }
            } catch (error) {
                console.error('Error al finalizar la partida:', error);
                showAlert("Error de Red", 'No se pudo finalizar la partida.'); // Usa la alerta "bonita"
                btnSalir.disabled = false;
                btnSalir.textContent = 'Salir de la Sala';
            }
        }
    });

    actualizarDatosDeSala();

});